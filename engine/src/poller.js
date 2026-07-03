// Modo FILA (sem VPS): a Evolution posta eventos direto na tabela sdr_webhook_events do
// Supabase (webhook com headers customizados). Este poller consome a fila e responde.
// Eventos ficam persistidos: o lead pode responder a qualquer hora, nada se perde.
// Produção na VPS pode usar o webhook direto (server.js) OU este mesmo modo.
// Uso: node src/poller.js [--once]  (POLL_MS default 8000)
import { openDb, STATUS, getLeadByPhone, addMessage, markProcessed, normPhone } from './db.js';
import { respondToLead } from './pipeline.js';
import { makeEvolutionTransport } from './evolution.js';
import { extractInbound } from './server.js';

const POLL_MS = Number(process.env.POLL_MS || 8000);
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_ANON_KEY || '';
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

async function fetchQueue() {
  const res = await fetch(`${SB_URL}/rest/v1/sdr_webhook_events?consumed=eq.false&order=id.asc&limit=50`, { headers: sbHeaders, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`queue HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function markConsumed(ids) {
  if (!ids.length) return;
  const res = await fetch(`${SB_URL}/rest/v1/sdr_webhook_events?id=in.(${ids.join(',')})`, {
    method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ consumed: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`markConsumed HTTP ${res.status}`);
}

export async function pollOnce(db, transport, log = console) {
  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY não setadas');
  const rows = await fetchQueue();
  const done = [];
  const touched = new Set(); // telefones com inbound novo neste ciclo

  for (const row of rows) {
    done.push(row.id);
    if (String(row.event || '').toLowerCase() !== 'messages.upsert') continue; // send.message etc: só consome
    const inbound = extractInbound({ data: row.data }); // mesmo parser do webhook (fromMe/grupo/vazio => null)
    if (!inbound) continue;
    if (!markProcessed(db, inbound.waMsgId)) continue;   // dedupe
    const lead = getLeadByPhone(db, inbound.phone);
    if (!lead) { log.info?.(`[poll] ignorado: ${inbound.phone} não é lead`); continue; }
    addMessage(db, lead.id, 'in', inbound.text);
    log.info?.(`[poll] ⬅️  ${inbound.phone}: ${inbound.text.slice(0, 80)}`);
    if (lead.status === STATUS.EM_CONVERSA) touched.add(inbound.phone);
    else log.info?.(`[poll] ${inbound.phone} status=${lead.status}: registrado sem resposta`);
  }

  let responded = 0;
  for (const phone of touched) { // 1 resposta por lead por ciclo (o ciclo já agrupa rajadas)
    const lead = getLeadByPhone(db, phone);
    const r = await respondToLead(db, transport, lead, log);
    if (r.sent) { responded++; log.info?.(`[poll] ➡️  ${phone}: ${r.state.mensagem.slice(0, 80)} [${r.status}]`); }
    else log.warn?.(`[poll] não enviado p/ ${phone}: ${r.reason}`);
  }
  await markConsumed(done);
  return responded;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  const transport = makeEvolutionTransport();
  const once = process.argv.includes('--once');
  console.log(`[poll] modo fila Supabase ${once ? '(uma passada)' : `a cada ${POLL_MS}ms`} — instância ${process.env.EVOLUTION_INSTANCE}`);
  if (once) {
    await pollOnce(db, transport);
  } else {
    for (;;) {
      try { await pollOnce(db, transport); } catch (e) { console.error('[poll] erro:', e.message); }
      await new Promise(r => setTimeout(r, POLL_MS));
    }
  }
}
