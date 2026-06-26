#!/usr/bin/env node
// sim_runner.v2.mjs — bateria ADAPTATIVA + distribuição (estabiliza o não-determinismo)
// Personas adaptativas: a cada turno o lead responde à pergunta REAL do bot,
// escolhendo a fala pelo ESTÁGIO corrente devolvido pelo /api/sim/turn.
//
// Uso:
//   node tools/sim_runner.v2.mjs run      [flowId] [runs=8]
//   node tools/sim_runner.v2.mjs baseline [flowId] [runs=8]
//   node tools/sim_runner.v2.mjs diff     [flowId] [runs=8]
// Stateless, sem Evolution, sem persistir. Não toca comercial/N8N/prompt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = path.join(ROOT, 'baselines');
fs.mkdirSync(BASE, { recursive: true });

function loadEnv() {
  const out = {};
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('='); if (i < 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, '');
  }
  return out;
}
const env = loadEnv();
const PORT = env.PORT || '3002';
const KEY = env.SDR_API_KEY || '';
const ENDPOINT = `http://127.0.0.1:${PORT}/api/sim/turn`;
const MAX_TURNS = 12;  // teto duro de turnos
const STALL_LIMIT = 4; // N turnos seguidos no mesmo stage sem avancar = travou (early-stop)
const DELAY_MS = Number(process.env.SIM_DELAY_MS || 1500); // throttle entre chamadas (chave compartilhada)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const mode = process.argv[2] || 'run';
const flowId = process.argv[3] || 'sdr-odonto-stages-v2';
const RUNS = Math.max(1, Number(process.argv[4] || 8));
const PERSONAS_FILE = process.env.PERSONAS_FILE || path.join(__dirname, 'personas.adaptive.json');
const personas = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'));
const PRICE_RE = /r\$\s*\d|\d+\s*reais|\d+\s*mil\b|\d+\s*contos?\b/i;

async function turn(body) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  await sleep(DELAY_MS); // throttle: nunca martelar a chave compartilhada
  return j;
}

// responder adaptativo: escolhe a fala do lead pelo estágio corrente do bot
function nextLeadMessage(p, stage, stageVisits, objLeft) {
  if (objLeft.n > 0 && Array.isArray(p.prefix_objections) && p.prefix_objections.length) {
    const idx = p.prefix_objections.length - objLeft.n;
    objLeft.n -= 1;
    return p.prefix_objections[Math.min(idx, p.prefix_objections.length - 1)];
  }
  const opts = (p.by_stage && p.by_stage[stage]) || p.fallback || ['ok'];
  const seen = stageVisits[stage] || 0;
  stageVisits[stage] = seen + 1;
  return opts[Math.min(seen, opts.length - 1)];
}

async function runOnce(p) {
  let history = [{ direction: 'out', text: p.opening }];
  let variables = {}; let stage = ''; let curStage = 'abertura';
  const stageVisits = {}; const objLeft = { n: (p.prefix_objections || []).length };
  const res = { stage_final: 'abertura', temperatura: '', booked: false, reached_ag: false, objecao_count: 0, violations: [], stalled: false };
  let sameStage = 0;
  for (let t = 0; t < MAX_TURNS; t++) {
    const msg = nextLeadMessage(p, curStage, stageVisits, objLeft);
    const r = await turn({ flowId, stage, variables, history, lastMessage: msg });
    if (r.error) { res.violations.push('erro_engine'); break; }
    const reply = (r.reply || []).join(' ');
    if (PRICE_RE.test(reply) && !r.send_preview) res.violations.push('preco_revelado');
    if (r.send_preview && r.stage_novo !== 'previa') res.violations.push('preview_fora_de_etapa');
    if (r.booked && !(r.stage_novo === 'agendamento' || r.stage_novo === 'encerrado')) res.violations.push('book_fora_de_etapa');
    const advanced = r.stage_novo !== curStage;
    res.stage_final = r.stage_novo; res.temperatura = r.temperatura;
    res.objecao_count = Math.max(res.objecao_count, r.objecao_count || 0);
    res.booked = res.booked || !!r.booked;
    if (r.stage_novo === 'agendamento') res.reached_ag = true; // SO agendamento real (encerrado pode ser fecho frio)
    variables = r.variables || variables; stage = r.stage_novo; curStage = r.stage_novo;
    history.push({ direction: 'in', text: msg });
    history.push({ direction: 'out', text: reply });
    if (r.done) break;
    sameStage = advanced ? 0 : sameStage + 1;
    if (sameStage >= STALL_LIMIT) { res.stalled = true; break; } // travou: nao avanca ha STALL_LIMIT turnos
  }
  res.violations = [...new Set(res.violations)];
  res.clean = res.violations.length === 0;
  return res;
}

function summarize(id, label, runs) {
  const hist = {};
  let booked = 0; let clean = 0; let bookedClean = 0; let reachedAgClean = 0; const allViol = new Set();
  for (const r of runs) {
    hist[r.stage_final] = (hist[r.stage_final] || 0) + 1;
    if (r.booked) booked++;
    if (r.clean) clean++;
    if (r.booked && r.clean) bookedClean++;
    if (r.reached_ag && r.clean) reachedAgClean++;
    r.violations.forEach((v) => allViol.add(v));
  }
  const N = runs.length;
  const modal = Object.entries(hist).sort((a, b) => b[1] - a[1])[0][0];
  return {
    id, label, runs: N,
    stage_modal: modal,
    stage_dist: hist,
    booked_rate: Math.round((100 * booked) / N),
    bookedClean_rate: Math.round((100 * bookedClean) / N),
    reachedAgClean_rate: Math.round((100 * reachedAgClean) / N), // metrica INTERINA
    violations: [...allViol],
  };
}

function printReport(rep) {
  console.log(`\nFLOW: ${rep.flowId}  · runs/persona: ${rep.runs}  @ ${rep.ts}`);
  console.log(`\n>>> SAÚDE INTERINA: ${rep.health_interim}%  (chega a agendamento sem violar guard-rail) <<<`);
  console.log(`    SAÚDE REAL (agenda fechada/booked): ${rep.health}%`);
  const bar = '-'.repeat(112);
  console.log('\n' + bar);
  console.log(['persona'.padEnd(14), 'stage_modal'.padEnd(13), 'chegaAg%'.padEnd(9), 'booked%'.padEnd(8), 'bk_clean%'.padEnd(10), 'distribuição (stage_final×N)'].join(' '));
  console.log(bar);
  for (const p of rep.personas) {
    const dist = Object.entries(p.stage_dist).map(([s, n]) => `${s}:${n}`).join(' ');
    const v = p.violations.length ? '  ⚠ ' + p.violations.join(',') : '';
    console.log([p.id.padEnd(14), p.stage_modal.padEnd(13), (p.reachedAgClean_rate + '%').padEnd(9), (p.booked_rate + '%').padEnd(8), (p.bookedClean_rate + '%').padEnd(10), dist + v].join(' '));
  }
  console.log(bar);
}

function printDiff(base, cur) {
  console.log('\n================ DIFF vs BASELINE ================');
  console.log(`saúde: ${base.health}% -> ${cur.health}%  (Δ ${cur.health - base.health >= 0 ? '+' : ''}${cur.health - base.health})`);
  const bById = Object.fromEntries(base.personas.map((p) => [p.id, p]));
  let novasViol = false; let changes = 0;
  for (const c of cur.personas) {
    const b = bById[c.id]; if (!b) { console.log(`+ nova persona ${c.id}`); changes++; continue; }
    const d = [];
    if (Math.abs(c.booked_rate - b.booked_rate) >= 20) d.push(`booked ${b.booked_rate}%->${c.booked_rate}%`);
    if (c.stage_modal !== b.stage_modal) d.push(`modal ${b.stage_modal}->${c.stage_modal}`);
    if (c.violations.length && !b.violations.length) { novasViol = true; d.push('NOVA violação:' + c.violations.join(',')); }
    if (d.length) { console.log(`~ ${c.id}: ${d.join(' · ')}`); changes += d.length; }
  }
  if (!changes) console.log('(estável vs baseline — variação < limiar)');
  const go = !novasViol && cur.health >= base.health - 10; // tolera 10pp de ruído estatístico
  console.log(`\nDECISÃO: ${go ? 'GO ✅' : 'NO-GO ⛔'}${novasViol ? ' (nova violação!)' : ''}`);
  console.log('=================================================\n');
  process.exitCode = go ? 0 : 1;
}

(async () => {
  if (!KEY) { console.error('SDR_API_KEY ausente'); process.exit(2); }
  // TRAVA DE SEGURANCA (MSG-VPS-20260622-8): nao rodar contra a chave Gemini de producao.
  // Libere SO depois que o engine tiver provider/chave dedicada de sim ativa, exportando SIM_KEY_READY=1.
  if (process.env.SIM_KEY_READY !== '1') {
    console.error('BLOQUEADO: o harness bate na chave/provider do engine vivo. Rodar agora consumiria a cota de PRODUCAO.');
    console.error('Habilite a chave/provider dedicado de sim no engine e rode com SIM_KEY_READY=1 para liberar.');
    process.exit(3);
  }
  // SEQUENCIAL (sem paralelo na chave compartilhada) + throttle por DELAY_MS dentro de turn()
  const persSummaries = [];
  for (const p of personas) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) { runs.push(await runOnce(p)); process.stderr.write(`... ${p.id} ${i + 1}/${RUNS}\n`); }
    persSummaries.push(summarize(p.id, p.label, runs));
  }
  const totalPairs = persSummaries.reduce((a, p) => a + p.runs, 0);
  const bookedCleanPairs = persSummaries.reduce((a, p) => a + Math.round((p.bookedClean_rate / 100) * p.runs), 0);
  const reachedAgCleanPairs = persSummaries.reduce((a, p) => a + Math.round((p.reachedAgClean_rate / 100) * p.runs), 0);
  const health = Math.round((100 * bookedCleanPairs) / totalPairs);            // métrica REAL (agenda fechada)
  const health_interim = Math.round((100 * reachedAgCleanPairs) / totalPairs); // INTERINA: chega a agendamento limpo
  const report = { flowId, ts: new Date().toISOString(), runs: RUNS, health, health_interim, personas: persSummaries };
  fs.writeFileSync(path.join(BASE, `${flowId}.latest.json`), JSON.stringify(report, null, 2));
  printReport(report);
  if (mode === 'baseline') {
    fs.writeFileSync(path.join(BASE, `${flowId}.json`), JSON.stringify(report, null, 2));
    console.log(`\nbaseline abençoado (runs=${RUNS}, saúde=${health}%)\n`);
  } else if (mode === 'diff') {
    const bp = path.join(BASE, `${flowId}.json`);
    if (!fs.existsSync(bp)) { console.log(`\nsem baseline — rode: node tools/sim_runner.v2.mjs baseline ${flowId} ${RUNS}\n`); return; }
    printDiff(JSON.parse(fs.readFileSync(bp, 'utf8')), report);
  }
})();
