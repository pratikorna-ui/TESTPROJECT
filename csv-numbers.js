/* Convert explicit decimal amounts without guessing dates, formulas or identifiers. */
function csvNumberCell(value) {
  let text = String(value).trim();
  if (!text) return null;
  if (/^\(.*\)$/.test(text)) text = '-' + text.slice(1, -1).trim();
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(text)) return null;
  const plain = text.replace(/,/g, '');
  // Excel stores only 15 significant decimal digits. Preserve unsafe values as text.
  const significant = plain.replace(/^[+-]/, '').replace('.', '').replace(/^0+/, '').replace(/0+$/, '');
  if (significant.length > 15) return null;
  const number = Number(plain);
  if (!Number.isFinite(number) || (number === 0 && /[1-9]/.test(plain))) return null;
  const decimals = plain.split('.')[1]?.length || 0;
  if (decimals > 15) return null;
  return {t: 'n', v: number, z: (text.includes(',') ? '#,##0' : '0') + (decimals ? '.' + '0'.repeat(decimals) : '')};
}
if (typeof module !== 'undefined') module.exports = csvNumberCell;

function csvColumnSuggestion(header, values) {
  const name=String(header).trim();
  if (/(?:\b(?:id|account|acct|card|phone|mobile|tel|code|reference|ref|date|time|zip|postal)\b|account.?number|รหัส|บัญชี|บัตร|โทร|อ้างอิง|วันที่|เวลา|ไปรษณีย์)/i.test(name.replace(/[_-]/g,' ')))
    return {type:'text',reason:'ชื่อคอลัมน์คล้ายรหัส บัญชี หรือวันที่ จึงเก็บเป็นข้อความ'};
  let count=0, decimal=false;
  for(const value of values){
    const text=String(value??'').trim();if(!text)continue;count++;
    const plain=text.replace(/,/g,'').replace(/^[+(\-]|\)$/g,'');
    if(/^0\d/.test(plain))return {type:'text',reason:'มีเลขศูนย์นำหน้า เก็บเป็นข้อความเพื่อไม่ให้ศูนย์หาย'};
    if(/^\d{16,}$/.test(plain))return {type:'text',reason:'มีเลขยาวเกิน 15 หลัก เก็บเป็นข้อความป้องกันเลขเพี้ยน'};
    if(!csvNumberCell(text))return {type:'text',reason:'มีข้อความ วันที่ หรือค่าที่แปลงเป็นตัวเลขอย่างปลอดภัยไม่ได้'};
    if(text.includes('.')||text.includes(','))decimal=true;
  }
  if(!count)return {type:'text',reason:'ไม่มีข้อมูล เก็บเป็นข้อความ'};
  if(decimal||/(?:amount|balance|deposit|withdraw|total|price|fee|tax|rate|quantity|count|qty|ยอด|จำนวน|ราคา|เงิน|ค่าธรรมเนียม|ภาษี)/i.test(name))
    return {type:'number',reason:'ข้อมูลทุกแถวเป็นตัวเลข และมีทศนิยมหรือชื่อคอลัมน์บอกจำนวน'};
  return {type:'text',reason:'เป็นเลขจำนวนเต็มที่อาจเป็นรหัส จึงให้เลือกยืนยันเอง'};
}
if(typeof module!=='undefined')module.exports.suggest=csvColumnSuggestion;
