const assert=require('node:assert/strict'),P=require('../bank-text-core.js');
function report({date='27OCT26',page=1,reporting='1000840144 2C2P INT',currency='THB',interchange='5.00CR',fee='0.06DB',visa='0.00',net='4.94CR',id='VSS-110'}={}){return `REPORT ID: ${id}                 VISANET SETTLEMENT SERVICE                 PAGE: ${page}
 REPORTING FOR:    ${reporting}                 INTERNATIONAL SETTLEMENT SERVICE      PROC DATE: 28OCT26
 REPORT DATE: ${date}
 SETTLEMENT CURRENCY: ${currency}
 FUNDS TRANSFER AMOUNT: 999999.99CR
 INTERCHANGE VALUE
 TOTAL ACQUIRER 1 5.00 0.00 5.00CR
 TOTAL ISSUER 0 0.00 0.00 0.00
 TOTAL INTERCHANGE VALUE 1 5.00 0.00 ${interchange}
 REIMBURSEMENT FEES
 TOTAL REIMBURSEMENT FEES 0.00 0.06 ${fee}
 VISA CHARGES
 TOTAL VISA CHARGES 0.00 0.00 ${visa}
 TOTAL
 TOTAL ACQUIRER 5.00 0.06 4.94CR
 NET SETTLEMENT AMOUNT 5.00 0.06 ${net}
`;}
let rows=P.parse(report(),'one.txt');assert.equal(rows.length,1);assert.equal(rows[0].reportDate,'2026-10-27');assert.equal(rows[0].reportingFor,'1000840144 2C2P INT');assert.equal(rows[0].currency,'THB');assert.deepEqual(rows[0].errors,[]);assert.deepEqual(Object.values(rows[0].metrics).map(v=>v.value),['5.00','-0.06','0.00','4.94']);
rows=P.parse(report({interchange:'24.88CR',fee:'0.09DB',net:'24.79CR'}));assert.equal(rows[0].metrics.total.value,'24.79');assert.equal(rows[0].metrics.fee.value,'-0.09');
assert.equal(P.amount('1,234.50 DB').value,'-1234.50');assert.equal(P.amount('24.79CR').value,'24.79');assert.equal(P.amount('0.00DB').value,'0.00');assert.equal(P.amount('12,34.50CR'),null);assert.equal(P.totalFromLine('NET SETTLEMENT AMOUNT 1 0.00 12,34.50CR','NET SETTLEMENT AMOUNT').value,undefined);assert(P.totalFromLine('NET SETTLEMENT AMOUNT 24.79CR','NET SETTLEMENT AMOUNT').error);
rows=P.parse(report()+report({page:1,reporting:'00000123 ACCOUNT TWO',currency:'USD'}));assert.equal(rows.length,2);assert.equal(rows[1].currency,'USD');assert.equal(rows[1].reportingFor,'00000123 ACCOUNT TWO');
const page1=report().replace(/^ NET SETTLEMENT AMOUNT.*\n/m,'');rows=P.parse(page1+'\f'+report({page:2}));assert.equal(rows.length,1);assert.equal(rows[0].metrics.total.value,'4.94');assert.equal(rows[0].audit.filter(a=>a.field==='interchange').length,2);
rows=P.parse(report()+report({page:2,interchange:'24.88CR',fee:'0.09DB',net:'24.79CR'}));assert.equal(rows.length,1);assert.equal(rows[0].metrics.total.value,'24.79');assert(rows[0].notes.length);
rows=P.parse(report()+' SETTLEMENT CURRENCY: USD\n TOTAL INTERCHANGE VALUE 1 10.00 0.00 10.00CR\n TOTAL REIMBURSEMENT FEES 0.00 1.00 1.00DB\n TOTAL VISA CHARGES 0.00 0.00 0.00\n NET SETTLEMENT AMOUNT 10.00 1.00 9.00CR');assert.equal(rows.length,2);assert.equal(rows[1].metrics.total.value,'9.00');assert.equal(rows[1].currency,'USD');
rows=P.parse(report().replace(/^ TOTAL REIMBURSEMENT FEES.*\n/m,''));assert(rows[0].errors.some(e=>e.includes('TOTAL REIMBURSEMENT FEES')));rows=P.parse(report({date:'31FEB26'}));assert(rows[0].errors.some(e=>e.includes('REPORT DATE')));assert(P.parse(report({id:'VSS-120'}))[0].errors.length);assert(P.parse('not a report')[0].errors.length);assert.equal(P.date('01NOV26'),'2026-11-01');assert.equal(P.date('29FEB24'),'2024-02-29');console.log('PASS: screenshot-derived values, TOTAL column only, CR/DB signs, report-date precedence, reporting text, multi-report/currency/page handling, last totals, malformed numbers/dates and missing labels');
module.exports={report};
