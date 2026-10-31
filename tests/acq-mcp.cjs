const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),XLSX=require('../vendor/xlsx.full.min.js'),JSZip=require('../vendor/jszip.min.js');
let ctx=vm.createContext({File,Blob,TextEncoder,TextDecoder,URL,Uint8Array,Uint16Array,ArrayBuffer,console,setTimeout,onmessage:null,postMessage(){},XLSX,JSZip});ctx.importScripts=()=>{};
vm.runInContext(fs.readFileSync(path.join(root,'acq-worker.js'),'utf8')+'\nglobalThis.runCheck=check;globalThis.zipExport=exportZip;globalThis.setup=rows=>{csvRows=rows;compact=null;full=true;file={name:"detail 01102026.csv"};headerEnd=1;selectedName="MASTER";bounds={s:{r:0,c:0},e:{r:rows.length-1,c:30}};};',ctx);
const code=fs.readFileSync(path.join(root,'acq-split.js'),'utf8');const start=code.indexOf('const defaults=');const end=code.indexOf('\nlet source=',start);vm.runInContext(code.slice(start,end)+'\nglobalThis.presets=defaults();',ctx);
const fixtures=[
 ['mcp','some MCP project','THB','other','ZZ'],
 ['mcc','prefix (MCC stuff','THB','BBL acquiring','ZZ'],
 ['airways','Bangkok Airways - 1A [USD]','EUR','BBL','ZZ'],
 ['onyx','other','USD','Onyx abc','ZZ'],
 ['vfs','other','USD','abc vfs','ZZ'],
 ['multi','MCP (MCC','USD','BBL onyx vfs','ZZ'],
 ['mcc-no-bbl','prefix (MCC','THB','other','ZZ'],
 ['airways-usd','Bangkok Airways - 1A [USD]','USD','BBL','ZZ'],
 ['onyx-thb','other','THB','onyx','ZZ'],
 ['vfs-thb','other','THB','vfs','ZZ'],
 ['wrong-name','Bangkok Airways - 1A [USD] extra','EUR','BBL','ZZ'],
 ['jcb1','other','THB','prefix 2C2P ACQ - suffix','JC'],
 ['jcb2','other','THB','2C2P JCB group','JC'],
 ['jcb-both','other','THB','2C2P ACQ - 2C2P JCB','JC'],
 ['wrong-ac','other','THB','2C2P JCB','ZZ']
];
const rows=[Array.from({length:31},(_,i)=>'header'+i),...fixtures.map(([id,b,g,p,ac])=>{const r=Array(31).fill('');r[0]=id;r[1]=b;r[6]=g;r[15]=p;r[28]=ac;r[30]='ไทย';return r;})];
(async()=>{ctx.setup(rows);const rules=ctx.presets.filter(r=>['MCP Project','JCB'].includes(r.name));const result=await ctx.runCheck(rules,true);assert.equal(result.groups.find(g=>g.name==='MCP Project').count,6);assert.equal(result.groups.find(g=>g.name==='JCB').count,3);assert.equal(result.unmatched,6);assert.equal(result.unique,9);assert.equal(result.unmatchedPreview,undefined);
const blob=await ctx.zipExport(10000),zip=await JSZip.loadAsync(await blob.arrayBuffer());assert.deepEqual(Object.keys(zip.files).sort(),['JCB 01102026.xlsx','MCP Project 01102026.xlsx','Summary.xlsx']);const read=async name=>{const b=XLSX.read(await zip.file(name).async('uint8array'),{type:'array'});return XLSX.utils.sheet_to_json(b.Sheets[b.SheetNames[0]],{header:1});};assert.deepEqual((await read('MCP Project 01102026.xlsx')).slice(1).map(r=>r[0]),['mcp','mcc','airways','onyx','vfs','multi']);assert.deepEqual((await read('JCB 01102026.xlsx')).slice(1).map(r=>r[0]),['jcb1','jcb2','jcb-both']);assert.equal((await read('Summary.xlsx')).find(row=>row[0]==='Unmatched')[1],6);
const parts=await JSZip.loadAsync(await (await ctx.zipExport(2)).arrayBuffer());assert(parts.file('JCB 01102026_part001.xlsx'));assert(parts.file('MCP Project 01102026_part003.xlsx'));assert.equal(vm.runInContext("sourceDateStamp('detail 01102026.xlsx')",ctx),'01102026');assert.throws(()=>vm.runInContext("sourceDateStamp('detail 31022026.xlsx')",ctx),/DDMMYYYY/);assert.throws(()=>vm.runInContext("sourceDateStamp('detail 01102026 02102026.xlsx')",ctx),/DDMMYYYY/);
ctx.setup([rows[0],rows[7]]);await ctx.runCheck(rules,true);const empty=await JSZip.loadAsync(await (await ctx.zipExport(10000)).arrayBuffer());assert.deepEqual(Object.keys(empty.files),['Summary.xlsx']);console.log('PASS: all 5 MCP branches, exclusions, union deduplication, JCB alternatives/AC restriction, full rows, unmatched count only, no empty ACQ files, summary-only zero matches');})().catch(e=>{console.error(e);process.exit(1)});
