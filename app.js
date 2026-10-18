let pdfjsLib, enginePromise;
async function engine(){
 if(!enginePromise)enginePromise=import('./vendor/pdf.min.js').then(lib=>{pdfjsLib=lib;window.pdfjsLib=lib;lib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';return lib;}).catch(error=>{enginePromise=null;throw new Error('โหลดเครื่องมือ PDF ไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ หรือใช้ Chrome / Edge รุ่นล่าสุด');});
 return enginePromise;
}
const $ = id => document.getElementById(id);
const items = []; let busy = false, zipUrl;
function message(text, error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function sync(){ const active=items.filter(i=>i.file);$('run').disabled=busy||!active.length||active.some(i=>!i.ready);document.querySelectorAll('.item input,.item textarea,.item select,.item button').forEach(el=>el.disabled=busy); }
function invalidate(){if(zipUrl){URL.revokeObjectURL(zipUrl);zipUrl=null;}$('download').hidden=true;}
function clean(name){return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\.+/,'').trim()||'document';}
function remark(item){
 const text=item.text.value.trim(); if(!text)throw new Error('กรุณาใส่ remark');
 const size=Number(item.size.value); if(!Number.isFinite(size)||size<6||size>36)throw new Error('ขนาดตัวอักษรต้องอยู่ระหว่าง 6–36 pt');
 const width=item.view.width-item.x-12; if(width<30)throw new Error('ตำแหน่งชิดขอบขวาเกินไป กรุณาคลิกใหม่');
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 ctx.font=`${size}px sans-serif`; const lines=[];
 for(const paragraph of text.split(/\r?\n/)){
  let line='';
  const parts= typeof Intl.Segmenter==='function' ? Array.from(new Intl.Segmenter('th',{granularity:'grapheme'}).segment(paragraph),s=>s.segment):Array.from(paragraph);
  for(const char of parts){if(ctx.measureText(line+char).width>width && line){lines.push(line);line=char;}else line+=char;} lines.push(line);
 }
 const height=(lines.length*1.6+.5)*size;
 if(item.y+height>item.view.height-8)throw new Error('ข้อความยาวเกินพื้นที่ด้านล่าง ย้ายตำแหน่งขึ้นหรือลดขนาดตัวอักษร');
 const actualWidth=Math.min(width,Math.max(1,...lines.map(line=>ctx.measureText(line).width))+2);
 canvas.width=Math.ceil(actualWidth*3);canvas.height=Math.ceil(height*3);ctx.scale(3,3);ctx.font=`${size}px sans-serif`;ctx.fillStyle='#000';ctx.textBaseline='alphabetic';
 lines.forEach((line,index)=>ctx.fillText(line,0,size*1.3+index*size*1.6));
 return {canvas,width:actualWidth,height};
}
function preview(item){
 invalidate(); item.overlay.replaceChildren();item.note.classList.remove('error');
 if(!item.view)return;
 try{
  const r=remark(item);item.overlay.append(r.canvas);Object.assign(item.overlay.style,{left:`${item.x/item.view.width*100}%`,top:`${item.y/item.view.height*100}%`,width:`${r.width/item.view.width*100}%`,height:`${r.height/item.view.height*100}%`});
  item.note.textContent=item.placed?'✓ เลือกตำแหน่งแล้ว — ตรวจดูว่าไม่ทับข้อมูลเดิม':'คลิกพื้นที่ว่างบน PDF เพื่อยืนยันตำแหน่ง remark';
 }catch(e){item.note.textContent=e.message;item.note.classList.add('error');}
}
async function showPage(item){
 item.ready=false;item.view=null;item.placed=false;sync();
 try{
  const page=await item.pdf.getPage(Number(item.page.value));item.view=page.getViewport({scale:1});
  item.x=item.view.width*.08;item.y=item.view.height*.4;
  const scale=Math.min(1.5,1400/item.view.width);const view=page.getViewport({scale});item.canvas.width=Math.ceil(view.width);item.canvas.height=Math.ceil(view.height);
  await page.render({canvasContext:item.canvas.getContext('2d'),viewport:view}).promise;
  item.ready=true;preview(item);
 }catch(e){item.note.textContent='แสดงหน้า PDF ไม่สำเร็จ กรุณาลบไฟล์นี้แล้วเลือกใหม่';item.note.classList.add('error');}finally{sync();}
}
function clear(item,keepInput=false){
 item.pdf?.destroy();item.pdf=null;item.file=null;item.bytes=null;item.ready=false;item.view=null;item.placed=false;if(!keepInput)item.fileInput.value='';item.page.replaceChildren();item.overlay.replaceChildren();item.details.hidden=true;item.note.classList.remove('error');item.note.textContent='ยังไม่ได้เลือกไฟล์';invalidate();sync();
}
for(const box of document.querySelectorAll('.item')){
 const item={box,file:null,ready:false,placed:false};items.push(item);
 item.fileInput=box.querySelector('.file');item.page=box.querySelector('.page');item.text=box.querySelector('textarea');item.size=box.querySelector('.size');item.name=box.querySelector('.name');item.canvas=box.querySelector('.stage > canvas');item.overlay=box.querySelector('.overlay');item.note=box.querySelector('.note');item.details=box.querySelector('details');
 box.querySelector('.remove').onclick=()=>{if(busy)return;clear(item);item.text.value='';item.name.value='';};
 item.text.oninput=item.size.oninput=()=>preview(item);item.name.oninput=invalidate;
 item.page.onchange=async()=>{busy=true;sync();try{await showPage(item);}finally{busy=false;sync();}};
 const stage=box.querySelector('.stage');stage.onclick=event=>{if(busy||!item.ready)return;const rect=stage.getBoundingClientRect();item.x=(event.clientX-rect.left)/rect.width*item.view.width;item.y=(event.clientY-rect.top)/rect.height*item.view.height;item.placed=true;preview(item);};
 item.fileInput.onchange=async()=>{
  const file=item.fileInput.files[0];if(!file)return;
  clear(item,true);item.file=file;invalidate();sync();
  if(!file.name.toLowerCase().endsWith('.pdf')||file.size>20*1024*1024){item.note.textContent='เลือกเฉพาะ PDF ขนาดไม่เกิน 20 MB';item.note.classList.add('error');return;}
  if(items.reduce((sum,i)=>sum+(i.file?.size||0),0)>80*1024*1024){item.note.textContent='ขนาดไฟล์รวมเกิน 80 MB กรุณาล้างช่องนี้';item.note.classList.add('error');return;}
  busy=true;sync();item.note.textContent='กำลังเปิด '+file.name+'…';message('กำลังโหลดตัวอย่าง PDF…');
  try{
   await engine();item.bytes=new Uint8Array(await file.arrayBuffer());
   item.pdf=await pdfjsLib.getDocument({data:item.bytes.slice(),isEvalSupported:false,password:''}).promise;
   for(let n=1;n<=item.pdf.numPages;n++)item.page.add(new Option(`${n} / ${item.pdf.numPages}`,n));
   item.name.value=file.name.replace(/\.pdf$/i,'')+'_remarked.pdf';item.details.hidden=false;item.details.open=true;
   await showPage(item);
   message(`เลือกแล้ว ${items.filter(i=>i.file).length} / 10 ไฟล์ — ใส่ remark และคลิกพื้นที่ว่างในแต่ละ PDF`);
  }catch(e){item.note.textContent='เปิด PDF ไม่สำเร็จ: '+(e.name==='PasswordException'?'ไฟล์มีรหัสผ่าน':e.message);item.note.classList.add('error');message('โหลดไฟล์ไม่สำเร็จ ดูข้อความในช่องที่เลือก แล้วลองใหม่ได้',true);}
  finally{busy=false;sync();}
 };
}
sync();
$('run').onclick=async()=>{
 busy=true;sync();invalidate();
 try{
  const prepared=items.filter(item=>item.file).map(item=>{if(!item.placed)throw new Error(`${item.file.name}: กรุณาคลิกเลือกพื้นที่ว่างก่อน`);try{return {item,image:remark(item)};}catch(e){throw new Error(`${item.file.name}: ${e.message}`);}});
  const zip=new JSZip();const used=new Set();
  for(let n=0;n<prepared.length;n++){
   const {item,image}=prepared[n];message(`กำลังใส่ remark ${n+1} / ${prepared.length}: ${item.file.name}`);
   const doc=await PDFLib.PDFDocument.load(item.bytes);
   if(doc.getForm().getFields().some(field=>field instanceof PDFLib.PDFSignature))throw new Error(`${item.file.name}: มีช่องลายเซ็นดิจิทัล ไม่แก้ไขไฟล์นี้`);
   const page=doc.getPage(Number(item.page.value)-1),png=await doc.embedPng(image.canvas.toDataURL('image/png'));
   const [x,y]=item.view.convertToPdfPoint(item.x,item.y+image.height);
   page.drawImage(png,{x,y,width:image.width,height:image.height,rotate:PDFLib.degrees(page.getRotation().angle)});
   let base=clean(item.name.value.replace(/\.pdf$/i,'')),name=base+'.pdf',suffix=2;while(used.has(name.toLowerCase()))name=base+'_'+(suffix++)+'.pdf';used.add(name.toLowerCase());
   zip.file(name,await doc.save());
  }
  message('กำลังสร้าง ZIP…');const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});zipUrl=URL.createObjectURL(blob);
  const a=$('download');a.href=zipUrl;a.download=clean($('zipname').value.replace(/\.zip$/i,''))+'.zip';a.hidden=false;a.click();message(`เสร็จแล้ว! ZIP มี PDF ที่ใส่ remark ${prepared.length} ไฟล์`);
 }catch(e){message('ยังไม่สร้าง ZIP: '+e.message,true);}finally{busy=false;sync();}
};

window.remarkAppReady=true;
