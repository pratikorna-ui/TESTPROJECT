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
