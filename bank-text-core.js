'use strict';
const BankTextCore=(()=>{
 const labels={interchange:'TOTAL INTERCHANGE VALUE',fee:'TOTAL REIMBURSEMENT FEES',visa:'TOTAL VISA CHARGES',total:'NET SETTLEMENT AMOUNT'};
 const month={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
 function date(value){const s=String(value||'').trim().toUpperCase();let m,y,mo,d;if((m=s.match(/^(\d{1,2})([A-Z]{3})(\d{2}|\d{4})$/))){d=Number(m[1]);mo=month[m[2]];y=Number(m[3])+(m[3].length===2?2000:0);}else if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/))){y=Number(m[1]);mo=Number(m[2]);d=Number(m[3]);}else if((m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))){d=Number(m[1]);mo=Number(m[2]);y=Number(m[3]);}else return null;const x=new Date(Date.UTC(y,mo-1,d));return y>=1900&&y<=2199&&x.getUTCFullYear()===y&&x.getUTCMonth()+1===mo&&x.getUTCDate()===d?`${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;}
 function amount(token){const m=String(token).trim().match(/^([+-]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(CR|DB)?$/i);if(!m)return null;const abs=m[2].replace(/,/g,'')+(m[3]||''),direction=(m[4]||'').toUpperCase(),negative=direction==='DB'||!direction&&m[1]==='-';return {value:(negative&&/[1-9]/.test(abs)?'-':'')+abs,direction};}
 function totalFromLine(line,label){const tail=line.trim().slice(label.length).trim().replace(/(\d)\s+(CR|DB)\b/gi,'$1$2'),tokens=tail.split(/\s+/);if(tokens.length<3||tokens.length>4||tokens.some(t=>!amount(t)))return {error:'อ่านช่อง CREDIT / DEBIT / TOTAL AMOUNT ไม่ครบหรือรูปแบบตัวเลขไม่ถูกต้อง'};return amount(tokens[tokens.length-1]);}
 function parse(text,filename=''){const lines=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/\f/g,'\n').split('\n'),segments=[];let part=null;
  lines.forEach((line,i)=>{if(/\bREPORT ID\s*:/i.test(line)){part={lines:[],start:i+1};segments.push(part);}if(part)part.lines.push({line,no:i+1});});
  if(!segments.length)return [{file:filename,number:1,reportId:'',reportDate:null,reportingFor:'',currency:'',metrics:{},audit:[],errors:['ไม่พบ REPORT ID: รุ่นนี้รองรับรายงาน VISA VSS-110 ตามตัวอย่าง'],notes:[]}];
  const records=[],previous=new Map();
  for(const segment of segments){const joined=segment.lines.map(x=>x.line).join('\n'),reportId=joined.match(/\bREPORT ID\s*:\s*(\S+)/i)?.[1]||'',page=Number(joined.match(/\bPAGE\s*:\s*(\d+)/i)?.[1]||0),dates=Array.from(joined.matchAll(/\bREPORT DATE\s*:\s*(\S+)/gi),m=>m[1]),fors=segment.lines.filter(x=>/^\s*REPORTING FOR\s*:/i.test(x.line)).map(x=>x.line.replace(/^\s*REPORTING FOR\s*:\s*/i,'').replace(/\s{2,}(?:INTERNATIONAL SETTLEMENT SERVICE|VISANET SETTLEMENT SERVICE|SETTLEMENT SUMMARY REPORT|PROC DATE\s*:|REPORT DATE\s*:).*$/i,'').trim());
   const reportDate=dates.length?date(dates[dates.length-1]):null,reportingFor=fors[fors.length-1]||'',headerErrors=[];
   if(!/^VSS-110$/i.test(reportId))headerErrors.push('REPORT ID '+reportId+' ยังไม่รองรับ (รองรับ VSS-110)');
   if(new Set(dates).size>1)headerErrors.push('พบ REPORT DATE หลายค่าภายในหัวรายงานเดียว');if(new Set(fors).size>1)headerErrors.push('พบ REPORTING FOR หลายค่าภายในหัวรายงานเดียว');
   const blocks=[];let block=null;for(const item of segment.lines){const match=item.line.match(/^\s*SETTLEMENT CURRENCY\s*:\s*([A-Z]{3})\b/i);if(match){block={currency:match[1].toUpperCase(),lines:[]};blocks.push(block);}if(block)block.lines.push(item);}
   if(!blocks.length)blocks.push({currency:'',lines:segment.lines});
   for(const block of blocks){const key=JSON.stringify([reportId,reportDate,reportingFor,block.currency]),prior=previous.get(key),continuation=prior&&((page>0&&prior.lastPage>0&&page>prior.lastPage)||(!page&&!prior.metrics.total));let record=continuation?prior:null;
    if(!record){record={file:filename,number:records.length+1,reportId,reportDate,reportingFor,currency:block.currency,metrics:{},audit:[],errors:[],notes:[],lastPage:page};records.push(record);previous.set(key,record);}record.lastPage=page;record.errors.push(...headerErrors);
    for(const item of block.lines){const trimmed=item.line.trim().replace(/\s+/g,' ');for(const [field,label]of Object.entries(labels)){if(!new RegExp('^'+label+'(?:\\s|$)','i').test(trimmed))continue;const parsed=totalFromLine(trimmed,label);const old=record.metrics[field];if(old&&old.value!==parsed.value)record.notes.push('พบ '+label+' หลายค่า ใช้บรรทัดสุดท้ายตามรายงาน');record.metrics[field]={...parsed,line:item.no,raw:item.line};record.audit.push({field,label,line:item.no,raw:item.line,...parsed});}}
   }
  }
  for(const r of records){if(!r.reportDate)r.errors.push('ไม่พบหรืออ่าน REPORT DATE ไม่ได้');if(!r.reportingFor)r.errors.push('ไม่พบ REPORTING FOR');if(!r.currency)r.errors.push('ไม่พบ SETTLEMENT CURRENCY');for(const [field,label]of Object.entries(labels)){const value=r.metrics[field];if(!value)r.errors.push('ไม่พบ '+label);else if(value.error)r.errors.push(label+': '+value.error);}r.errors=[...new Set(r.errors)];r.notes=[...new Set(r.notes)];}
  return records;
 }
 return {date,amount,totalFromLine,parse,labels};
})();
if(typeof module!=='undefined')module.exports=BankTextCore;
