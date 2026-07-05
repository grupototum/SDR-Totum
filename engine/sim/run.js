// SIMULADOR (obrigatório): lead virtual conversa com o cérebro pelo webhook HTTP real.
// Sem WhatsApp: transporte fake. Uso: node sim/run.js  (SDR_LLM=mock|groq)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { openDb, getLeadByPhone, upsertLead, getHistory } from '../src/db.js';
import { createApp } from '../src/server.js';
import { dispatchNewLeads } from '../src/dispatch.js';
import { makeFakeTransport } from '../src/evolution.js';
import { normalizeText, hasPlaceholder, hasInventedName } from '../src/guardrails.js';
import { setFlowOverride, resetFlowCache } from '../src/flow.js';

const __dir = dirname(fileURLToPath(import.meta.url));
export const personas = JSON.parse(readFileSync(join(__dir, 'personas.json'), 'utf8'));

const MAX_TROCAS = 15;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitBotReply(db, leadId, prevOutCount, timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const hist = getHistory(db, leadId);
    const outs = hist.filter(m => m.direction === 'out');
    if (outs.length > prevOutCount) {
      // Deixa o turno assentar (bloco áudio manda várias msgs em sequência) e devolve TODAS as novas.
      await sleep(250);
      const settled = getHistory(db, leadId).filter(m => m.direction === 'out');
      return settled.slice(prevOutCount).map(m => m.text);
    }
    const lead = db.prepare('SELECT status FROM leads WHERE id=?').get(leadId);
    if (lead.status !== 'em_conversa') return null; // travou por guardrail -> humano
    await sleep(80);
  }
  throw new Error('timeout esperando resposta do bot');
}

/**
 * Roda uma persona contra o flow em memória (ou o flow padrão do disco se `flow` for omitido).
 * `llm`: 'mock' | 'groq' | 'nvidia' — sobrescreve SDR_LLM só durante esta chamada.
 */
export async function runPersona(p, { flow, llm } = {}) {
  const prevLlm = process.env.SDR_LLM;
  // 'real' = usa o que já estiver configurado no ambiente (groq/nvidia), sem sobrescrever.
  if (llm && llm !== 'real') process.env.SDR_LLM = llm;
  else if (!process.env.SDR_LLM) process.env.SDR_LLM = process.env.GROQ_API_KEY ? 'groq' : 'mock';
  if (flow) setFlowOverride(flow);

  const db = openDb(':memory:');
  const transport = makeFakeTransport();
  const app = createApp({ db, transport, debounceMs: 60, log: { info() {}, warn: console.warn, error: console.error } });
  const server = await new Promise(res => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const url = `http://127.0.0.1:${server.address().port}/webhook/evolution`;

  const log = [];
  const violations = [];
  const say = (who, text) => { log.push(`  ${who === 'bot' ? '🤖 BOT ' : '👤 LEAD'} | ${text}`); };

  try {
    upsertLead(db, p.lead);
    // Disparo da abertura
    const disp = await dispatchNewLeads(db, transport, { log: { info() {}, warn: console.warn, error: console.error }, humanize: false });
    if (!disp[0]?.ok) throw new Error(`disparo falhou: ${disp[0]?.reason}`);
    const lead = getLeadByPhone(db, p.lead.whatsapp);
    say('bot', transport.sent[0].text);

    let trocas = 1;
    let msgSeq = 0;
    for (const turn of p.turns) {
      if (trocas >= MAX_TROCAS) break;
      const cur = db.prepare('SELECT status FROM leads WHERE id=?').get(lead.id);
      if (cur.status !== 'em_conversa') break;
      say('lead', turn);
      const prevOut = getHistory(db, lead.id).filter(m => m.direction === 'out').length;
      await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'messages.upsert', data: { key: { fromMe: false, remoteJid: `${p.lead.whatsapp}@s.whatsapp.net`, id: `SIM-${p.id}-${++msgSeq}` }, message: { conversation: turn } } }),
      });
      const replies = await waitBotReply(db, lead.id, prevOut);
      for (const reply of replies || []) say('bot', reply);
      trocas++;
    }

    const fin = db.prepare('SELECT * FROM leads WHERE id=?').get(lead.id);
    const bots = getHistory(db, lead.id).filter(m => m.direction === 'out').map(m => m.text);

    // Checks
    const seen = new Map();
    for (const b of bots) {
      const n = normalizeText(b);
      if (n.length >= 12 && seen.has(n)) violations.push(`frase repetida: "${b.slice(0, 60)}..."`);
      seen.set(n, true);
      if (hasPlaceholder(b)) violations.push(`placeholder: "${b.slice(0, 60)}"`);
      if (hasInventedName(b, p.lead)) violations.push(`nome inventado: "${b.slice(0, 60)}"`);
    }
    const desfechos = p.desfecho_esperado.split('|');
    if (!desfechos.includes(fin.status)) violations.push(`desfecho ${fin.status}, esperado ${p.desfecho_esperado}`);
    if (trocas > MAX_TROCAS) violations.push(`estourou ${MAX_TROCAS} trocas`);
    if (p.id === 'secretaria') {
      const posGk = bots.slice(1).join(' ').toLowerCase();
      if (!/(encaminh|áudio|audio|canal|e-mail|email|whatsapp)/.test(posGk)) violations.push('secretária: bot não mudou de abordagem');
      const pitch = /uma cl[ií]nica por regi[aã]o|oportunidade que enxerguei/i;
      if (bots.slice(1).some(b => pitch.test(b))) violations.push('secretária: bot despejou o pitch no gatekeeper');
      // BLOCO ÁUDIO: aceite do áudio tem que disparar os áudios (labels no histórico) ou o resumo MSG-45.
      if (!bots.some(b => /\[áudio 1\/|resumir o áudio/i.test(b))) violations.push('secretária: bloco áudio não disparou');
    }

    return { id: p.id, label: p.label, status: fin.status, stage: fin.stage, temperatura: fin.temperatura, trocas, log, violations };
  } finally {
    server.close();
    if (flow) resetFlowCache();
    process.env.SDR_LLM = prevLlm;
  }
}

// Execução direta via CLI (npm run sim) — comportamento inalterado.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!process.env.SDR_LLM) process.env.SDR_LLM = process.env.GROQ_API_KEY ? 'groq' : 'mock';
  console.log(`\n=== SIMULADOR SDR TOTUM | cérebro: ${process.env.SDR_LLM.toUpperCase()} ===`);
  if (process.env.SDR_LLM === 'mock') {
    console.log('(sem GROQ_API_KEY: rodando com cérebro MOCK determinístico; plumbing/guardrails valem, a prosa final valida com groq)');
  }

  const only = process.argv[2]; // node sim/run.js [id-da-persona]
  const selected = only ? personas.filter(p => p.id === only) : personas;
  let allOk = true;
  for (const p of selected) {
    const r = await runPersona(p);
    const ok = r.violations.length === 0;
    allOk &&= ok;
    console.log(`\n--- Persona: ${r.label} ---`);
    console.log(r.log.join('\n'));
    console.log(`  ➜ desfecho=${r.status} stage=${r.stage} temp=${r.temperatura} trocas=${r.trocas} ${ok ? '✅ PASSOU' : '❌ FALHOU'}`);
    for (const v of r.violations) console.log(`    ⚠️  ${v}`);
  }
  console.log(`\n=== RESULTADO: ${allOk ? '✅ 3/3 PERSONAS PASSARAM' : '❌ HÁ FALHAS'} ===\n`);
  process.exit(allOk ? 0 : 1);
}
