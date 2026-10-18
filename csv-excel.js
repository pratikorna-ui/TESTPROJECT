'use strict';
const el=id=>document.getElementById(id), entries=[];let working=false,downloadURL;
function statusCSV(text,error=false){el('csvStatus').textContent=text;el('csvStatus').classList.toggle('error',error);}
function safeName(name){return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\.+/,'').trim()||'converted';}
function invalidateCSV(){if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=null;el('csvDownload').hidden=true;}
function syncCSV(){el('convert').disabled=working||!entries.length||entries.some(e=>!e.rows);el('csvFiles').disabled=working;el('clearAll').disabled=working;document.querySelectorAll('.csv-item input,.csv-item select,.csv-item button').forEach(control=>control.disabled=working);}
function decodeCSV(bytes,encoding){
 if(encoding!=='auto')return {text:new TextDecoder(encoding,{fatal:true}).decode(bytes),encoding};
 if(bytes[0]===255&&bytes[1]===254)return {text:new TextDecoder('utf-16le',{fatal:true}).decode(bytes),encoding:'utf-16le'};
 if(bytes[0]===254&&bytes[1]===255)return {text:new TextDecoder('utf-16be',{fatal:true}).decode(bytes),encoding:'utf-16be'};
 try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),encoding:'utf-8'};}catch{
 return {text:new TextDecoder('windows-874',{fatal:true}).decode(bytes),encoding:'windows-874'};
 }
}
function repairCSV(text,encoding){
 if(encoding==='none')return text;
 // Undo a mistaken single-byte decoding, then decode the original UTF-8 bytes.
 const inverse=new Map();for(let i=0;i<256;i++){const char=new TextDecoder(encoding).decode(Uint8Array.of(i));if(char!=='�'&&!inverse.has(char))inverse.set(char,i);}
 const bytes=[];for(const char of text){if(!inverse.has(char))throw new Error('ซ่อมด้วยวิธีนี้ไม่ได้ กรุณาเลือก “ไม่ซ่อม” หรือเปลี่ยนการอ่านไฟล์');bytes.push(inverse.get(char));}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));}catch{throw new Error('ข้อความไม่ตรงกับวิธีซ่อมนี้ กรุณาเปลี่ยนตัวเลือก');}
}
function parseEntry(entry){
 invalidateCSV();entry.rows=null;entry.info.classList.remove('csv-error');entry.preview.replaceChildren();
 try{
  const decoded=decodeCSV(entry.bytes,entry.encoding.value);let text=repairCSV(decoded.text,entry.repair.value).replace(/^\uFEFF/,'');
  if(text.includes('\u0000'))throw new Error('พบอักขระ NUL ลองเลือก UTF-16 LE / BE ให้ตรงกับต้นฉบับ');
  if(!text.length)throw new Error('ไฟล์ว่าง ไม่มีข้อมูลให้แปลง');
  const delimiter=entry.delimiter.value==='auto'?Papa.parse(text,{skipEmptyLines:true,preview:30}).meta.delimiter:entry.delimiter.value==='tab'?'\t':entry.delimiter.value;
  const parsed=Papa.parse(text,{delimiter,dynamicTyping:false,skipEmptyLines:false});
  const errors=parsed.errors.filter(e=>e.code!=='UndetectableDelimiter');if(errors.length)throw new Error(`CSV รูปแบบไม่ถูกต้อง: ${errors[0].message}`);
  const rows=parsed.data;if(/(?:\r\n|\r|\n)$/.test(text)&&rows.at(-1)?.length===1&&rows.at(-1)[0]==='')rows.pop();
  let cells=0,width=0;for(const row of rows){width=Math.max(width,row.length);cells+=row.length;for(const cell of row)if(cell.length>32767)throw new Error('มีเซลล์ยาวเกินขีดจำกัด Excel (32,767 ตัวอักษร)');}
  if(rows.length>1048576||width>16384)throw new Error('จำนวนแถวหรือคอลัมน์เกินขีดจำกัด Excel');
  if(cells>500000)throw new Error('ไฟล์ใหญ่เกิน 500,000 เซลล์ กรุณาแบ่งไฟล์ก่อน');
  entry.rows=rows;entry.cells=cells;
  entry.info.textContent=`อ่านด้วย ${decoded.encoding.toUpperCase()} · ${rows.length.toLocaleString()} แถว × สูงสุด ${width} คอลัมน์ · ตัวคั่น ${JSON.stringify(parsed.meta.delimiter)} · ตัวอย่าง 8 แถว / 12 คอลัมน์`;
  if(decoded.encoding==='windows-874'&&entry.encoding.value==='auto')entry.info.textContent+=' · เดาเป็นภาษาไทย Windows-874 กรุณาตรวจข้อความ';
  if(text.includes('�'))entry.info.textContent+=' · พบ � บางข้อความอาจเสียหายในต้นฉบับ';
  const table=document.createElement('table');for(const row of rows.slice(0,8)){const tr=table.insertRow();for(const value of row.slice(0,12))tr.insertCell().textContent=value;}entry.preview.append(table);
 }catch(error){entry.info.textContent=error.message;entry.info.classList.add('csv-error');}syncCSV();
}
function addEntry(file,bytes){
 const entry={file,bytes};entries.push(entry);const box=document.createElement('section');entry.box=box;box.className='panel csv-item';
 box.innerHTML='<div class="row"><h2 class="filename"></h2><button class="remove">ลบ</button></div><div class="csv-controls"><label>อ่านไฟล์ด้วย<select class="encoding"><option value="auto">ตรวจอัตโนมัติ (ไทย / UTF)</option><option value="utf-8">UTF-8</option><option value="windows-874">Thai · Windows-874 / TIS-620</option><option value="windows-1252">Western · Windows-1252</option><option value="utf-16le">UTF-16 LE</option><option value="utf-16be">UTF-16 BE</option></select></label><label>ซ่อมข้อความที่เพี้ยนมาแล้ว<select class="repair"><option value="none">ไม่ซ่อม (ค่าเริ่มต้น)</option><option value="windows-1252">เช่น à¸… → ภาษาไทย (Western)</option><option value="windows-874">เช่น เธ… → ภาษาไทย (Thai)</option></select></label><label>ตัวคั่นคอลัมน์<select class="delimiter"><option value="auto">ตรวจอัตโนมัติ</option><option value=",">Comma (,)</option><option value=";">Semicolon (;)</option><option value="tab">Tab</option><option value="|">Pipe (|)</option></select></label><label>ชื่อไฟล์ Excel<input class="output" maxlength="120"></label></div><p class="csv-info" role="status"></p><div class="csv-preview"></div>';
 box.querySelector('h2').textContent=file.name;for(const key of ['encoding','repair','delimiter','output'])entry[key]=box.querySelector('.'+key);entry.info=box.querySelector('.csv-info');entry.preview=box.querySelector('.csv-preview');entry.output.value=file.name.replace(/\.csv$/i,'')+'.xlsx';
 for(const key of ['encoding','repair','delimiter'])entry[key].onchange=()=>parseEntry(entry);entry.output.oninput=invalidateCSV;
 box.querySelector('button').onclick=()=>{entries.splice(entries.indexOf(entry),1);box.remove();invalidateCSV();syncCSV();};el('csvItems').append(box);parseEntry(entry);
}
el('csvFiles').onchange=async()=>{
 const files=Array.from(el('csvFiles').files);el('csvFiles').value='';if(!files.length)return;
 if(entries.length+files.length>50){statusCSV('รองรับสูงสุด 50 ไฟล์',true);return;}
 if(files.some(f=>!f.name.toLowerCase().endsWith('.csv')||f.size>10*1024*1024)){statusCSV('เลือก CSV ขนาดไม่เกิน 10 MB ต่อไฟล์',true);return;}
 if([...files,...entries.map(e=>e.file)].reduce((n,f)=>n+f.size,0)>80*1024*1024){statusCSV('ขนาดไฟล์รวมต้องไม่เกิน 80 MB',true);return;}
 working=true;syncCSV();invalidateCSV();statusCSV('กำลังอ่าน CSV…');
 try{for(const file of files)addEntry(file,new Uint8Array(await file.arrayBuffer()));statusCSV(`เลือกแล้ว ${entries.length} ไฟล์ — ตรวจภาษาและคอลัมน์ในตัวอย่างก่อนแปลง`,entries.some(e=>!e.rows));}
 catch(error){statusCSV('อ่านไฟล์ไม่สำเร็จ: '+error.message,true);}finally{working=false;syncCSV();}
};
el('clearAll').onclick=()=>{entries.length=0;el('csvItems').replaceChildren();invalidateCSV();syncCSV();statusCSV('ล้างรายการแล้ว');};
el('convert').onclick=async()=>{
 working=true;invalidateCSV();syncCSV();
 try{
  if(!entries.length||entries.some(e=>!e.rows))throw new Error('กรุณาแก้ไฟล์ที่อ่านไม่สำเร็จก่อน');
  if(entries.reduce((n,e)=>n+e.cells,0)>1000000)throw new Error('รวมเกิน 1,000,000 เซลล์ กรุณาแบ่งแปลงเป็นหลายรอบ');
  const zip=new JSZip(),used=new Set();
  for(let i=0;i<entries.length;i++){
   const entry=entries[i];statusCSV(`กำลังแปลง ${i+1} / ${entries.length}: ${entry.file.name}`);await new Promise(resolve=>setTimeout(resolve,0));
   const book=XLSX.utils.book_new(),sheet=XLSX.utils.aoa_to_sheet(entry.rows);
   // All CSV values stay strings, including =formulas, dates and leading zeros.
   sheet['!cols']=Array.from({length:Math.max(...entry.rows.slice(0,100).map(r=>r.length))},(_,c)=>({wch:Math.min(60,Math.max(10,...entry.rows.slice(0,100).map(row=>String(row[c]??'').length+2)))}));
   XLSX.utils.book_append_sheet(book,sheet,'Data');
   const base=safeName(entry.output.value.replace(/\.xlsx$/i,''));let name=base+'.xlsx',n=2;while(used.has(name.toLowerCase()))name=base+'_'+(n++)+'.xlsx';used.add(name.toLowerCase());
   zip.file(name,XLSX.write(book,{bookType:'xlsx',type:'array',compression:true}));
  }
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});downloadURL=URL.createObjectURL(blob);const link=el('csvDownload');link.href=downloadURL;link.download=safeName(el('csvZipName').value.replace(/\.zip$/i,''))+'.zip';link.hidden=false;link.click();statusCSV(`เสร็จแล้ว! ZIP มี Excel ${entries.length} ไฟล์`);
 }catch(error){statusCSV('ยังไม่สร้าง ZIP: '+error.message,true);}finally{working=false;syncCSV();}
};
if(!window.Papa||!window.XLSX||!window.JSZip){statusCSV('โหลดเครื่องมือไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ',true);el('csvFiles').disabled=true;}
