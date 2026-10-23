'use strict';
const AppendCore=(()=>{
 function escape(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
 function attrs(tag){const values={};tag.replace(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g,(_,k,q,v)=>{values[k]=v.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');return '';});return values;}
 function set(tag,key,value){const regex=new RegExp('(\\s'+key+'\\s*=\\s*)(["\'])(.*?)\\2');if(regex.test(tag))return tag.replace(regex,(_,start)=>start+'"'+escape(value)+'"');return tag.replace(/(\/?>)$/,' '+key+'="'+escape(value)+'"$1');}
 function extend(ref,lastRow){const range=XLSX.utils.decode_range(ref);range.e.r=Math.max(range.e.r,lastRow);return XLSX.utils.encode_range(range);}
 function tags(xml,local,fn){return xml.replace(new RegExp('<(?:[\\w.-]+:)?'+local+'\\b(?:[^>\"\']|\"[^\"]*\"|\'[^\']*\')*>','g'),fn);}
 function roots(xml,local){const m=xml.match(new RegExp('<((?:[\\w.-]+:)?'+local+')\\b[^>]*>'));if(!m)throw new Error('ไม่พบ '+local);return {tag:m[0],name:m[1],attrs:attrs(m[0]),prefix:m[1].includes(':')?m[1].split(':')[0]+':':''};}
 function appendChildren(xml,local,children,count){const root=roots(xml,local),opening=set(root.tag,'count',count);if(/\/>$/.test(root.tag))return xml.replace(root.tag,opening.replace(/\/>$/, '>')+children+'</'+root.name+'>');const close='</'+root.name+'>';return xml.replace(root.tag,opening).replace(close,children+close);}
 function worksheetTransform(push,{lastRow,lastCol,inject}){
  let buffer='',injected=false;
  function send(text){if(text)push(text);}
  return {feed(chunk,final){buffer+=chunk;while(buffer){const start=buffer.indexOf('<');if(start<0){send(buffer);buffer='';break;}if(start){send(buffer.slice(0,start));buffer=buffer.slice(start);}let end=-1;if(buffer.startsWith('<!--')){const p=buffer.indexOf('-->');if(p>=0)end=p+2;}else if(buffer.startsWith('<![CDATA[')){const p=buffer.indexOf(']]>');if(p>=0)end=p+2;}else{let quote=null;for(let i=1;i<buffer.length;i++){const c=buffer[i];if(quote){if(c===quote)quote=null;}else if(c==='"'||c==="'")quote=c;else if(c==='>'){end=i;break;}}}if(end<0)break;let token=buffer.slice(0,end+1);buffer=buffer.slice(end+1);const m=token.match(/^<(\/?)([\w:.-]+)/);if(m){const closing=!!m[1],name=m[2],local=name.split(':').pop();if(local==='dimension'&&!closing)token=set(token,'ref',XLSX.utils.encode_range({s:{r:0,c:0},e:{r:lastRow,c:lastCol}}));if(local==='autoFilter'&&!closing){const ref=attrs(token).ref;if(ref)token=set(token,'ref',extend(ref,lastRow));}if(local==='sheetData'&&closing){inject(send,name.includes(':')?name.split(':')[0]+':':'');injected=true;}if(local==='sheetData'&&!closing&&/\/>$/.test(token)){send(token.replace(/\/>$/, '>'));inject(send,name.includes(':')?name.split(':')[0]+':':'');send('</'+name+'>');injected=true;continue;}}send(token);}if(final){if(buffer)throw new Error('XML ชีตไม่สมบูรณ์');if(!injected)throw new Error('ไม่พบตำแหน่งต่อข้อมูลในชีต');}},get injected(){return injected;}};
 }
 return {escape,attrs,set,extend,tags,roots,appendChildren,worksheetTransform};
})();
if(typeof module!=='undefined')module.exports=AppendCore;
