// node tests/merge-workbook.cjs (Node 20+, vendored dependencies only)
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),XLSX=require('../vendor/xlsx.full.min.js'),fflate=require('../vendor/fflate.min.js');
const context=vm.createContext({File,Blob,TextDecoder,TextEncoder,URL,Uint8Array,Uint16Array,ArrayBuffer,setTimeout,console,postMessage(){},onmessage:null});
context.importScripts=()=>{context.Papa=require('../vendor/papaparse.min.js');context.XLSX=XLSX;context.fflate=fflate;context.sax=require('../vendor/sax.js');vm.runInContext(fs.readFileSync(path.join(root,'acq-xlsx-reader.js'),'utf8'),context);};
vm.runInContext(fs.readFileSync(path.join(root,'merge-worker.js'),'utf8')+'\nglobalThis.Writer=StreamingWorkbook;globalThis.makeAnalysis=analyze;globalThis.makeMerge=merge;',context);
(async()=>{
 const writer=new context.Writer(['ID','Amount','Thai','Literal'],5000);
 for(let i=0;i<5000;i++)writer.addRow([{t:'s',v:String(i).padStart(8,'0')},{t:'n',v:-1234.5,z:'#,##0.00'},{t:'s',v:'ไทย & <test>\nnext'},{t:'s',v:'_x000D_\r=SUM(A1)'}]);
 const result=XLSX.read(await writer.finish().arrayBuffer(),{type:'array',cellNF:true}).Sheets.Merged;
 assert.equal(result['!ref'],'A1:D5001');assert.equal(result.A2.v,'00000000');assert.equal(result.A5001.v,'00004999');assert.equal(result.B2.t,'n');assert.equal(result.B2.v,-1234.5);assert.equal(result.B2.z,'#,##0.00');assert.equal(result.C2.v,'ไทย & <test>\nnext');assert.equal(result.D2.v,'_x000D_\r=SUM(A1)');assert.equal(result.D2.t,'s');
 function file(name,rows,epoch=false){const b=XLSX.utils.book_new(),s=XLSX.utils.aoa_to_sheet(rows);if(epoch)s.B2.z='yyyy-mm-dd';XLSX.utils.book_append_sheet(b,s,'Data');if(epoch)b.Workbook={WBProps:{date1904:true}};return new File([XLSX.write(b,{type:'array',bookType:'xlsx'})],name);}
 const first=file('one.xlsx',[['ID','Amount'],['00001',1.25]]),second=file('two.xlsx',[['Amount','id','Extra'],[2.5,'00002','x']]);
 const analyzed=await context.makeAnalysis([{file:first,header:1},{file:second,header:1}]);assert.equal(analyzed.total,2);assert.equal(analyzed.columns.length,3);
 const merged=await context.makeMerge(['id','amount'],true),sheet=XLSX.read(await merged.blob.arrayBuffer(),{type:'array'}).Sheets.Merged;
 assert.equal(sheet.A3.v,'00002');assert.equal(sheet.B3.v,2.5);assert.equal(sheet.C2.v,'one.xlsx');assert.equal(sheet.C3.v,'two.xlsx');assert.equal(sheet['!ref'],'A1:C3');
 await assert.rejects(context.makeAnalysis([{file:file('bad.xlsx',[['ID','id'],['a','b']]),header:1}]),/ซ้ำ/);
 const dated=file('date.xlsx',[['ID','Date'],['1',1]],true);await context.makeAnalysis([{file:dated,header:1}]);const dateOut=await context.makeMerge(['id','date'],false);const dateSheet=XLSX.read(await dateOut.blob.arrayBuffer(),{type:'array',cellNF:true}).Sheets.Merged;assert.equal(dateSheet.B2.v,1463);assert.equal(dateSheet.B2.z,'yyyy-mm-dd');
 const thai='ID,Name,Amount\r\n0007,ทดสอบ,1234.50\r\n';
 const map=new Map();for(let i=0;i<256;i++)map.set(new TextDecoder('windows-874').decode(Uint8Array.of(i)),i);
 const cp874=new File([Uint8Array.from(Array.from(thai,ch=>map.get(ch)))],'thai.csv');
 await context.makeAnalysis([{file:cp874,header:1,encoding:'auto'}]);const csvOut=await context.makeMerge(['id','name','amount'],true);const csvSheet=XLSX.read(await csvOut.blob.arrayBuffer(),{type:'array'}).Sheets.Merged;
 assert.equal(csvSheet.A2.v,'0007');assert.equal(csvSheet.B2.v,'ทดสอบ');assert.equal(csvSheet.C2.t,'s');assert.equal(csvSheet.C2.v,'1234.50');assert.equal(csvSheet.D2.v,'thai.csv');
 const utf16=new File([Uint8Array.of(255,254),Buffer.from('ID\tAmount\r\n0008\t12.50\r\n','utf16le')],'utf16.csv');await context.makeAnalysis([{file:utf16,header:1,encoding:'auto'}]);const utf=await context.makeMerge(['id','amount'],false);assert.equal(XLSX.read(await utf.blob.arrayBuffer(),{type:'array'}).Sheets.Merged.A2.v,'0008');
 await assert.rejects(context.makeAnalysis([{file:new File(['ID,Name\n1,"unfinished'],'bad.csv'),header:1}]),/quote/i);
 console.log('PASS: Thai Windows-874 and UTF-16 CSV, text amounts/IDs, quoted CSV validation');
 console.log('PASS: streaming XLSX flush/roundtrip, 5000 rows, types/decimals/Thai/XML escapes, column alignment, Source File, duplicate header rejection and date-1904 normalization');
})().catch(e=>{console.error(e);process.exit(1)});
