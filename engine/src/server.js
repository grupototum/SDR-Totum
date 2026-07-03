// Serviço único: webhook Evolution + debounce + retomada pós-restart.
import express from 'express';
import { openDb, STATUS, getLeadByPhone, addMessage, markProcessed, normPhone, getLeadsAwaitingReply } from './db.js';
import { respondToLead } from './pipeline.js';
import { makeEvolutionTransport } from './evolution.js';

export function extractInbound(body) {
  // Evolution v2 messages.upsert. Retorna null p/ tudo que deve ser ignorado (anti-loop).
  const data = body?.data ?? body;
  const key = data?.key;
  if (!key) return null;
  if (key.fromMe === true) return null; // ANTI-LOOP: nunca reagir à própria mensagem
  const remoteJid = key.remoteJid || '';
  if (remoteJid.endsWith('@g.us')) return null; // grupos: fora de escopo
  const text = data?.message?.conversation
    || data?.message?.extendedTextMessage?.text
    || data?.message?.imageMessage?.caption
    || '';
  if (!String(text).trim()) return null;
  return { phone: normPhone(remoteJid.split('@')[0]), text: String(text).trim(), waMsgId: key.id || null };
}

export function createApp({ db, transport, debounceMs = Number(process.env.DEBOUNCE_MS || 4000), log = console }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const timers = new Map(); // phone -> timeout (debounce)

  function scheduleReply(phone) {
    clearTimeout(timers.get(phone));
    timers.set(phone, setTimeout(async () => {
      timers.delete(phone);
      const lead = getLeadByPhone(db, phone);
      if (!lead) return;
      try {
        const r = await respondToLead(db, transport, lead, log);
        log.info?.(`[reply] ${phone} sent=${r.sent} status=${r.status ?? r.reason}`);
      } catch (e) {
        log.error?.(`[reply] ERRO ${phone}: ${e.message}`);
      }
    }, debounceMs));
  }

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'sdr-totum' }));

  app.post('/webhook/evolution', (req, res) => {
    res.json({ ok: true }); // responde já; processamento é assíncrono
    try {
      const inbound = extractInbound(req.body);
      if (!inbound) return;
      if (!markProcessed(db, inbound.waMsgId)) return; // dedupe
      const lead = getLeadByPhone(db, inbound.phone);
      if (!lead) { log.info?.(`[webhook] ignorado: ${inbound.phone} não é lead`); return; }
      if (![STATUS.EM_CONVERSA].includes(lead.status)) {
        addMessage(db, lead.id, 'in', inbound.text); // registra, mas não responde (ganho/humano/encerrado)
        log.info?.(`[webhook] ${inbound.phone} status=${lead.status}: registrado sem resposta`);
        return;
      }
      addMessage(db, lead.id, 'in', inbound.text);
      scheduleReply(inbound.phone); // debounce: agrupa mensagens rápidas
    } catch (e) {
      log.error?.(`[webhook] ERRO: ${e.message}`);
    }
  });

  // Retomada pós-restart: leads em conversa com inbound sem resposta voltam pra fila.
  app.resumePending = () => {
    for (const lead of getLeadsAwaitingReply(db)) {
      log.info?.(`[resume] retomando conversa com ${lead.whatsapp}`);
      scheduleReply(lead.whatsapp);
    }
  };

  return app;
}

// Execução direta (produção)
if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb();
  const transport = makeEvolutionTransport();
  const app = createApp({ db, transport });
  const port = Number(process.env.PORT || 3010);
  app.listen(port, '127.0.0.1', () => {
    console.log(`SDR Totum ouvindo em 127.0.0.1:${port}`);
    app.resumePending();
  });
}
