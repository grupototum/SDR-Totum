#!/usr/bin/env node
// sim_runner.mjs — bateria de regressao do SDR contra /api/sim/turn
// Uso:
//   node tools/sim_runner.mjs run      [flowId]   -> roda, imprime tabela + health, grava baselines/<flow>.latest.json
//   node tools/sim_runner.mjs baseline [flowId]   -> roda e abençoa o baseline (baselines/<flow>.json)
//   node tools/sim_runner.mjs diff     [flowId]   -> roda e mostra SO o que mudou vs baseline + GO/no-GO
// Stateless, sem Evolution, sem persistir. Nao toca comercial nem N8N.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'baselines');
fs.mkdirSync(BASE, { recursive: true });

function loadEnv() {
  const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, '');
  }
  return env;
}
const env = loadEnv();
const PORT = env.PORT || '3002';
const KEY = env.SDR_API_KEY || '';
const ENDPOINT = `http://127.0.0.1:${PORT}/api/sim/turn`;

const mode = process.argv[2] || 'run';
const flowId = process.argv[3] || 'sdr-odonto-stages-v2';
const personas = JSON.parse(fs.readFileSync(path.join(__dirname, 'personas.json'), 'utf8'));

// guard-rail: vazamento de preco no texto enquanto nao ha previa autorizada
const PRICE_RE = /r\$\s*\d|\d+\s*reais|\d+\s*mil\b|\d+\s*contos?\b/i;

async function turn(body) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function runPersona(p) {
  let history = [{ direction: 'out', text: p.opening }];
  let variables = {};
  let stage = '';
  const out = { id: p.id, label: p.label, stage_inicial: 'abertura', stage_final: 'abertura',
    temperatura: '', score: 0, objecao_count: 0, send_preview: false, booked: false,
    turns: 0, guardrail_violado: false, violations: [] };
  for (const msg of p.turns) {
    const r = await turn({ flowId, stage, variables, history, lastMessage: msg });
    out.turns += 1;
    if (r.error) { out.violations.push('erro_engine:' + r.error); break; }
    const reply = (r.reply || []).join(' ');
    if (PRICE_RE.test(reply) && !r.send_preview) out.violations.push('preco_revelado');
    if (r.send_preview && r.stage_novo !== 'previa') out.violations.push('preview_fora_de_etapa');
    if (r.booked && r.stage_novo !== 'agendamento') out.violations.push('book_fora_de_etapa');
    out.stage_final = r.stage_novo;
    out.temperatura = r.temperatura;
    out.score = r.score;
    out.objecao_count = Math.max(out.objecao_count, r.objecao_count || 0);
    out.send_preview = out.send_preview || !!r.send_preview;
    out.booked = out.booked || !!r.booked;
    variables = r.variables || variables;
    stage = r.stage_novo;
    history.push({ direction: 'in', text: msg });
    history.push({ direction: 'out', text: reply });
    if (r.done) break;
  }
  out.violations = [...new Set(out.violations)];
  out.guardrail_violado = out.violations.length > 0;
  return out;
}

function printTable(rep) {
  const bar = '-'.repeat(96);
  console.log(`\nFLOW: ${rep.flowId}   @ ${rep.ts}`);
  console.log(`\n>>> SAUDE DO FLOW: ${rep.health}%  (personas que agendam SEM violar guard-rail) <<<\n`);
  console.log(bar);
  console.log(['persona'.padEnd(16), 'stage_ini->fim'.padEnd(24), 'temp'.padEnd(7), 'sc', 'obj', 'prev', 'book', 'guard'].join(' '));
  console.log(bar);
  for (const r of rep.personas) {
    console.log([
      r.id.padEnd(16),
      `${r.stage_inicial}->${r.stage_final}`.padEnd(24),
      String(r.temperatura).padEnd(7),
      String(r.score).padEnd(2),
      String(r.objecao_count).padEnd(3),
      (r.send_preview ? 'sim' : '-').padEnd(4),
      (r.booked ? 'SIM' : '-').padEnd(4),
      r.guardrail_violado ? ('VIOLOU:' + r.violations.join(',')) : 'ok',
    ].join(' '));
  }
  console.log(bar);
}

function printDiff(base, cur) {
  console.log('\n================ DIFF vs BASELINE ================');
  console.log(`health: baseline ${base.health}%  ->  atual ${cur.health}%  (delta ${cur.health - base.health >= 0 ? '+' : ''}${cur.health - base.health})`);
  const bById = Object.fromEntries(base.personas.map((p) => [p.id, p]));
  const fields = ['stage_final', 'temperatura', 'score', 'objecao_count', 'booked', 'guardrail_violado'];
  let changes = 0;
  let novasViolacoes = false;
  for (const c of cur.personas) {
    const b = bById[c.id];
    if (!b) { console.log(`+ NOVA persona ${c.id}`); changes++; continue; }
    const diffs = [];
    for (const f of fields) {
      if (JSON.stringify(b[f]) !== JSON.stringify(c[f])) diffs.push(`${f}: ${JSON.stringify(b[f])} -> ${JSON.stringify(c[f])}`);
    }
    if (c.guardrail_violado && !b.guardrail_violado) novasViolacoes = true;
    if (diffs.length) { console.log(`~ ${c.id}:\n    ${diffs.join('\n    ')}`); changes += diffs.length; }
  }
  if (!changes) console.log('(sem mudancas vs baseline)');
  const go = !novasViolacoes && cur.health >= base.health;
  console.log(`\nDECISAO: ${go ? 'GO ✅' : 'NO-GO ⛔'}  ${novasViolacoes ? '(nova violacao de guard-rail!)' : ''}${cur.health < base.health ? ' (saude caiu)' : ''}`);
  console.log('=================================================\n');
  process.exitCode = go ? 0 : 1;
}

(async () => {
  if (!KEY) { console.error('SDR_API_KEY ausente no .env'); process.exit(2); }
  const results = [];
  for (const p of personas) { process.stderr.write(`... rodando ${p.id}\n`); results.push(await runPersona(p)); }
  const ok = results.filter((r) => r.booked && !r.guardrail_violado).length;
  const health = Math.round((100 * ok) / results.length);
  const report = { flowId, ts: new Date().toISOString(), health, personas: results };
  fs.writeFileSync(path.join(BASE, `${flowId}.latest.json`), JSON.stringify(report, null, 2));
  printTable(report);
  if (mode === 'baseline') {
    fs.writeFileSync(path.join(BASE, `${flowId}.json`), JSON.stringify(report, null, 2));
    console.log(`\nbaseline abençoado: baselines/${flowId}.json (health=${health}%)\n`);
  } else if (mode === 'diff') {
    const bpath = path.join(BASE, `${flowId}.json`);
    if (!fs.existsSync(bpath)) { console.log(`\nsem baseline ainda — rode: node tools/sim_runner.mjs baseline ${flowId}\n`); return; }
    printDiff(JSON.parse(fs.readFileSync(bpath, 'utf8')), report);
  }
})();
