/* trace_personas.cjs — trace turno-a-turno (in-process, brain.v2fix, kind=sim=groq:llama-3.3-70b/BULMA)
 * Uso: node trace_personas.cjs persona1 [persona2 ...]   (default: apressado cetico_preco)
 * Mostra por turno: lead → stage_ant→stage_novo, temp, objecao, send_preview, booked, clamped, e o reply do bot.
 * Não envia, não persiste, não toca produção. Usa GROQ_API_KEY_SIM (BULMA).
 */
const fs = require('fs'); const path = require('path');
for (const l of fs.readFileSync('/root/.openclaw/workspace-paulo/SDR-Totum-engine/.env', 'utf8').split('\n')) { if (!l || l.startsWith('#')) continue; const i = l.indexOf('='); if (i < 0) continue; const k = l.slice(0, i); if (!(k in process.env)) process.env[k] = l.slice(i + 1).replace(/^"|"$/g, ''); }
const brain = require('/root/.openclaw/workspace-paulo/SDR-Totum-engine/src/brain.v2fix.js');
const { defaultDemoVariables } = require('/root/.openclaw/workspace-paulo/SDR-Totum-engine/src/engine.js');
const def = JSON.parse(fs.readFileSync('/tmp/v2flow.json', 'utf8')).definition;
const personas = JSON.parse(fs.readFileSync('/root/.openclaw/workspace-paulo/SDR-Totum-engine/tools/personas.adaptive.json', 'utf8'));
const want = process.argv.slice(2); const list = want.length ? want : ['apressado', 'cetico_preco'];
const MAX = 12, STALL = 4; const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function nextMsg(p, stage, visits, obj) {
  if (obj.n > 0 && p.prefix_objections && p.prefix_objections.length) { const i = p.prefix_objections.length - obj.n; obj.n -= 1; return p.prefix_objections[Math.min(i, p.prefix_objections.length - 1)]; }
  const opts = (p.by_stage && p.by_stage[stage]) || p.fallback || ['ok']; const s = visits[stage] || 0; visits[stage] = s + 1; return opts[Math.min(s, opts.length - 1)];
}

(async () => {
  for (const id of list) {
    const p = personas.find(x => x.id === id); if (!p) { console.log('persona não encontrada:', id); continue; }
    console.log(`\n================ PERSONA: ${id} (${p.label}) ================`);
    let history = [{ direction: 'out', text: p.opening }]; let variables = Object.assign({}, defaultDemoVariables()); let stage = ''; let cur = 'abertura'; const visits = {}; const obj = { n: (p.prefix_objections || []).length }; let same = 0;
    console.log(`[BOT abertura] ${p.opening}`);
    for (let t = 0; t < MAX; t++) {
      const msg = nextMsg(p, cur, visits, obj);
      const session = { id: 'sim', currentNodeId: stage || undefined, score: Number(variables.__score) || 1, variables };
      let r; try { r = await brain.callBrain({ session, history, lastMessage: msg, classificacao: '', flowOverride: { definition: def } }); } catch (e) { console.log(`  T${t + 1} ERRO: ${e.message}`); break; }
      const reply = (r.reply || []).join(' | ');
      console.log(`\n  T${t + 1} [LEAD] ${msg}`);
      console.log(`       stage ${r.stage_anterior} -> ${r.stage}  | temp=${r.temperatura} obj=${r.objecao_count} prev=${r.send_preview} book=${r.booked} clamped=${r.clamped} proposto=${r.stage_proposto}`);
      console.log(`       [BOT] ${reply}`);
      variables = session.variables; const adv = r.stage !== cur; stage = r.stage; cur = r.stage;
      history.push({ direction: 'in', text: msg }); history.push({ direction: 'out', text: reply });
      if (r.done) { console.log('       (done)'); break; }
      same = adv ? 0 : same + 1; if (same >= STALL) { console.log(`       (travou: ${STALL} turnos sem avançar em "${cur}")`); break; }
      await sleep(1200);
    }
  }
})();
