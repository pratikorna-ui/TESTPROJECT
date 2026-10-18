// Run: node tests/acq-xml.cjs (Node 20+; uses vendored dependencies).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
global.fflate = require(path.join(root, 'vendor/fflate.min.js'));
global.sax = require(path.join(root, 'vendor/sax.js'));
global.XLSX = require(path.join(root, 'vendor/xlsx.full.min.js'));
global.progress = () => {};
global.pause = () => Promise.resolve();
vm.runInThisContext(fs.readFileSync(path.join(root, 'acq-xlsx-reader.js'), 'utf8') + '\nglobal.CompactXlsx = CompactXlsx;');

(async () => {
  const headers = Array.from({length: 31}, (_, i) => 'Column ' + i);
  const row = Array(31).fill('');
  row[0] = '000012345'; row[1] = 1234.5; row[2] = 'ภาษาไทย'; row[28] = 'WC';
  const sheet = XLSX.utils.aoa_to_sheet([headers, row]);
  sheet.B2.z = '#,##0.00';
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'MASTER');
  const bytes = new Uint8Array(XLSX.write(book, {type: 'array', bookType: 'xlsx', bookSST: true}));
  const entries = fflate.unzipSync(bytes);
  const prefixed = {};
  for (const [name, value] of Object.entries(entries)) {
    if (!/\.(xml|rels)$/.test(name)) { prefixed[name] = value; continue; }
    let xml = new TextDecoder().decode(value);
    const uri = xml.match(/\bxmlns="([^"]+)"/)?.[1];
    if (uri) {
      xml = xml.replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g, '<$1test:$2');
      xml = xml.replace(/<(test:[\w.-]+)/, '<$1 xmlns:test="' + uri + '"');
      xml = xml.replace(/xmlns:r=/g, 'xmlns:relationshipAlias=').replace(/\br:id=/g, 'relationshipAlias:id=');
    }
    prefixed[name] = new TextEncoder().encode(xml);
  }
  for (const [label, data] of [['default namespace', bytes], ['prefixed namespace + relationship alias', fflate.zipSync(prefixed)]]) {
    const reader = new CompactXlsx(new File([data], 'master.xlsx'));
    await reader.metadata();
    assert.deepEqual(reader.names, ['MASTER']);
    for (const limit of [21, Infinity]) {
      await reader.read('MASTER', limit);
      assert.equal(reader.cell(1, 0).v, '000012345');
      assert.equal(reader.cell(1, 1).v, 1234.5);
      assert.equal(reader.cell(1, 1).z, '#,##0.00');
      assert.equal(reader.cell(1, 2).v, 'ภาษาไทย');
      assert.equal(reader.cell(1, 28).v, 'WC');
    }
    console.log('PASS:', label, '(metadata, preview, full read, shared strings, decimal formatting)');
  }
  const corrupt = {...prefixed};
  corrupt['xl/styles.xml'] = new TextEncoder().encode('<test:styleSheet xmlns:test="urn:test"></test:wrong>');
  const reader = new CompactXlsx(new File([fflate.zipSync(corrupt)], 'corrupt.xlsx'));
  await assert.rejects(reader.metadata(), /xl\/styles\.xml.*ไม่สำเร็จ/);
  console.log('PASS: malformed XML is rejected with entry path; validation remains strict');
})().catch(error => { console.error(error); process.exit(1); });
