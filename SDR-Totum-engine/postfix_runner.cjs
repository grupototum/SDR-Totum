/* postfix_runner.cjs — roda as personas adaptativas contra a cópia PATCHEADA do brain
 * (src/brain.v2fix.js) EM PROCESSO. Não usa HTTP, não toca o engine vivo nem brain.js.
 * Uso: node postfix_runner.cjs [runs=8]
 */
const fs = require('fs');
const path = require('path');
// carrega .env -> process.env
for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('='); if (i < 0) continue;
  const k = line.slice(0, i); const v = line.slice(i + 1).replace(/^"|"$/g, '');
  if (!(k in process.env)) process.env[k] = v;
}
// TRAVA: postfix usa SEMPRE a chave/provider dedicado de sim — nunca a de producao.
if (!process.env.GEMINI_API_KEY_SIM && !process.env.NVIDIA_API_KEY_SIM && !process.env.GROQ_API_KEY_SIM) {
  console.error('BLOQUEADO: nenhuma chave de sim (GEMINI_API_KEY_SIM / NVIDIA_API_KEY_SIM). Configure antes de rodar — full-stop na cota de producao (MSG-VPS-20260622-8).');
  process.exit(3);
}
const { callBrain } = require('./src/brain.v2fix.js');
const { defaultDemoVariables } = require('./src/engine.js');
const DELAY_MS = Number(process.env.SIM_DELAY_MS || 1500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rawFlow = JSON.parse(fs.readFileSync('/tmp/v2flow.json', 'utf8'));
const def = rawFlow.definition || rawFlow;
const personas = JSON.parse(fs.readFileSync('./tools/personas.adaptive.json', 'utf8'));
const RUNS = Math.max(1, Number(process.argv[2] || 8));
const MAX_TURNS = 12; const STALL_LIMIT = 4;
const PRICE_RE = /r\$\s*\d|\d+\s*reais|\d+\s*mil\b|\d+\s*contos?\b/i;

function nextLeadMessage(p, stage, visits, obj) {
  if (obj.n > 0 && Array.isArray(p.prefix_objections) && p.prefix_objections.length) {
    const idx = p.prefix_objections.length - obj.n; obj.n -= 1;
    return p.prefix_objections[Math.min(idx, p.prefix_objections.length - 1)];
  }
  const opts = (p.by_stage && p.by_stage[stage]) || p.fallback || ['ok'];
  const seen = visits[stage] || 0; visits[stage] = seen + 1;
  return opts[Math.min(seen, opts.length - 1)];
}

async function runOnce(p) {
  let history = [{ direction: 'out', text: p.opening }];
  let variables = Object.assign({}, defaultDemoVariables());
  let stage = ''; let curStage = 'abertura';
  const visits = {}; const obj = { n: (p.prefix_objections || []).length };
  const res = { stage_final: 'abertura', booked: false, reached_ag: false, objecao_count: 0, violations: [], ms_total: 0, calls: 0 };
  let same = 0;
  for (let t = 0; t < MAX_TURNS; t++) {
    const msg = nextLeadMessage(p, curStage, visits, obj);
    const session = { id: 'sim', currentNodeId: stage || undefined, score: Number(variables.__score) || 1, variables };
    let r;
    const _t0 = Date.now();
    try { r = await callBrain({ session, history, lastMessage: msg, classificacao: '', flowOverride: { definition: def } }); }
    catch (e) { res.violations.push('erro:' + e.message); break; }
    res.ms_total += Date.now() - _t0; res.calls += 1;
    await sleep(DELAY_MS); // throttle entre chamadas
    const reply = (r.reply || []).join(' ');
    if (PRICE_RE.test(reply) && !r.send_preview) res.violations.push('preco_revelado');
    if (r.send_preview && r.stage !== 'previa' && r.stage !== 'oferta_previa') res.violations.push('preview_fora_de_etapa');
    if (r.booked && !(r.stage === 'agendamento' || r.stage === 'encerrado')) res.violations.push('book_fora_de_etapa');
    const advanced = r.stage !== curStage;
    res.stage_final = r.stage; res.booked = res.booked || !!r.booked;
    res.objecao_count = Math.max(res.objecao_count, r.objecao_count || 0);
    if (r.stage === 'agendamento') res.reached_ag = true; // SO agendamento real (encerrado pode ser fecho frio)
    variables = session.variables; stage = r.stage; curStage = r.stage;
    history.push({ direction: 'in', text: msg }); history.push({ direction: 'out', text: reply });
    if (r.done) break;
    same = advanced ? 0 : same + 1; if (same >= STALL_LIMIT) break;
  }
  res.violations = [...new Set(res.violations)]; res.clean = res.violations.length === 0;
  return res;
}

(async () => {
  async function runPersona(p) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) { runs.push(await runOnce(p)); process.stderr.write(`... ${p.id} ${i + 1}/${RUNS}\n`); }
    const hist = {}; let booked = 0, bookedClean = 0, reachedAgClean = 0, msSum = 0, callSum = 0; const viol = new Set();
    for (const r of runs) { hist[r.stage_final] = (hist[r.stage_final] || 0) + 1; if (r.booked) booked++; if (r.booked && r.clean) bookedClean++; if (r.reached_ag && r.clean) reachedAgClean++; msSum += r.ms_total; callSum += r.calls; r.violations.forEach((v) => viol.add(v)); }
    const N = runs.length; const modal = Object.entries(hist).sort((a, b) => b[1] - a[1])[0][0];
    return { id: p.id, _i: personas.findIndex((x) => x.id === p.id), modal, hist, booked_rate: Math.round(100 * booked / N), bk_clean: Math.round(100 * bookedClean / N), chegaAg: Math.round(100 * reachedAgClean / N), lat_ms: callSum ? Math.round(msSum / callSum) : 0, viol: [...viol] };
  }
  // SIM_PARALLEL=1 so para PROVIDER DEDICADO de sim (medido tolerar concorrencia). Default sequencial.
  let summ;
  if (process.env.SIM_PARALLEL === '1') summ = await Promise.all(personas.map(runPersona));
  else { summ = []; for (const p of personas) summ.push(await runPersona(p)); }
  summ.sort((a, b) => a._i - b._i);
  const N = RUNS * personas.length;
  const health = Math.round(100 * summ.reduce((a, p) => a + Math.round(p.bk_clean / 100 * RUNS), 0) / N);
  const interim = Math.round(100 * summ.reduce((a, p) => a + Math.round(p.chegaAg / 100 * RUNS), 0) / N);
  const MODEL = process.env.NVIDIA_MODEL_SIM || process.env.NVIDIA_MODEL || '(default)';
  const latAll = summ.reduce((a, p) => a + p.lat_ms, 0) / (summ.length || 1);
  console.log(`\n=== PÓS-FIX · MODELO: ${MODEL} · runs/persona=${RUNS} ===`);
  console.log(`>>> booked_clean: ${health}%   ·   chega-agendamento: ${interim}%   ·   latência média/turno: ${Math.round(latAll)}ms <<<\n`);
  const bar = '-'.repeat(116);
  console.log(bar);
  console.log(['persona'.padEnd(14), 'modal'.padEnd(13), 'chegaAg%'.padEnd(9), 'booked%'.padEnd(8), 'bk_clean%'.padEnd(10), 'lat/turno'.padEnd(10), 'dist'].join(' '));
  console.log(bar);
  for (const p of summ) {
    const d = Object.entries(p.hist).map(([s, n]) => `${s}:${n}`).join(' ');
    const v = p.viol.length ? '  ⚠ ' + p.viol.join(',') : '';
    console.log([p.id.padEnd(14), p.modal.padEnd(13), (p.chegaAg + '%').padEnd(9), (p.booked_rate + '%').padEnd(8), (p.bk_clean + '%').padEnd(10), (p.lat_ms + 'ms').padEnd(10), d + v].join(' '));
  }
  console.log(bar);
})();
