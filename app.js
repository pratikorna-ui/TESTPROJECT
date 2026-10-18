'use strict';
const $ = id => document.getElementById(id);
let workbook = null, rows = [], headers = [], selected = [], currentFile = null, generation = 0;
const LIMIT = 10000;
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error', error); }
function reset() { rows = []; headers = []; selected = []; workbook = null; $('settings').hidden = true; $('preview').replaceChildren(); $('summary').textContent = 'ยังไม่มีข้อมูล'; $('report').replaceChildren(); }
function table(data, indexes) {
  const result = document.createElement('table');
  result.className = 'data-table ' + ($('layout').value === 'compact' ? 'compact' : 'grid');
  result.style.setProperty('--report-font', $('fontSize').value + 'pt');
  // Use the full report to keep preview and printed column widths consistent.
  const weights = indexes.map(i => Math.min(75, Math.max(8, ...[headers[i], ...rows.map(row => row[i] ?? '')].map(value => Math.max(...String(value).split(/\r?\n/).map(line => Array.from(line).length))))));
  const total = weights.reduce((sum, width) => sum + width, 0);
  const cols = document.createElement('colgroup');
  weights.forEach(weight => { const col = document.createElement('col'); col.style.width = (weight / total * 100) + '%'; cols.append(col); });
  result.append(cols);
  const numeric = indexes.map(i => rows.some(row => String(row[i] ?? '').trim()) && rows.every(row => !String(row[i] ?? '').trim() || /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(String(row[i]).trim())));
  const head = result.createTHead().insertRow();
  indexes.forEach((i, position) => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = headers[i]; if (numeric[position]) cell.className = 'numeric'; head.append(cell); });
  const body = result.createTBody();
  data.forEach(row => { const tr = body.insertRow(); indexes.forEach((i, position) => { const cell = tr.insertCell(); cell.textContent = String(row[i] ?? ''); if (numeric[position]) cell.className = 'numeric'; }); });
  return result;
}
function render() {
  const indexes = selected.flatMap((yes, i) => yes ? [i] : []);
  $('preview').replaceChildren(...(indexes.length ? [table(rows.slice(0, 50), indexes)] : []));
  $('summary').textContent = `${rows.length.toLocaleString()} แถว · เลือก ${indexes.length} / ${headers.length} คอลัมน์ · ตัวอย่างสูงสุด 50 แถว (PDF ใช้ทุกแถว)`;
  $('export').disabled = !indexes.length || !rows.length;
}
function loadData(data) {
  data = data.filter(row => row.some(value => String(value ?? '').trim() !== ''));
  if (data.length < 2) throw new Error('ต้องมีแถวชื่อคอลัมน์ และข้อมูลอย่างน้อย 1 แถว');
  if (data.length - 1 > LIMIT) throw new Error('รองรับสูงสุด 10,000 แถวต่อแผ่นงาน กรุณาแบ่งไฟล์ก่อน');
  const width = Math.max(...data.map(row => row.length));
  if (width > 100) throw new Error('รองรับสูงสุด 100 คอลัมน์ กรุณาลดคอลัมน์ก่อน');
  headers = Array.from({length: width}, (_, i) => String(data[0][i] ?? '').trim() || `คอลัมน์ ${i + 1}`);
  rows = data.slice(1); selected = headers.map(() => true); $('columns').replaceChildren();
  headers.forEach((name, i) => {
    const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = true;
    input.addEventListener('change', () => { selected[i] = input.checked; render(); });
    label.append(input, document.createTextNode(name)); $('columns').append(label);
  });
  $('settings').hidden = false; status(`อ่านไฟล์สำเร็จ: ${currentFile.name}`); render();
}
async function readFile() {
  const ticket = ++generation; reset();
  if (!currentFile) { status('ยังไม่ได้เลือกไฟล์'); return; }
  if (!/\.(csv|xlsx|xls)$/i.test(currentFile.name)) { status('กรุณาเลือกไฟล์ .csv, .xlsx หรือ .xls', true); return; }
  if (currentFile.size > 10 * 1024 * 1024) { status('ไฟล์ใหญ่เกิน 10 MB กรุณาแบ่งไฟล์ก่อน', true); return; }
  status('กำลังอ่านไฟล์…');
  try {
    const buffer = await currentFile.arrayBuffer(); if (ticket !== generation) return;
    const csv = /\.csv$/i.test(currentFile.name);
    $('encoding').disabled = !csv; $('sheet').disabled = csv; $('sheet').replaceChildren();
    if (csv) {
      if (!window.Papa) throw new Error('โหลดเครื่องมือ CSV ไม่สำเร็จ กรุณารีเฟรชและตรวจสอบอินเทอร์เน็ต');
      const parsed = Papa.parse(new TextDecoder($('encoding').value).decode(buffer), {skipEmptyLines: 'greedy'});
      if (parsed.errors.length) throw new Error('อ่าน CSV ไม่สำเร็จ: ' + parsed.errors[0].message);
      $('sheet').add(new Option('CSV', 'csv')); loadData(parsed.data);
    } else {
      if (!window.XLSX) throw new Error('โหลดเครื่องมือ Excel ไม่สำเร็จ กรุณารีเฟรชและตรวจสอบอินเทอร์เน็ต');
      workbook = XLSX.read(buffer, {type:'array', sheetRows: LIMIT + 2});
      workbook.SheetNames.forEach(name => $('sheet').add(new Option(name, name)));
      loadSheet();
    }
  } catch (error) { $('settings').hidden = true; status(error.message || 'อ่านไฟล์ไม่สำเร็จ', true); }
}
function loadSheet() {
  try {
    const sheet = workbook.Sheets[$('sheet').value];
    if (sheet['!fullref'] && XLSX.utils.decode_range(sheet['!fullref']).e.r > LIMIT) throw new Error('รองรับสูงสุด 10,000 แถวต่อแผ่นงาน กรุณาแบ่งไฟล์ก่อน');
    loadData(XLSX.utils.sheet_to_json(sheet, {header:1, defval:'', raw:false}));
  }
  catch (error) { rows = []; $('preview').replaceChildren(); $('columns').replaceChildren(); $('export').disabled = true; $('summary').textContent = 'แผ่นงานนี้ไม่มีข้อมูลที่ใช้ได้'; status(error.message, true); }
}
$('file').addEventListener('change', () => { currentFile = $('file').files[0] || null; if (currentFile) { const base = currentFile.name.replace(/\.[^.]+$/, ''); $('filename').value = base; $('title').value = base; } readFile(); });
for (const id of ['layout', 'fontSize']) $(id).addEventListener('change', render);
$('encoding').addEventListener('change', readFile); $('sheet').addEventListener('change', loadSheet);
for (const [id, value] of [['all', true], ['none', false]]) $(id).addEventListener('click', () => { selected.fill(value); $('columns').querySelectorAll('input').forEach(input => input.checked = value); render(); });
$('export').addEventListener('click', () => {
  const indexes = selected.flatMap((yes, i) => yes ? [i] : []); if (!indexes.length || !rows.length) return;
  const heading = document.createElement('h1'); heading.textContent = $('title').value.trim() || 'รายงานข้อมูล';
  $('report').replaceChildren(heading, table(rows, indexes));
  $('pageStyle').textContent = `@page{size:A4 ${$('orientation').value === 'portrait' ? 'portrait' : 'landscape'};margin:12mm}`;
  const original = document.title;
  document.title = ($('filename').value.trim().replace(/[\\/:*?"<>|]/g, '_').replace(/\.pdf$/i, '') || 'report');
  window.addEventListener('afterprint', () => { document.title = original; }, {once:true});
  window.print();
});
