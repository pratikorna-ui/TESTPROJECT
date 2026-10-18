'use strict';
const byId=id=>document.getElementById(id), RULE_KEY='project03-acq-rules-v1';
const defaults=()=>[
 {name:'WeChat',mode:'AND',conditions:[{column:'AC',op:'in',value:'WC\nWQ'}]},
 {name:'Diners',mode:'AND',conditions:[{column:'AC',op:'in',value:'DI\nDN'}]},
 {name:'Mastercard',mode:'AND',conditions:[{column:'AC',op:'in',value:'MA'},{column:'P',op:'contains',value:'2C2P ACQ -\n2C2P MC'}]},
 {name:'EQ PP',mode:'AND',conditions:[{column:'AC',op:'in',value:'EQ'},{column:'E',op:'blank',value:''}]},
 {name:'Alipay NEW THB',mode:'AND',conditions:[{column:'P',op:'in',value:'Alipay - THB (NEW)'}]},
 {name:'EQ Mastercard',mode:'AND',conditions:[{column:'AC',op:'in',value:'EQ'},{column:'E',op:'startswith',value:'5'}]},
 {name:'UPOP',mode:'AND',conditions:[{column:'AC',op:'in',value:'UP\nCP'},{column:'P',op:'contains',value:'2C2P ACQ -\n2C2P UPI\nUPOP'}]}
];
const MAX_INPUT_CELLS=5000000, MAX_OUTPUT_CELLS=10000000;

let source=null, book=null, sheet=null, range=null, dataRows=[], results=null, pending=false, outputUrl=null;
function notify(text,error=false){byId('acqStatus').textContent=text;byId('acqStatus').classList.toggle('error',error);}
function invalidate(){results=null;byId('result').replaceChildren();byId('exportAcq').disabled=true;if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=null;byId('acqDownload').hidden=true;}
function lock(value){pending=value;document.querySelectorAll('input,select,textarea,button').forEach(e=>e.disabled=value);byId('masterSheet').disabled=value||!book;byId('check').disabled=value||!sheet;byId('exportAcq').disabled=value||!results;}
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function addCondition(box,condition={column:'',op:'in',value:''}){
 if(box.querySelectorAll('.condition').length>=20){notify('แต่ละ ACQ รองรับสูงสุด 20 เงื่อนไข',true);return;}
 const line=node('div');line.className='condition';line.innerHTML='<label>คอลัมน์<input class="column" placeholder="AC" maxlength="3" aria-label="ตำแหน่งคอลัมน์"></label><label>เงื่อนไข<select class="operator"><option value="in">ตรงกับค่าใดค่าหนึ่ง</option><option value="notin">ไม่ตรงกับทุกค่าที่ระบุ</option><option value="contains">มีข้อความใดข้อความหนึ่ง</option><option value="startswith">ขึ้นต้นด้วยค่าใดค่าหนึ่ง</option><option value="blank">ว่าง</option><option value="notblank">ไม่ว่าง</option></select></label><label>ค่า (ขึ้นบรรทัดใหม่ / comma)<textarea class="values" maxlength="4000"></textarea></label><button class="remove" type="button">ลบเงื่อนไข</button>';
 line.querySelector('.column').value=condition.column;line.querySelector('.operator').value=condition.op;line.querySelector('.values').value=condition.value;
 line.querySelector('button').onclick=()=>{line.remove();invalidate();};
 const toggle=()=>{line.querySelector('.values').hidden=['blank','notblank'].includes(line.querySelector('.operator').value);};line.querySelector('select').addEventListener('change',toggle);toggle();box.querySelector('.conditions').append(line);invalidate();
}
function addGroup(rule={name:'ACQ ใหม่',mode:'AND',conditions:[{column:'',op:'in',value:''}]}){
 if(byId('groups').children.length>=30){notify('รองรับสูงสุด 30 ACQ',true);return;}
 const box=node('section');box.className='acq-group';box.innerHTML='<div class="group-head"><label>ชื่อ ACQ <input class="group-name" maxlength="80"></label><label>ระหว่างเงื่อนไข <select class="mode"><option value="AND">AND · ต้องตรงทุกเงื่อนไข</option><option value="OR">OR · ตรงอย่างน้อยหนึ่งเงื่อนไข</option></select></label><button class="remove delete-group">ลบ ACQ</button></div><div class="conditions"></div><button class="add-condition">＋ เพิ่มเงื่อนไข</button>';
 box.querySelector('.group-name').value=rule.name;box.querySelector('.mode').value=rule.mode;box.querySelector('.delete-group').onclick=()=>{box.remove();invalidate();};box.querySelector('.add-condition').onclick=()=>addCondition(box);byId('groups').append(box);rule.conditions.forEach(c=>addCondition(box,c));invalidate();
}
function readRules(validate=true){
 const rules=Array.from(byId('groups').children,box=>({name:box.querySelector('.group-name').value.trim(),mode:box.querySelector('.mode').value,conditions:Array.from(box.querySelectorAll('.condition'),line=>({column:line.querySelector('.column').value.trim().toUpperCase(),op:line.querySelector('.operator').value,value:line.querySelector('.values').value}))}));
 if(validate){if(!rules.length)throw new Error('เพิ่ม ACQ อย่างน้อย 1 กลุ่ม');const names=new Set();for(const rule of rules){if(!rule.name)throw new Error('กรุณาตั้งชื่อทุก ACQ');if(names.has(rule.name.toLowerCase()))throw new Error('ชื่อ ACQ ซ้ำ: '+rule.name);names.add(rule.name.toLowerCase());if(!rule.conditions.length)throw new Error(rule.name+': ต้องมีอย่างน้อย 1 เงื่อนไข');for(const c of rule.conditions){if(!/^[A-Z]{1,3}$/.test(c.column)||XLSX.utils.decode_col(c.column)>16383)throw new Error(rule.name+': ตำแหน่งคอลัมน์ต้องเป็น A ถึง XFD');if(range&&XLSX.utils.decode_col(c.column)>range.e.c)throw new Error(rule.name+': คอลัมน์ '+c.column+' อยู่นอกข้อมูล MASTER');if(!['blank','notblank'].includes(c.op)&&!c.value.split(/[,\r\n]+/).some(v=>v.trim()))throw new Error(rule.name+': กรุณาระบุค่าเงื่อนไข');}}}return rules;
}
function headerCount(){const count=Number(byId('headerEnd').value);if(!Number.isInteger(count)||count<0||count>100)throw new Error('หัวตารางต้องเป็นจำนวนเต็ม 0–100');return count;}
function textAt(row,column){const cell=sheet[XLSX.utils.encode_cell({r:row,c:column})];if(!cell)return '';return cell.w!==undefined?String(cell.w):String(cell.v??'');}
function tablePreview(rows,limit=8){const table=node('table');const head=table.insertRow();for(let c=0;c<=range.e.c;c++){const cell=head.insertCell();cell.textContent=XLSX.utils.encode_col(c);cell.className='col-heading';}for(const r of rows.slice(0,limit)){const tr=table.insertRow();for(let c=0;c<=range.e.c;c++)tr.insertCell().textContent=textAt(r,c);}return table;}
function selectSheet(){
 invalidate();sheet=null;range=null;dataRows=[];
 try{
  if(!book)return;const selected=book.Sheets[byId('masterSheet').value];if(!selected?.['!ref'])throw new Error('แผ่นงานว่าง');const bounds=XLSX.utils.decode_range(selected['!ref']);
  if(bounds.e.r>=1048576||bounds.e.c>=16384||(bounds.e.r+1)*(bounds.e.c+1)>MAX_INPUT_CELLS)throw new Error('พื้นที่ตารางเกิน 5,000,000 เซลล์ กรุณาลดขนาด MASTER');
  sheet=selected;range=bounds;const headers=headerCount();
  for(let r=headers;r<=range.e.r;r++){let nonempty=false;for(let c=0;c<=range.e.c;c++){const v=sheet[XLSX.utils.encode_cell({r,c})]?.v;if(v!==undefined&&v!==null&&v!==''){nonempty=true;break;}}if(nonempty)dataRows.push(r);}
  if(!dataRows.length)throw new Error('ไม่มีรายการหลังแถวหัวตาราง กรุณาตรวจเลขแถว');
  byId('masterPreview').replaceChildren(tablePreview(Array.from({length:Math.min(range.e.r+1,8)},(_,r)=>r)));
  byId('masterInfo').textContent=`${source.name} · ${byId('masterSheet').value} · ${dataRows.length.toLocaleString()} รายการ · ${range.e.c+1} คอลัมน์ (A–${XLSX.utils.encode_col(range.e.c)}) · ไม่นับแถวว่าง`;
  notify('พร้อมตรวจผล — ดูว่าหัวตารางและตำแหน่งคอลัมน์ตรงกับ MASTER');
 }catch(e){sheet=null;byId('masterInfo').textContent=e.message;byId('masterPreview').replaceChildren();notify(e.message,true);}lock(false);
}
function decode(bytes){const encoding=byId('masterEncoding').value;if(encoding!=='auto')return new TextDecoder(encoding,{fatal:true}).decode(bytes);if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le',{fatal:true}).decode(bytes);if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be',{fatal:true}).decode(bytes);try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('windows-874',{fatal:true}).decode(bytes);}}
async function loadMaster(){
 invalidate();sheet=null;book=null;range=null;byId('masterPreview').replaceChildren();byId('masterSheet').replaceChildren();if(!source){byId('masterInfo').textContent='ยังไม่ได้เลือก MASTER';lock(false);return;}
 lock(true);byId('masterInfo').textContent='กำลังอ่าน '+source.name+'…';
 try{
  if(!/\.(xlsx|xls|csv)$/i.test(source.name))throw new Error('รองรับเฉพาะ .xlsx / .xls / .csv (ชื่อไฟล์: '+source.name+')');
  if(source.size>100*1024*1024)throw new Error('MASTER ขนาด '+(source.size/1024/1024).toFixed(1)+' MB เกินขีดจำกัด 100 MB');
  await new Promise(resolve=>setTimeout(resolve,0));
  const bytes=new Uint8Array(await source.arrayBuffer());
  if(/\.csv$/i.test(source.name)){
   const text=decode(bytes).replace(/^\uFEFF/,'');if(text.includes('\0'))throw new Error('CSV มี NUL กรุณาเลือก UTF-16 ให้ตรงกับต้นฉบับ');const delimiter=Papa.parse(text,{skipEmptyLines:true,preview:30}).meta.delimiter;const parsed=Papa.parse(text,{delimiter,dynamicTyping:false,skipEmptyLines:false});const errors=parsed.errors.filter(e=>e.code!=='UndetectableDelimiter');if(errors.length)throw new Error('CSV ไม่ถูกต้อง: '+errors[0].message);const rows=parsed.data;if(/(?:\r\n|\r|\n)$/.test(text)&&rows.at(-1)?.length===1&&rows.at(-1)[0]==='')rows.pop();const width=rows.reduce((max,row)=>Math.max(max,row.length),0);if(rows.length*width>MAX_INPUT_CELLS)throw new Error('พื้นที่ตาราง CSV เกิน 5,000,000 เซลล์');book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(rows),'MASTER');
  }else book=XLSX.read(bytes,{type:'array',cellNF:true,cellStyles:true,cellFormula:true});
  for(const name of book.SheetNames)byId('masterSheet').add(new Option(name,name));selectSheet();
 }catch(e){book=null;sheet=null;byId('masterInfo').textContent='อ่าน MASTER ไม่สำเร็จ: '+e.message;notify(e.message,true);}finally{lock(false);}
}
function normalize(value){return byId('normalize').checked?value.trim().toUpperCase():value;}
function match(row,rule){const tests=rule.conditions.map(c=>{const actual=normalize(textAt(row,XLSX.utils.decode_col(c.column)));if(c.op==='blank')return actual==='';if(c.op==='notblank')return actual!=='';const values=c.value.split(/[,\r\n]+/).map(v=>v.trim()).filter(Boolean).map(normalize);if(c.op==='in')return values.includes(actual);if(c.op==='notin')return !values.includes(actual);if(c.op==='startswith')return values.some(value=>actual.startsWith(value));return values.some(value=>actual.includes(value));});return rule.mode==='AND'?tests.every(Boolean):tests.some(Boolean);}
function checkRules(){
 invalidate();try{
  if(!sheet)throw new Error('เลือก MASTER ก่อน');const rules=readRules(),groups=rules.map(rule=>({rule,rows:[]})),unmatched=[];let overlap=0,unique=0;
  for(const row of dataRows){let count=0;for(const g of groups)if(match(row,g.rule)){g.rows.push(row);count++;}if(!count)unmatched.push(row);else unique++;if(count>1)overlap++;}
  results={groups,unmatched,overlap,unique,headers:headerCount()};
  const table=node('table');let tr=table.insertRow();for(const title of ['ACQ','จำนวนรายการ'])tr.append(node('th',title));for(const g of groups){tr=table.insertRow();tr.insertCell().textContent=g.rule.name;tr.insertCell().textContent=g.rows.length.toLocaleString();}
  tr=table.insertRow();tr.insertCell().textContent='Unmatched · ไม่เข้ากฎ';tr.insertCell().textContent=unmatched.length.toLocaleString();byId('result').append(table);
  for(const group of [...groups,{rule:{name:'Unmatched'},rows:unmatched}]){const details=node('details');details.append(node('summary',`ตัวอย่าง ${group.rule.name} (${group.rows.length} รายการ · แสดงสูงสุด 8)`));const scroll=node('div');scroll.className='csv-preview';scroll.append(tablePreview(group.rows));details.append(scroll);byId('result').append(details);}
  notify(`ตรวจแล้ว ${dataRows.length} รายการ · เข้ากฎแบบไม่นับซ้ำ ${unique} · ไม่เข้ากฎ ${unmatched.length} · ตรงหลาย ACQ ${overlap} รายการ${overlap?' (อยู่ในทุกกลุ่มที่ตรงกฎ)':''}`);
 }catch(e){notify(e.message,true);}lock(false);
}
function exportSheet(rows,headers){
 const output={},indices=[...Array.from({length:headers},(_,r)=>r),...rows];
 indices.forEach((original,target)=>{for(let c=0;c<=range.e.c;c++){const cell=sheet[XLSX.utils.encode_cell({r:original,c})];if(!cell)continue;if(cell.f&&cell.v===undefined)throw new Error('พบสูตรที่ไม่มีค่าผลลัพธ์ใน MASTER กรุณาเปิดและบันทึกผ่าน Excel ก่อน');const copy={...cell};delete copy.f;delete copy.F;delete copy.D;delete copy.w;delete copy.l;delete copy.c;output[XLSX.utils.encode_cell({r:target,c})]=copy;}});
 if(indices.length)output['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:indices.length-1,c:range.e.c}});
 if(sheet['!cols'])output['!cols']=sheet['!cols'];if(sheet['!rows'])output['!rows']=indices.map(r=>sheet['!rows'][r]);
 if(sheet['!merges'])output['!merges']=sheet['!merges'].filter(m=>m.e.r<headers).map(m=>({s:{...m.s},e:{...m.e}}));
 return output;
}
function safeName(value){return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\.+/,'').trim()||'ACQ';}
async function exportResults(){
 if(!results)return;lock(true);
 try{
  const outputCells=(results.groups.reduce((sum,g)=>sum+g.rows.length+results.headers,0)+results.unmatched.length+results.headers)*(range.e.c+1);if(outputCells>MAX_OUTPUT_CELLS)throw new Error('ผลลัพธ์รวมเกิน 10,000,000 เซลล์ กรุณาแบ่ง MASTER หรือแยกทำทีละกลุ่ม ACQ');
  const zip=new JSZip(),used=new Set(['summary.xlsx']);const write=(name,worksheet)=>{let base=safeName(name),filename=base+'.xlsx',suffix=2;while(used.has(filename.toLowerCase()))filename=base+'_'+(suffix++)+'.xlsx';used.add(filename.toLowerCase());const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,worksheet,'Transactions');zip.file(filename,XLSX.write(b,{type:'array',bookType:'xlsx',compression:true}));};
  for(const group of [...results.groups,{rule:{name:'Unmatched'},rows:results.unmatched}]){notify('กำลังสร้าง '+group.rule.name+'…');await new Promise(resolve=>setTimeout(resolve,0));write(group.rule.name,exportSheet(group.rows,results.headers));}
  const summary=[['Source',source.name],['Sheet',byId('masterSheet').value],['Input transactions',dataRows.length],['Unique matched',results.unique],['Unmatched',results.unmatched.length],['Rows matching multiple ACQs',results.overlap],[],['ACQ','Count','Mode','Rules']];for(const g of results.groups)summary.push([g.rule.name,g.rows.length,g.rule.mode,g.rule.conditions.map(c=>`${c.column} ${c.op} [${c.value}]`).join(' '+g.rule.mode+' ')]);const b=XLSX.utils.book_new();XLSX.utils.book_append_sheet(b,XLSX.utils.aoa_to_sheet(summary),'Summary');zip.file('Summary.xlsx',XLSX.write(b,{type:'array',bookType:'xlsx',compression:true}));
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});outputUrl=URL.createObjectURL(blob);const link=byId('acqDownload');link.href=outputUrl;link.download=safeName(source.name.replace(/\.[^.]+$/,''))+'_ACQ.zip';link.hidden=false;link.click();notify('เสร็จแล้ว! ZIP มี Excel แยก ACQ, Unmatched และ Summary');
 }catch(e){notify('ยังไม่สร้าง ZIP: '+e.message,true);}finally{lock(false);}
}
byId('master').onchange=()=>{source=byId('master').files[0]||null;loadMaster();};byId('masterSheet').onchange=selectSheet;byId('headerEnd').oninput=()=>{if(book)selectSheet();else invalidate();};byId('masterEncoding').onchange=()=>{if(source)loadMaster();};byId('groups').addEventListener('input',invalidate);byId('groups').addEventListener('change',invalidate);byId('normalize').onchange=invalidate;byId('addGroup').onclick=()=>addGroup();byId('check').onclick=checkRules;byId('exportAcq').onclick=exportResults;
byId('saveRules').onclick=()=>{try{const rules=readRules();localStorage.setItem(RULE_KEY,JSON.stringify({rules,normalize:byId('normalize').checked}));byId('rulesStatus').textContent='บันทึกกฎแล้วในเบราว์เซอร์นี้ (ไม่เก็บข้อมูล MASTER)';}catch(e){byId('rulesStatus').textContent='บันทึกไม่ได้: '+e.message;}};
byId('resetRules').onclick=()=>{byId('groups').replaceChildren();defaults().forEach(addGroup);byId('normalize').checked=true;try{localStorage.removeItem(RULE_KEY);}catch{}byId('rulesStatus').textContent='คืนกฎเริ่มต้นแล้ว';invalidate();};
try{const saved=JSON.parse(localStorage.getItem(RULE_KEY));if(saved&&Array.isArray(saved.rules)&&saved.rules.length<=30&&saved.rules.every(r=>typeof r.name==='string'&&['AND','OR'].includes(r.mode)&&Array.isArray(r.conditions)&&r.conditions.length<=20&&r.conditions.every(c=>typeof c.column==='string'&&typeof c.value==='string'&&['in','notin','contains','startswith','blank','notblank'].includes(c.op)))){const existing=new Set(saved.rules.map(r=>r.name.trim().toLowerCase()));saved.rules.forEach(addGroup);const added=defaults().filter(r=>!existing.has(r.name.toLowerCase()));added.forEach(addGroup);byId('normalize').checked=saved.normalize!==false;byId('rulesStatus').textContent='โหลดกฎเดิมแล้ว พร้อมเพิ่ม ACQ ใหม่ที่ยังไม่มี (กฎเดิมของคุณยังอยู่)';}else defaults().forEach(addGroup);}catch{byId('groups').replaceChildren();defaults().forEach(addGroup);}
lock(false);
