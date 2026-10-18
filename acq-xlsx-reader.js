/* Incremental XLSX XML reader. Original values + numeric formats; no giant worksheet XML string. */
'use strict';
class CompactXlsx {
 constructor(file){this.file=file;this.strings=[];this.styles=[];this.formats={};this.names=[];this.paths={};this.date1904=false;}
 async unzip(handlers,stop=()=>false){
  const unzip=new fflate.Unzip(entry=>{const handler=handlers[entry.name];if(!handler)return;const decoder=new TextDecoder();entry.ondata=(error,data,final)=>{if(error)throw error;handler(decoder.decode(data,{stream:!final}),final);};entry.start();});unzip.register(fflate.UnzipInflate);
  const reader=this.file.stream().getReader();let read=0;
  try{while(true){const {value,done}=await reader.read();if(done){unzip.push(new Uint8Array(),true);break;}unzip.push(value,false);read+=value.length;if(stop())break;if(read%(1024*1024)<value.length){progress('กำลังอ่าน XLSX แบบแบ่งช่วง… '+Math.round(read/this.file.size*100)+'%',read,this.file.size);await pause();}}}finally{await reader.cancel();}
 }
 async metadata(){
  const rels={},ids={};const parsers={};let shared='',inShared=false,inText=false,phonetic=false,cellXfs=false;
  const make=(path,open,close,text)=>{const p=sax.parser(true);p.onopentag=n=>{n.name=n.name.split(':').pop();open(n);};p.onclosetag=name=>(close||(()=>{}))(name.split(':').pop());p.ontext=text||(()=>{});p.oncdata=p.ontext;parsers[path]=(chunk,final)=>{p.write(chunk);if(final)p.close();};};
  make('xl/workbook.xml',n=>{if(n.name==='sheet'){this.names.push(n.attributes.name);ids[n.attributes.name]=n.attributes['r:id'];}if(n.name==='workbookPr')this.date1904=['1','true'].includes(n.attributes.date1904);});
  make('xl/_rels/workbook.xml.rels',n=>{if(n.name==='Relationship')rels[n.attributes.Id]=new URL(n.attributes.Target,'https://xlsx.local/xl/workbook.xml').pathname.slice(1);});
  make('xl/styles.xml',n=>{if(n.name==='numFmt')this.formats[n.attributes.numFmtId]=n.attributes.formatCode;if(n.name==='cellXfs')cellXfs=true;else if(n.name==='xf'&&cellXfs)this.styles.push(Number(n.attributes.numFmtId||0));},name=>{if(name==='cellXfs')cellXfs=false;});
  make('xl/sharedStrings.xml',n=>{if(n.name==='si'){inShared=true;shared='';}if(n.name==='rPh')phonetic=true;if(n.name==='t')inText=true;},name=>{if(name==='t')inText=false;if(name==='rPh')phonetic=false;if(name==='si'){this.strings.push(shared);inShared=false;}},text=>{if(inShared&&inText&&!phonetic)shared+=text;});
  await this.unzip(parsers);this.names.forEach(name=>this.paths[name]=rels[ids[name]]);if(!this.names.length)throw new Error('ไม่พบแผ่นงานใน XLSX');
 }
 async read(name,limit=Infinity){
  this.rows=[];this.rowStyles=[];this.merges=[];this.cols=[];this.maxRow=0;this.maxCol=0;const intern=new Map();let r=-1,c=0,nextCol=0,type='',style=0,value='',inline='',inValue=false,inText=false,hasValue=false,hasFormula=false,done=false,rowStyles=[];
  const p=sax.parser(true);const pool=s=>{if(intern.has(s))return intern.get(s);if(intern.size<50000)intern.set(s,s);return s;};
  p.onopentag=n=>{
   n.name=n.name.split(':').pop();if(done)return;const a=n.attributes;
   if(n.name==='dimension'&&a.ref){const range=XLSX.utils.decode_range(a.ref);this.maxRow=Math.max(this.maxRow,range.e.r);this.maxCol=Math.max(this.maxCol,range.e.c);}
   if(n.name==='row'){r=a.r?Number(a.r)-1:r+1;nextCol=0;if(r>=limit){done=true;return;}this.rows[r]=[];rowStyles=[];}
   if(n.name==='c'){c=a.r?XLSX.utils.decode_cell(a.r).c:nextCol;nextCol=c+1;type=a.t||'n';style=Number(a.s||0);value=inline='';hasValue=hasFormula=false;}
   if(n.name==='v'){inValue=true;hasValue=true;}if(n.name==='t')inText=true;if(n.name==='f')hasFormula=true;
   if(n.name==='mergeCell'&&a.ref)this.merges.push(XLSX.utils.decode_range(a.ref));
   if(n.name==='col'){const col={};if(a.width)col.wch=Number(a.width);if(a.hidden)col.hidden=a.hidden==='1';for(let i=Number(a.min)-1;i<Number(a.max);i++)this.cols[i]=col;}
  };
  p.ontext=t=>{if(done)return;if(inValue)value+=t;if(inText)inline+=t;};
  p.oncdata=p.ontext;
  p.onclosetag=name=>{
   name=name.split(':').pop();if(done)return;if(name==='v')inValue=false;if(name==='t')inText=false;
   if(name==='c'){
    let v;
    if(type==='inlineStr')v=pool(inline);else if(type==='s')v=this.strings[Number(value)]??'';else if(type==='b')v=value==='1';else if(type==='str')v=pool(value);else if(type==='e')v={t:'e',v:({ '#NULL!':0,'#DIV/0!':7,'#VALUE!':15,'#REF!':23,'#NAME?':29,'#NUM!':36,'#N/A':42 })[value]??15};else if(type==='d')v={t:'d',v:new Date(value)};else if(hasValue&&value!=='')v=Number(value);
    if(hasFormula&&(!hasValue||(value===''&&type!=='str')))v={f:'uncached'};
    if(v!==undefined){this.rows[r]??=[];this.rows[r][c]=v;this.maxRow=Math.max(this.maxRow,r);this.maxCol=Math.max(this.maxCol,c);}
    if(style)rowStyles[c]=style;
   }
   if(name==='row'&&rowStyles.length)this.rowStyles[r]=Uint16Array.from(rowStyles);
  };
  const path=this.paths[name];if(!path)throw new Error('ไม่พบข้อมูลแผ่นงาน '+name);
  await this.unzip({[path]:(chunk,final)=>{if(!done){p.write(chunk);if(final)p.close();}}},()=>done);
  if(this.maxRow>=1048576||this.maxCol>=16384)throw new Error('เกินขีดจำกัดแถวหรือคอลัมน์ Excel');
  return {s:{r:0,c:0},e:{r:this.maxRow,c:this.maxCol}};
 }
 cell(r,c){const value=this.rows[r]?.[c];if(value===undefined)return;const cell=typeof value==='object'&&value!==null?{...value}:{t:typeof value==='number'?'n':typeof value==='boolean'?'b':'s',v:value};const style=this.rowStyles[r]?.[c]||0,num=this.styles[style]||0;const format=this.formats[num]??XLSX.SSF._table[num];if(format)cell.z=format;return cell;}
}
