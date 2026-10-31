'use strict';
const byId=id=>document.getElementById(id), RULE_KEY='project03-acq-rules-v1';
const defaults=()=>[
 {name:'WeChat',mode:'AND',conditions:[{column:'AC',op:'in',value:'WC\nWQ'}]},
 {name:'Diners',mode:'AND',conditions:[{column:'AC',op:'in',value:'DI\nDN'}]},
 {name:'Mastercard',mode:'AND',conditions:[{column:'AC',op:'in',value:'MA'},{column:'P',op:'contains',value:'2C2P ACQ -\n2C2P MC'}]},
 {name:'EQ PP',mode:'AND',conditions:[{column:'AC',op:'in',value:'EQ'},{column:'E',op:'blank',value:''}]},
 {name:'Alipay NEW THB',mode:'AND',conditions:[{column:'P',op:'in',value:'Alipay - THB (NEW)'}]},
 {name:'EQ Mastercard',mode:'AND',conditions:[{column:'AC',op:'in',value:'EQ'},{column:'E',op:'startswith',value:'5'}]},
 {name:'UPOP',mode:'AND',conditions:[{column:'AC',op:'in',value:'UP\nCP'},{column:'P',op:'contains',value:'2C2P ACQ -\n2C2P UPI\nUPOP'}]},
 {name:'JCB',mode:'AND',conditions:[{column:'AC',op:'in',value:'JC'},{column:'P',op:'contains',value:'2C2P ACQ -\n2C2P JCB'}]},
 {name:'MCP Project',mode:'AND',conditions:[{column:'B',op:'contains',value:'MCP'}],alternatives:[
  {mode:'AND',conditions:[{column:'B',op:'contains',value:'(MCC'},{column:'P',op:'contains',value:'BBL'}]},
  {mode:'AND',conditions:[{column:'B',op:'in',value:'Bangkok Airways - 1A [USD]'},{column:'P',op:'contains',value:'BBL'},{column:'G',op:'notin',value:'USD'}]},
  {mode:'AND',conditions:[{column:'P',op:'contains',value:'onyx'},{column:'G',op:'notin',value:'THB'}]},
  {mode:'AND',conditions:[{column:'P',op:'contains',value:'vfs'},{column:'G',op:'notin',value:'THB'}]}
 ]}
];


let source=null, range=null, results=null, pending=false, outputUrl=null, loaded=false;
let worker=null, requestId=0, current=null;
function notify(text,error=false){byId('acqStatus').textContent=text;byId('acqStatus').classList.toggle('error',error);byId('workStatus').textContent=text;}
function invalidate(){results=null;byId('result').replaceChildren();byId('exportAcq').disabled=true;if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=null;byId('acqDownload').hidden=true;}
function lock(value){pending=value;document.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=value);byId('cancelWork').disabled=!value;byId('cancelBottom').disabled=!value;byId('masterSheet').disabled=value||!loaded;byId('check').disabled=value||!loaded;byId('exportAcq').disabled=value||!results;byId('workProgress').hidden=!value;if(value)byId('workProgress').removeAttribute('value');}
function stopWorker(reason){if(worker)worker.terminate();worker=null;loaded=false;const request=current;current=null;if(request)request.reject(new Error(reason));lock(false);}
function runWorker(action,extra={}){
 if(!worker){worker=new Worker('acq-worker.js?v=source-date-1');const instance=worker;worker.onmessage=({data})=>{if(worker!==instance)return;
  if(data.type==='progress'){notify(data.text);if(data.total){byId('workProgress').max=data.total;byId('workProgress').value=data.done;}else byId('workProgress').removeAttribute('value');return;}
  if(!current||data.id!==current.id)return;const request=current;current=null;if(data.type==='error')request.reject(new Error(data.error));else request.resolve(data.result);
 };worker.onerror=()=>{stopWorker('เครื่องมือประมวลผลหยุดทำงาน อาจมีหน่วยความจำไม่พอ กดอ่านไฟล์ใหม่เพื่อลองอีกครั้ง');notify('เครื่องมือประมวลผลหยุดทำงาน กดอ่านไฟล์ใหม่เพื่อลองอีกครั้ง',true);};}
 return new Promise((resolve,reject)=>{const id=++requestId;current={id,resolve,reject};worker.postMessage({id,action,...extra});});
}
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function addCondition(box,condition={column:'',op:'in',value:''}){
 if(box.querySelector('.conditions').children.length>=20){notify('แต่ละ ACQ รองรับสูงสุด 20 เงื่อนไข',true);return;}
 const line=node('div');line.className='condition';line.innerHTML='<label>คอลัมน์<input class="column" placeholder="AC" maxlength="3" aria-label="ตำแหน่งคอลัมน์"></label><label>เงื่อนไข<select class="operator"><option value="in">ตรงกับค่าใดค่าหนึ่ง</option><option value="notin">ไม่ตรงกับทุกค่าที่ระบุ</option><option value="contains">มีข้อความใดข้อความหนึ่ง</option><option value="startswith">ขึ้นต้นด้วยค่าใดค่าหนึ่ง</option><option value="blank">ว่าง</option><option value="notblank">ไม่ว่าง</option></select></label><label>ค่า (ขึ้นบรรทัดใหม่ / comma)<textarea class="values" maxlength="4000"></textarea></label><button class="remove" type="button">ลบเงื่อนไข</button>';
 line.querySelector('.column').value=condition.column;line.querySelector('.operator').value=condition.op;line.querySelector('.values').value=condition.value;
 line.querySelector('button').onclick=()=>{line.remove();invalidate();};
 const toggle=()=>{line.querySelector('.values').hidden=['blank','notblank'].includes(line.querySelector('.operator').value);};line.querySelector('select').addEventListener('change',toggle);toggle();box.querySelector('.conditions').append(line);invalidate();
}
function addGroup(rule={name:'ACQ ใหม่',mode:'AND',conditions:[{column:'',op:'in',value:''}]}){
 if(byId('groups').children.length>=30){notify('รองรับสูงสุด 30 ACQ',true);return;}
 const box=node('section');box.className='acq-group';box.innerHTML='<div class="group-head"><label>ชื่อ ACQ <input class="group-name" maxlength="80"></label><label>ระหว่างเงื่อนไข <select class="mode"><option value="AND">AND · ต้องตรงทุกเงื่อนไข</option><option value="OR">OR · ตรงอย่างน้อยหนึ่งเงื่อนไข</option></select></label><button class="remove delete-group">ลบ ACQ</button></div><div class="conditions"></div><button class="add-condition">＋ เพิ่มเงื่อนไข</button>';
 box.querySelector('.group-name').value=rule.name;box.querySelector('.mode').value=rule.mode;box.querySelector('.delete-group').onclick=()=>{box.remove();invalidate();};box.querySelector('.add-condition').onclick=()=>addCondition(box);byId('groups').append(box);rule.conditions.forEach(c=>addCondition(box,c));const alternatives=node('div');alternatives.className='alternatives';box.append(alternatives);const add=node('button','＋ เพิ่มกลุ่มทางเลือก (OR)');add.className='add-alternative';add.onclick=()=>addAlternative(box);box.append(add);(rule.alternatives||[]).forEach(branch=>addAlternative(box,branch));invalidate();
}
function addAlternative(box,branch={mode:'AND',conditions:[{column:'',op:'in',value:''}]}){
 if(box.querySelectorAll('.alternative').length>=9){notify('รองรับสูงสุด 10 กลุ่มทางเลือกต่อ ACQ',true);return;}
 const part=node('section');part.className='alternative';part.innerHTML='<p><strong>หรือ (OR) กลุ่มทางเลือกนี้</strong></p><label>ภายในกลุ่ม <select class="branch-mode"><option value="AND">AND · ต้องตรงทุกเงื่อนไข</option><option value="OR">OR · อย่างน้อยหนึ่งเงื่อนไข</option></select></label><div class="conditions"></div><button class="branch-add">＋ เพิ่มเงื่อนไข</button> <button class="remove branch-remove">ลบกลุ่มทางเลือก</button>';
 part.querySelector('.branch-mode').value=branch.mode;part.querySelector('.branch-add').onclick=()=>addCondition(part);part.querySelector('.branch-remove').onclick=()=>{part.remove();invalidate();};box.querySelector('.alternatives').append(part);branch.conditions.forEach(c=>addCondition(part,c));invalidate();
}
function readRules(validate=true){
 const readBranch=(part,mode)=>({mode,conditions:Array.from(part.querySelector('.conditions').children,line=>({column:line.querySelector('.column').value.trim().toUpperCase(),op:line.querySelector('.operator').value,value:line.querySelector('.values').value}))});
 const rules=Array.from(byId('groups').children,box=>({name:box.querySelector('.group-name').value.trim(),...readBranch(box,box.querySelector('.mode').value),alternatives:Array.from(box.querySelectorAll('.alternative'),part=>readBranch(part,part.querySelector('.branch-mode').value))}));
 if(validate){if(!rules.length)throw new Error('เพิ่ม ACQ อย่างน้อย 1 กลุ่ม');const names=new Set();for(const rule of rules){if(!rule.name)throw new Error('กรุณาตั้งชื่อทุก ACQ');if(names.has(rule.name.toLowerCase()))throw new Error('ชื่อ ACQ ซ้ำ: '+rule.name);names.add(rule.name.toLowerCase());for(const branch of [rule,...rule.alternatives]){if(!branch.conditions.length)throw new Error(rule.name+': ทุกกลุ่มทางเลือกต้องมีอย่างน้อย 1 เงื่อนไข');for(const c of branch.conditions){if(!/^[A-Z]{1,3}$/.test(c.column)||XLSX.utils.decode_col(c.column)>16383)throw new Error(rule.name+': คอลัมน์ต้องเป็น A ถึง XFD');if(!['blank','notblank'].includes(c.op)&&!c.value.split(/[,\r\n]+/).some(v=>v.trim()))throw new Error(rule.name+': กรุณาระบุค่าเงื่อนไข');}}}}return rules;
}
function validBranch(branch){return branch&&['AND','OR'].includes(branch.mode)&&Array.isArray(branch.conditions)&&branch.conditions.length>0&&branch.conditions.length<=20&&branch.conditions.every(c=>typeof c.column==='string'&&typeof c.value==='string'&&['in','notin','contains','startswith','blank','notblank'].includes(c.op));}
function headerCount(){const count=Number(byId('headerEnd').value);if(!Number.isInteger(count)||count<0||count>100)throw new Error('หัวตารางต้องเป็นจำนวนเต็ม 0–100');return count;}
function tablePreview(rows){const table=node('table');if(!range)return table;const head=table.insertRow();for(let c=0;c<Math.min(range.e.c+1,60);c++){const cell=head.insertCell();cell.textContent=XLSX.utils.encode_col(c);cell.className='col-heading';}for(const row of rows){const tr=table.insertRow();for(const value of row)tr.insertCell().textContent=value;}return table;}
async function loadMaster(){
 if(pending)return;invalidate();loaded=false;range=null;byId('masterPreview').replaceChildren();
 if(!source){lock(false);return;}
 lock(true);notify('กำลังเปิดตัวอย่าง MASTER…');
 try{
  if(!/\.(xlsx|xls|csv)$/i.test(source.name))throw new Error('รองรับ .xlsx / .xls / .csv');if(source.size>100*1024*1024)throw new Error('ไฟล์ขนาด '+(source.size/1024/1024).toFixed(1)+' MB เกินขีดจำกัด 100 MB');
  const answer=await runWorker('load',{file:source,encoding:byId('masterEncoding').value,headers:headerCount(),sheet:byId('masterSheet').value});
  byId('masterSheet').replaceChildren();answer.names.forEach(name=>byId('masterSheet').add(new Option(name,name)));byId('masterSheet').value=answer.sheet;range=answer.range;loaded=true;
  byId('masterPreview').replaceChildren(tablePreview(answer.preview));byId('masterPreview').closest('details').open=true;
  byId('masterInfo').textContent=`${source.name} · ${answer.sheet} · ตัวอย่างสูงสุด 20 แถวข้อมูล / 60 คอลัมน์ · ไฟล์จริงจะอ่านครบทุกแถวและทุกคอลัมน์เมื่อกดตรวจผล`;
  notify('ตัวอย่างพร้อมแล้ว — ตรวจหัวตารางและกฎ จากนั้นกดตรวจผลเพื่ออ่านครบทั้งไฟล์');
 }catch(e){byId('masterInfo').textContent='เปิด MASTER ไม่สำเร็จ: '+e.message;notify(e.message,true);}finally{lock(false);}
}
async function checkRules(){
 if(pending)return;invalidate();lock(true);
 try{
  const rules=readRules();results=await runWorker('check',{rules,normalize:byId('normalize').checked});range=results.range;
  const table=node('table');let tr=table.insertRow();for(const name of ['ACQ','จำนวนรายการ'])tr.append(node('th',name));for(const g of results.groups){tr=table.insertRow();tr.insertCell().textContent=g.name;tr.insertCell().textContent=g.count.toLocaleString();}tr=table.insertRow();tr.insertCell().textContent='Unmatched';tr.insertCell().textContent=results.unmatched.toLocaleString();byId('result').append(table);
  for(const g of results.groups){const details=node('details');details.append(node('summary',`ตัวอย่าง ${g.name} (${g.count.toLocaleString()} รายการ · สูงสุด 20 แถว / 60 คอลัมน์)`));const scroll=node('div');scroll.className='csv-preview';scroll.append(tablePreview(g.preview));details.append(scroll);byId('result').append(details);}
  notify(`ตรวจแล้ว ${results.count.toLocaleString()} รายการ · เข้ากฎแบบไม่นับซ้ำ ${results.unique.toLocaleString()} · ไม่เข้ากฎ ${results.unmatched.toLocaleString()} · ตรงหลาย ACQ ${results.overlap.toLocaleString()} รายการ`);
 }catch(e){results=null;notify(e.message,true);}finally{lock(false);}
}
async function exportResults(){
 if(pending||!results)return;lock(true);
 try{const blob=await runWorker('export',{partRows:Number(byId('partRows').value)});outputUrl=URL.createObjectURL(blob);const link=byId('acqDownload');link.href=outputUrl;link.download=source.name.replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]/g,'_')+'_ACQ.zip';link.hidden=false;link.click();notify(results.unique?'เสร็จแล้ว! ZIP มีเฉพาะรายการตรง ACQ พร้อม Summary (ไม่มีไฟล์ Unmatched)':'ไม่มีรายการตรงกฎ ZIP มีเฉพาะ Summary สำหรับตรวจจำนวน');}
 catch(e){notify('ยังไม่สร้าง ZIP: '+e.message,true);}finally{lock(false);}
}
byId('master').onchange=()=>{source=byId('master').files[0]||null;byId('masterSheet').replaceChildren();loadMaster();};byId('masterSheet').onchange=loadMaster;byId('headerEnd').onchange=loadMaster;byId('masterEncoding').onchange=loadMaster;byId('reloadMaster').onclick=loadMaster;
byId('partRows').onchange=()=>{if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=null;byId('acqDownload').hidden=true;};
byId('cancelWork').onclick=()=>{stopWorker('ยกเลิกแล้ว กดอ่านไฟล์ใหม่เพื่อเริ่มอีกครั้ง');invalidate();notify('ยกเลิกแล้ว — ข้อมูลต้นฉบับยังอยู่ กดอ่านไฟล์ใหม่เพื่อเริ่มอีกครั้ง');};
byId('cancelBottom').onclick=()=>byId('cancelWork').onclick();
byId('groups').addEventListener('input',invalidate);byId('groups').addEventListener('change',invalidate);byId('normalize').onchange=invalidate;byId('addGroup').onclick=()=>addGroup();byId('check').onclick=checkRules;byId('exportAcq').onclick=exportResults;
byId('saveRules').onclick=()=>{try{const rules=readRules();localStorage.setItem(RULE_KEY,JSON.stringify({rules,normalize:byId('normalize').checked}));byId('rulesStatus').textContent='บันทึกกฎแล้วในเบราว์เซอร์นี้ (ไม่เก็บข้อมูล MASTER)';}catch(e){byId('rulesStatus').textContent='บันทึกไม่ได้: '+e.message;}};
byId('resetRules').onclick=()=>{byId('groups').replaceChildren();defaults().forEach(addGroup);byId('normalize').checked=true;try{localStorage.removeItem(RULE_KEY);}catch{}byId('rulesStatus').textContent='คืนกฎเริ่มต้นแล้ว';invalidate();};
try{const saved=JSON.parse(localStorage.getItem(RULE_KEY));if(saved&&Array.isArray(saved.rules)&&saved.rules.length<=30&&saved.rules.every(r=>typeof r.name==='string'&&validBranch(r)&&(!r.alternatives||Array.isArray(r.alternatives)&&r.alternatives.length<=9&&r.alternatives.every(validBranch)))){const existing=new Set(saved.rules.map(r=>r.name.trim().toLowerCase()));saved.rules.forEach(addGroup);const added=defaults().filter(r=>!existing.has(r.name.toLowerCase()));added.forEach(addGroup);byId('normalize').checked=saved.normalize!==false;byId('rulesStatus').textContent='โหลดกฎเดิมแล้ว พร้อมเพิ่ม ACQ ใหม่ที่ยังไม่มี (กฎเดิมของคุณยังอยู่)';}else defaults().forEach(addGroup);}catch{byId('groups').replaceChildren();defaults().forEach(addGroup);}
lock(false);
