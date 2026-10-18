'use strict';
importScripts('vendor/xlsx.full.min.js','vendor/papaparse.min.js','vendor/jszip.min.js','vendor/fflate.min.js','vendor/sax.js','acq-xlsx-reader.js');
let file, encoding='auto', selectedName, headerEnd=1, book, sheet, dense, csvRows, bounds, full=false, checked, compact, detectedEncoding;
const pause=()=>new Promise(r=>setTimeout(r,0));
function progress(text,done,total){postMessage({type:'progress',text,done,total});}
function cell(r,c){if(compact)return compact.cell(r,c);if(csvRows){const v=csvRows[r]?.[c];return v===undefined?undefined:{t:'s',v};}return dense?.[r]?.[c];}
function text(r,c){const v=cell(r,c);return v?String(v.w??(compact?.date1904&&v.t==='n'&&v.z?XLSX.SSF.format(v.z,v.v,{date1904:true}):XLSX.utils.format_cell(v))??v.v??''):'';}
function nonempty(r){const row=compact?compact.rows[r]:csvRows?csvRows[r]:dense?.[r];return !!row?.some(v=>(csvRows||compact)?(v!==''&&v!==null&&v!==undefined):(v&&v.v!==''&&v.v!==null&&v.v!==undefined));}
function previewRows(indices,limit=20){return indices.slice(0,limit).map(r=>Array.from({length:Math.min(bounds.e.c+1,60)},(_,c)=>text(r,c)));}
async function csvRead(previewOnly){
 const sample=new Uint8Array(await file.slice(0,65536).arrayBuffer());let enc=encoding;
 if(enc==='auto'){if(sample[0]===255&&sample[1]===254)enc='utf-16le';else if(sample[0]===254&&sample[1]===255)enc='utf-16be';else if(detectedEncoding)enc=detectedEncoding;else{const reader=file.stream().getReader(),decoder=new TextDecoder('utf-8',{fatal:true});try{while(true){const part=await reader.read();if(part.done)break;decoder.decode(part.value,{stream:true});}decoder.decode();enc='utf-8';}catch{enc='windows-874';}finally{await reader.cancel();}detectedEncoding=enc;}}
 const sampleText=new TextDecoder(enc).decode(sample,{stream:true});const delimiter=Papa.parse(sampleText,{skipEmptyLines:true,preview:30}).meta.delimiter;
 csvRows=[];let maxCols=0,seen=0,pendingText='',readBytes=0,lastReport=0;
 const sniff=Papa.parse(sampleText,{skipEmptyLines:true,preview:30}), parser=new Papa.Parser({delimiter,newline:sniff.meta.linebreak||'\n'}), decoder=new TextDecoder(enc,{fatal:true}), reader=file.stream().getReader();
 try{while(true){
  const chunk=await reader.read();readBytes+=chunk.value?.length||0;pendingText+=chunk.done?decoder.decode():decoder.decode(chunk.value,{stream:true});
  const parsed=parser.parse(pendingText,0,!chunk.done);const errors=chunk.done?parsed.errors:parsed.errors.filter(error=>error.index<parsed.meta.cursor);if(errors.length)throw new Error(errors[0].message);pendingText=pendingText.slice(parsed.meta.cursor);
  for(const row of parsed.data){if(row.some(v=>String(v).includes('\0')))throw new Error('CSV มี NUL กรุณาเลือก UTF-16 ให้ตรงกับต้นฉบับ');csvRows.push(row);maxCols=Math.max(maxCols,row.length);seen++;if(previewOnly&&seen>=headerEnd+21)break;}
  if(previewOnly&&seen>=headerEnd+21)break;
  if(readBytes-lastReport>=1024*1024){progress('กำลังอ่าน CSV… '+seen.toLocaleString()+' แถว',readBytes,file.size);lastReport=readBytes;await pause();}
  if(chunk.done)break;
 }}finally{await reader.cancel();}

 // Papa emits a terminal empty record; it is not a transaction.
 bounds={s:{r:0,c:0},e:{r:Math.max(0,csvRows.length-1),c:Math.max(0,maxCols-1)}};
 if(bounds.e.c>=16384||bounds.e.r>=1048576)throw new Error('เกินจำนวนแถวหรือคอลัมน์ที่ Excel รองรับ');
}
async function parse(previewOnly){
 checked=null;book=sheet=dense=csvRows=null;full=false;
 if(/\.csv$/i.test(file.name)){await csvRead(previewOnly);}else if(compact){bounds=await compact.read(selectedName,previewOnly?headerEnd+21:Infinity);}else{
  progress(previewOnly?'กำลังอ่านตัวอย่าง Excel…':'กำลังอ่าน Excel ทั้งไฟล์ในเบื้องหลัง… (ระยะนี้ยังคำนวณเปอร์เซ็นต์ไม่ได้)');await pause();
  const bytes=await file.arrayBuffer();book=XLSX.read(bytes,{type:'array',dense:true,sheets:selectedName,sheetRows:previewOnly?headerEnd+21:0,cellNF:true,cellText:false,cellStyles:false,cellFormula:true});
  sheet=book.Sheets[selectedName];if(!sheet?.['!ref'])throw new Error('แผ่นงานว่าง');dense=sheet['!data']||sheet;
  bounds=XLSX.utils.decode_range(previewOnly?(sheet['!fullref']||sheet['!ref']):sheet['!ref']);
  if(bounds.e.r>=1048576||bounds.e.c>=16384)throw new Error('เกินจำนวนแถวหรือคอลัมน์ที่ Excel รองรับ');
 }
 full=!previewOnly;
}
function normalize(v,enabled){return enabled?v.trim().toUpperCase():v;}
function compile(rules,normalized){return rules.map(rule=>({name:rule.name,mode:rule.mode,conditions:rule.conditions.map(c=>{
 const col=XLSX.utils.decode_col(c.column);if(col>bounds.e.c)throw new Error(rule.name+': คอลัมน์ '+c.column+' อยู่นอก MASTER');
 const values=c.value.split(/[,\r\n]+/).map(s=>s.trim()).filter(Boolean).map(s=>normalize(s,normalized));return {...c,col,values,set:new Set(values)};
})}));}
function matches(r,rule,norm){const test=c=>{const actual=normalize(text(r,c.col),norm);if(c.op==='blank')return actual==='';if(c.op==='notblank')return actual!=='';if(c.op==='in')return c.set.has(actual);if(c.op==='notin')return !c.set.has(actual);if(c.op==='startswith')return c.values.some(v=>actual.startsWith(v));return c.values.some(v=>actual.includes(v));};return rule.mode==='AND'?rule.conditions.every(test):rule.conditions.some(test);}
async function check(rules,norm){
 if(!full)await parse(false);const compiled=compile(rules,norm),groups=rules.map(rule=>({rule,rows:[]})),unmatched=[];let count=0,unique=0,overlap=0;
 for(let r=headerEnd;r<=bounds.e.r;r++){
  if(nonempty(r)){count++;let hits=0;for(let g=0;g<groups.length;g++)if(matches(r,compiled[g],norm)){groups[g].rows.push(r);hits++;}if(!hits)unmatched.push(r);else unique++;if(hits>1)overlap++;}
  if(r%10000===0){progress('กำลังแยก ACQ… '+r.toLocaleString()+' / '+(bounds.e.r+1).toLocaleString()+' แถว',r,bounds.e.r+1);await pause();}
 }
 if(!count)throw new Error('ไม่มีรายการหลังแถวหัวตาราง');checked={groups,unmatched,count,unique,overlap,normalized:norm};
 return {range:bounds,count,unique,overlap,unmatched:unmatched.length,groups:groups.map(g=>({name:g.rule.name,count:g.rows.length,preview:previewRows(g.rows)})),unmatchedPreview:previewRows(unmatched)};
}
function safe(v){return v.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\.+/,'').trim()||'ACQ';}
function outputSheet(indices){
 const rows=[];
 for(const r of indices){const input=compact?compact.rows[r]:csvRows?csvRows[r]:dense[r],row=[];for(let c=0;c<=bounds.e.c;c++){
  const old=compact?compact.cell(r,c):csvRows?(input?.[c]===undefined?undefined:{t:'s',v:input[c]}):input?.[c];if(!old)continue;
  if(old.f&&old.v===undefined)throw new Error('พบสูตรที่ไม่มีค่าผลลัพธ์ กรุณาบันทึก MASTER ผ่าน Excel ก่อน');
  // Keep values/types/number formats, without formulas, links or cached display strings.
  row[c]={t:old.t,v:old.v};if(old.z)row[c].z=old.z;
 }rows.push(row);}
 const out={'!data':rows};if(rows.length)out['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length-1,c:bounds.e.c}});if(sheet?.['!cols'])out['!cols']=sheet['!cols'];
 if(compact){out['!cols']=compact.cols;out['!merges']=compact.merges.filter(m=>m.e.r<headerEnd);}
 if(sheet?.['!merges'])out['!merges']=sheet['!merges'].filter(m=>m.e.r<headerEnd);
 return out;
}
async function exportZip(partRows){
 if(!checked)throw new Error('กรุณาตรวจผลใหม่ก่อน');
 const zip=new JSZip(),used=new Set(['summary.xlsx']),manifest=[];
 const all=[...checked.groups,{rule:{name:'Unmatched'},rows:checked.unmatched}];
 const jobs=all.reduce((n,g)=>n+Math.max(1,Math.ceil(g.rows.length/partRows)),0);let job=0;
 for(const group of all){const parts=Math.max(1,Math.ceil(group.rows.length/partRows));for(let part=0;part<parts;part++){
  progress(`กำลังสร้าง ${group.rule.name} · ส่วน ${part+1}/${parts}`,job,jobs);await pause();
  const chosen=group.rows.slice(part*partRows,(part+1)*partRows),indices=[...Array.from({length:headerEnd},(_,i)=>i),...chosen];
  const worksheet=outputSheet(indices),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,worksheet,'Transactions');if(compact?.date1904)wb.Workbook={WBProps:{date1904:true}};
  const base=safe(group.rule.name)+(parts>1?'_part'+String(part+1).padStart(3,'0'):'');let filename=base+'.xlsx',suffix=2;while(used.has(filename.toLowerCase()))filename=base+'_'+(suffix++)+'.xlsx';used.add(filename.toLowerCase());
  const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx',compression:true});zip.file(filename,bytes);manifest.push([group.rule.name,filename,chosen.length]);job++;
 }}
 const summary=[['Source',file.name],['Sheet',selectedName],['Header rows',headerEnd],['Normalize matching',checked.normalized],['Input transactions',checked.count],['Unique matched',checked.unique],['Unmatched',checked.unmatched.length],['Rows matching multiple ACQs',checked.overlap],[],['ACQ','Count','Mode','Rules'],...checked.groups.map(g=>[g.rule.name,g.rows.length,g.rule.mode,g.rule.conditions.map(c=>`${c.column} ${c.op} [${c.value}]`).join(' '+g.rule.mode+' ')]),[],['ACQ','Output file','Transactions'],...manifest];
 const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet(summary),'Summary');zip.file('Summary.xlsx',XLSX.write(b,{type:'array',bookType:'xlsx',compression:true}));
 progress('กำลังรวม ZIP…');const blob=await zip.generateAsync({type:'blob',compression:'STORE'},meta=>progress('กำลังรวม ZIP… '+Math.round(meta.percent)+'%',meta.percent,100));return blob;
}
onmessage=async({data})=>{try{
 let result;
 if(data.action==='load'){
  file=data.file;encoding=data.encoding;headerEnd=data.headers;selectedName=data.sheet;checked=null;compact=null;detectedEncoding=null;
  if(/\.csv$/i.test(file.name)){selectedName='MASTER';result={names:['MASTER']};}else if(/\.xlsx$/i.test(file.name)){compact=new CompactXlsx(file);await compact.metadata();const names=compact.names;selectedName=names.includes(data.sheet)?data.sheet:names[0];result={names};}else{
   progress('กำลังตรวจแผ่นงาน…');const names=XLSX.read(await file.arrayBuffer(),{type:'array',bookSheets:true}).SheetNames;selectedName=data.sheet&&names.includes(data.sheet)?data.sheet:names[0];result={names};
  }
  await parse(true);const indices=Array.from({length:Math.min(headerEnd+20,bounds.e.r+1)},(_,i)=>i);
  result={...result,sheet:selectedName,range:bounds,preview:previewRows(indices,headerEnd+20),estimatedRows:full?bounds.e.r+1:null};
 }else if(data.action==='check')result=await check(data.rules,data.normalize);
 else if(data.action==='export')result=await exportZip(data.partRows);
 postMessage({type:'done',id:data.id,result});
 }catch(e){postMessage({type:'error',id:data.id,error:e.message||String(e)});}};
