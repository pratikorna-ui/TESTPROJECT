import * as pdfjsLib from './vendor/pdf.min.mjs';
window.pdfjsLib = pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs';
const $ = id => document.getElementById(id);
const items = []; let busy = false, zipUrl;
function message(text, error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
function sync(){ $('run').disabled=busy||!items.length||items.some(i=>!i.ready); $('files').disabled=busy; document.querySelectorAll('.item input,.item textarea,.item select,.item button').forEach(el=>el.disabled=busy); }
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
async function add(file){
 const item={file,ready:false,placed:false};items.push(item);
 const box=document.createElement('section');box.className='item';box.innerHTML=`<div class="row"><h2></h2><button class="remove">ลบไฟล์</button></div><div class="editor"><div><label>หน้าที่ใส่ remark <select class="page"></select></label><label>Remark <textarea maxlength="4000" placeholder="เช่น 2C2P TH&#10;BNT from ..."></textarea></label><label>ขนาดตัวอักษร (pt) <input class="size" type="number" min="6" max="36" value="11"></label><label>ชื่อ PDF ที่ได้ <input class="name" maxlength="100"></label><p class="muted">คลิกบนหน้า PDF เพื่อวางมุมซ้ายบนของ remark พิมพ์ขึ้นบรรทัดใหม่ได้ พื้นหลัง remark โปร่งใส</p><p class="note" role="status">กำลังอ่านไฟล์…</p></div><div class="stage" aria-label="คลิกเพื่อวาง remark"><canvas></canvas><div class="overlay"></div></div></div>`;
 item.box=box;item.page=box.querySelector('.page');item.text=box.querySelector('textarea');item.size=box.querySelector('.size');item.name=box.querySelector('.name');item.canvas=box.querySelector('.stage > canvas');item.overlay=box.querySelector('.overlay');item.note=box.querySelector('.note');
 box.querySelector('h2').textContent=file.name;item.name.value=file.name.replace(/\.pdf$/i,'')+'_remarked.pdf';$('items').append(box);
 box.querySelector('.remove').onclick=()=>{if(busy)return;items.splice(items.indexOf(item),1);item.pdf?.destroy();box.remove();invalidate();sync();};
 item.text.oninput=item.size.oninput=()=>preview(item);item.name.oninput=invalidate;
 item.page.onchange=()=>showPage(item);
 const stage=box.querySelector('.stage');stage.onclick=event=>{if(busy||!item.ready)return;const rect=stage.getBoundingClientRect();item.x=(event.clientX-rect.left)/rect.width*item.view.width;item.y=(event.clientY-rect.top)/rect.height*item.view.height;item.placed=true;preview(item);};
 try{
  item.bytes=new Uint8Array(await file.arrayBuffer());
  // Disable PDF JavaScript evaluation; no document actions are executed.
  item.pdf=await pdfjsLib.getDocument({data:item.bytes.slice(),isEvalSupported:false,password:''}).promise;
  for(let n=1;n<=item.pdf.numPages;n++)item.page.add(new Option(`${n} / ${item.pdf.numPages}`,n));
  await showPage(item);
 }catch(e){item.note.textContent='เปิด PDF ไม่ได้: ไฟล์อาจเสียหายหรือมีรหัสผ่าน กรุณาลบออกและเลือกไฟล์อื่น';item.note.classList.add('error');}sync();
}
$('files').onchange=async()=>{
 const files=Array.from($('files').files);$('files').value='';
 if(items.length+files.length>10){message('รองรับสูงสุด 10 ไฟล์ กรุณาลดจำนวนไฟล์',true);return;}
 if(files.some(f=>!f.name.toLowerCase().endsWith('.pdf')||f.size>20*1024*1024)){message('เลือกเฉพาะ PDF ขนาดไม่เกิน 20 MB ต่อไฟล์',true);return;}
 if([...items.map(i=>i.file),...files].reduce((n,f)=>n+f.size,0)>80*1024*1024){message('ขนาดไฟล์รวมต้องไม่เกิน 80 MB',true);return;}
 busy=true;invalidate();sync();for(const file of files)await add(file);busy=false;sync();message(`เลือกแล้ว ${items.length} / 10 ไฟล์ — ใส่ remark และคลิกตำแหน่งให้ครบก่อน Run`);
};
$('run').onclick=async()=>{
 busy=true;sync();invalidate();
 try{
  const prepared=items.map(item=>{if(!item.placed)throw new Error(`${item.file.name}: กรุณาคลิกเลือกพื้นที่ว่างก่อน`);try{return {item,image:remark(item)};}catch(e){throw new Error(`${item.file.name}: ${e.message}`);}});
  const zip=new JSZip();const used=new Set();
  for(let n=0;n<prepared.length;n++){
   const {item,image}=prepared[n];message(`กำลังใส่ remark ${n+1} / ${items.length}: ${item.file.name}`);
   const doc=await PDFLib.PDFDocument.load(item.bytes);
   if(doc.getForm().getFields().some(field=>field instanceof PDFLib.PDFSignature))throw new Error(`${item.file.name}: มีช่องลายเซ็นดิจิทัล ไม่แก้ไขไฟล์นี้`);
   const page=doc.getPage(Number(item.page.value)-1),png=await doc.embedPng(image.canvas.toDataURL('image/png'));
   const [x,y]=item.view.convertToPdfPoint(item.x,item.y+image.height);
   page.drawImage(png,{x,y,width:image.width,height:image.height,rotate:PDFLib.degrees(page.getRotation().angle)});
   let base=clean(item.name.value.replace(/\.pdf$/i,'')),name=base+'.pdf',suffix=2;while(used.has(name.toLowerCase()))name=base+'_'+(suffix++)+'.pdf';used.add(name.toLowerCase());
   zip.file(name,await doc.save());
  }
  message('กำลังสร้าง ZIP…');const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});zipUrl=URL.createObjectURL(blob);
  const a=$('download');a.href=zipUrl;a.download=clean($('zipname').value.replace(/\.zip$/i,''))+'.zip';a.hidden=false;a.click();message(`เสร็จแล้ว! ZIP มี PDF ที่ใส่ remark ${items.length} ไฟล์`);
 }catch(e){message('ยังไม่สร้าง ZIP: '+e.message,true);}finally{busy=false;sync();}
};
