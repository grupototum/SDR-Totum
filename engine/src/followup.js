// Processa a fila de follow-up da abertura: envia blocos agendados se o lead não respondeu.
import { getPendingFollowups, markFollowupSent, addMessage } from './db.js';
import { normalizeOutboundText } from './evolution.js';

export async function processFollowups(db, transport, log = console) {
  const pending = getPendingFollowups(db);
  if (!pending.length) return;

  // Agrupa por lead para processar um bloco por vez por lead (evita flood).
  const byLead = {};
  for (const fq of pending) {
    if (!byLead[fq.lead_id]) byLead[fq.lead_id] = [];
    byLead[fq.lead_id].push(fq);
  }

  for (const leadId of Object.keys(byLead)) {
    const items = byLead[leadId];
    const next = items[0];
    try {
      const text = normalizeOutboundText(next.text);
      await transport.sendText(next.whatsapp, text);
      addMessage(db, Number(leadId), 'out', text);
      markFollowupSent(db, next.id);
      log.info?.(`[followup] bloco ${next.id} enviado p/ ${next.whatsapp}`);
    } catch (e) {
      log.error?.(`[followup] ERRO bloco ${next.id} p/ ${next.whatsapp}: ${e.message}`);
    }
  }
}
