/* Teste do classificador de alerta de modelo. Node puro (sem deps). Roda: node test/model_alert.test.cjs */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { classifyLlmLogs } = require('../src/model_alert.js');

const DIR = path.join(__dirname, 'fixtures-model-alert');
const expected = JSON.parse(fs.readFileSync(path.join(DIR, 'expectations.json'), 'utf8'));

let pass = 0, fail = 0;
console.log('cenário                          esperado  obtido   reason');
console.log('-'.repeat(92));
for (const file of Object.keys(expected).sort()) {
  const want = expected[file];
  const logs = fs.readFileSync(path.join(DIR, file), 'utf8');
  const r = classifyLlmLogs(logs);
  const ok = r.level === want;
  ok ? pass++ : fail++;
  const name = file.replace('.log', '').padEnd(32);
  console.log(`${ok ? '✓' : '✗'} ${name} ${String(want).padEnd(9)} ${String(r.level).padEnd(8)} ${r.reason}`);
}
console.log('-'.repeat(92));
console.log(`RESULTADO: ${pass} passou, ${fail} falhou`);
process.exit(fail === 0 ? 0 : 1);
