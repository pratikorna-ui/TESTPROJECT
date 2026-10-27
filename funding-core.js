'use strict';
const FundingCore=(()=>{
 const banks={CIMB:['CIMB'],BBL:['BBL','BANGKOK BANK','กรุงเทพ'],KBANK:['KBANK','KASIKORN','กสิกร'],KTB:['KTB','KRUNGTHAI','กรุงไทย'],SCB:['SCB','SIAM COMMERCIAL','ไทยพาณิชย์'],TTB:['TTB','TMB','ทหารไทยธนชาต'],BAY:['BAY','KRUNGSRI','กรุงศรี'],UOB:['UOB']};
 function normalize(s){return String(s??'').trim().normalize('NFC').toUpperCase();}
 function iso(y,m,d){y=Number(y);m=Number(m);d=Number(d);const x=new Date(Date.UTC(y,m-1,d));return y>=1900&&y<=2199&&x.getUTCFullYear()===y&&x.getUTCMonth()+1===m&&x.getUTCDate()===d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:null;}
 function date(value,year){const s=String(value??'').trim();let m;if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)))return iso(m[1],m[2],m[3]);if((m=s.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{4}))?$/)))return iso(m[3]||year,m[2],m[1]);return null;}
 function offDay(day,holidays){const d=new Date(day+'T00:00:00Z').getUTCDay();return d===0||d===6||holidays.has(day);}
 function fundingDate(due,sameDay,holidays){if(!date(due))throw new Error('วันที่ Due ไม่ถูกต้อง');if(sameDay)return due;let d=new Date(due+'T00:00:00Z');for(let i=0;i<370;i++){d.setUTCDate(d.getUTCDate()+1);const next=d.toISOString().slice(0,10);if(!offDay(next,holidays))return next;}throw new Error('ไม่พบวันทำการ กรุณาตรวจวันหยุด');}
 function bank(text){const s=normalize(text),found=[];for(const [name,aliases]of Object.entries(banks))if(aliases.some(a=>/[ก-๙]/.test(a)?s.includes(a):new RegExp('(?:^|[^A-Z])'+a+'(?:[^A-Z]|$)').test(s)))found.push(name);return found.length===1?found[0]:null;}
 function extract(lines,year){const totalLines=lines.filter(line=>/\btotal\b|ยอดรวม/i.test(line));const last=totalLines.at(-1)||'';const amounts=Array.from(last.matchAll(/(?<![\w.\d])[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?![\d.])/g),m=>m[0]);const dues=[];for(const line of lines){const m=line.match(/\bdue(?:\s+date)?\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{4})?|\d{4}-\d{2}-\d{2})\b/i);if(m){const d=date(m[1],year);if(d&&!dues.includes(d))dues.push(d);}}const currencies=Array.from(new Set(Array.from(last.matchAll(/\b(THB|USD|EUR|GBP|JPY|CNY|SGD|HKD|AUD)\b/gi),m=>m[1].toUpperCase())));return {currency:currencies.length===1?currencies[0]:'',totalLine:last,amount:amounts.length===1?amounts[0]:'',due:dues.length===1?dues[0]:'',dueNeedsYear:lines.some(line=>/\bdue(?:\s+date)?\s*[:\-]?\s*\d{1,2}[\/-]\d{1,2}(?![\d\/-])/i.test(line)),warning:amounts.length===1?'':'อ่าน Total ไม่แน่ชัด กรุณาใส่ยอดเอง'};}
 function sameDayRule(code,subject,filename,rules){
  const text=normalize(subject+' '+filename);for(const rule of rules){if(normalize(code)===rule)return rule;const escaped=rule.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp('(?:^|[^A-Z0-9])'+escaped+'(?:[^A-Z0-9]|$)').test(text))return rule;}return null;
 }
 function showDate(d){return d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'';}
 return {banks,normalize,iso,date,offDay,fundingDate,bank,extract,sameDayRule,showDate};
})();
if(typeof module!=='undefined')module.exports=FundingCore;
