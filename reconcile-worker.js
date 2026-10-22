'use strict';
importScripts('vendor/xlsx.full.min.js','vendor/fflate.min.js','vendor/sax.js','acq-xlsx-reader.js?v=xml-ns-2','reconcile-core.js?v=1');
const pause=()=>new Promise(r=>setTimeout(r,0));function progress(text,done,total){postMessage({type:'progress',text,done,total});}
const C=ReconcileCore,METRICS=[16,17,18,28,26],NAMES=['Matched Transactions','Missing in Acquirer','Unexpected Acquirer','Variance Summary'];
let reader,selection={},indices={},cached=null,headers=1;
function value(r,c){return reader.cell(r,c)?.v;}
function text(r,c){const cell=reader.cell(r,c);return cell?String(cell.t==='s'?cell.v:XLSX.utils.format_cell(cell)):'';}
function exists(r){return reader.rows[r]?.some(v=>v!==undefined&&v!==null&&v!=='');}
function row(r){return Array.from({length:reader.maxCol+1},(_,c)=>text(r,c));}
async function open(name){if(cached!==name){progress('กำลังอ่าน '+name+'…');await reader.read(name);cached=name;}}
function metricResults(sums){return sums.map(s=>({sum:C.amount(s),invalid:s.invalid,blanks:s.blanks}));}
async function run(file,head){
 headers=head;indices={};selection={};cached=null;reader=new CompactXlsx(file);await reader.metadata();for(const name of NAMES){const found=reader.names.find(s=>s.trim().toLowerCase()===name.toLowerCase());if(!found)throw new Error('ไม่พบชีต '+name);selection[name]=found;}
 const issues=[];let issueCount=0;const issue=(sheet,r,column,why)=>{issueCount++;if(issues.length<100)issues.push({sheet,row:r+1,column,why});};
 await open(selection[NAMES[0]]);if(reader.maxCol<28)throw new Error('Matched Transactions ต้องมีคอลัมน์ถึง AC');
 const metrics=METRICS.map(c=>({column:XLSX.utils.encode_col(c),name:text(headers-1,c)||XLSX.utils.encode_col(c)})),groups=new Map(),bankDates=new Set(),matchedIds=new Set();let matchedCount=0,matchedSkipped=0;
 for(let r=headers;r<=reader.maxRow;r++){
  if(exists(r)){matchedCount++;const id=String(value(r,6)??'').trim();if(id)matchedIds.add(id);const bank=C.fileDate(value(r,0)),settle=C.settlement(value(r,14),XLSX.SSF.parse_date_code,reader.date1904);if(bank)bankDates.add(bank);
   if(!bank||!settle){matchedSkipped++;issue(NAMES[0],r,!bank?'A':'O','อ่านวันที่ไม่ได้ แถวนี้ไม่อยู่ในยอดสรุป');}else{const profile=text(r,7).trim()||'(ว่าง)',key=JSON.stringify([bank,settle,profile]);let g=groups.get(key);if(!g){g={bank,settle,profile,count:0,sums:METRICS.map(C.accumulator)};groups.set(key,g);}g.count++;METRICS.forEach((c,i)=>{if(!C.add(g.sums[i],value(r,c)))issue(NAMES[0],r,XLSX.utils.encode_col(c),'ยอดไม่ใช่ตัวเลข ไม่นำค่านี้ไปรวม');});}}
  if(r%10000===0){progress('สรุป Matched: '+r.toLocaleString()+' แถว',r,reader.maxRow);await pause();}
 }
 const matched={count:matchedCount,skipped:matchedSkipped,metrics,groups:Array.from(groups.values(),g=>({...g,sums:metricResults(g.sums)})).sort((a,b)=>a.bank.localeCompare(b.bank)||a.settle.localeCompare(b.settle)||a.profile.localeCompare(b.profile))};
 await open(selection[NAMES[1]]);if(reader.maxCol<14)throw new Error('Missing in Acquirer ต้องมีคอลัมน์ถึง O');const missingHeaders=Array.from({length:reader.maxCol+1},(_,c)=>text(headers-1,c));const unpaid=[];let scoped=0,received=0,missingCount=0,invalidDate=0,emptyId=0;
 for(let r=headers;r<=reader.maxRow;r++){
  if(exists(r)){missingCount++;if(text(r,3).trim().toUpperCase()==='SETTLED'){const d=C.settlement(value(r,14),XLSX.SSF.parse_date_code,reader.date1904);if(!d){invalidDate++;issue(NAMES[1],r,'O','อ่าน Settlement Date ไม่ได้');}else if(bankDates.has(d)){scoped++;const id=String(value(r,6)??'').trim();if(id&&matchedIds.has(id))received++;else{unpaid.push(r);if(!id){emptyId++;issue(NAMES[1],r,'G','G ว่าง จึงยืนยันการจับคู่ไม่ได้');}}}}}
  if(r%10000===0){progress('ตรวจ Missing: '+r.toLocaleString()+' แถว',r,reader.maxRow);await pause();}
 }
 indices.missing=unpaid;const missing={headers:missingHeaders,count:missingCount,scoped,received,pending:unpaid.length,emptyId,invalidDate,rows:unpaid.slice(0,50).map(r=>({row:r+1,values:row(r),note:text(r,6).trim()?'ไม่พบ G ใน Matched':'G ว่าง ต้องตรวจสอบ'}))};
 await open(selection[NAMES[2]]);indices.unexpected=[];const unexpectedHeaders=Array.from({length:reader.maxCol+1},(_,c)=>text(headers-1,c));for(let r=headers;r<=reader.maxRow;r++){if(exists(r))indices.unexpected.push(r);if(r%10000===0){progress('ตรวจ Unexpected: '+r.toLocaleString()+' แถว',r,reader.maxRow);await pause();}}const unexpected={headers:unexpectedHeaders,count:indices.unexpected.length,rows:indices.unexpected.slice(0,50).map(r=>({row:r+1,values:row(r)}))};
 await open(selection[NAMES[3]]);if(reader.maxCol<40)throw new Error('Variance Summary ต้องมีคอลัมน์ถึง AO');const varianceGroups=new Map();let varianceCount=0,varianceSkipped=0,varianceEligible=0;
 for(let r=headers;r<=reader.maxRow;r++){if(exists(r)){varianceCount++;if(text(r,0).trim().toLowerCase()==='bank line'){varianceEligible++;const bankLine='Bank line',date=C.fileDate(value(r,1));if(!date){varianceSkipped++;issue(NAMES[3],r,'B','อ่านวันที่จาก SourceFileName ไม่ได้');}else{const key=JSON.stringify([date,bankLine]);let g=varianceGroups.get(key);if(!g){g={date,bankLine,count:0,sum:C.accumulator()};varianceGroups.set(key,g);}g.count++;if(!C.add(g.sum,value(r,40)))issue(NAMES[3],r,'AO','ยอดไม่ใช่ตัวเลข ไม่นำค่านี้ไปรวม');}}}if(r%10000===0){progress('สรุป Variance: '+r.toLocaleString()+' แถว',r,reader.maxRow);await pause();}}
 const variance={count:varianceCount,eligible:varianceEligible,excluded:varianceCount-varianceEligible,skipped:varianceSkipped,groups:Array.from(varianceGroups.values(),g=>({...g,sum:metricResults([g.sum])[0]})).sort((a,b)=>a.date.localeCompare(b.date)||a.bankLine.localeCompare(b.bankLine))};return {matched,missing,unexpected,variance,bankDates:Array.from(bankDates).sort(),issues,issueCount};
}
onmessage=async({data})=>{try{let result;if(data.action==='run')result=await run(data.file,data.header);else{const kind=data.kind;if(!['missing','unexpected'].includes(kind)||!indices[kind])throw new Error('กรุณาสรุปไฟล์ก่อน');await open(selection[kind==='missing'?NAMES[1]:NAMES[2]]);const start=data.page*50;result={rows:indices[kind].slice(start,start+50).map(r=>({row:r+1,values:row(r),note:kind==='missing'?(text(r,6).trim()?'ไม่พบ G ใน Matched':'G ว่าง ต้องตรวจสอบ'):undefined}))};}postMessage({type:'done',id:data.id,result});}catch(e){postMessage({type:'error',id:data.id,error:e.message});}};
