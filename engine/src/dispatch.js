// Disparo da ABERTURA para leads status=novo. Valida variáveis obrigatórias; sem elas, ABORTA o lead.
// Uso: node src/dispatch.js [--limit N] [--dry-run]
import { openDb, STATUS, getLeadsByStatus, setLeadState, addMessage } from './db.js';
import { think } from './brain.js';
import { missingRequired, validateOutbound } from './guardrails.js';
import { makeEvolutionTransport } from './evolution.js';

export async function dispatchNewLeads(db, transport, { limit = Infinity, dryRun = false, log = console } = {}) {
  const leads = getLeadsByStatus(db, STATUS.NOVO).slice(0, limit);
  const results = [];
  for (const lead of leads) {
    const missing = missingRequired(lead);
    if (missing.length) {
      setLeadState(db, lead.id, { status: STATUS.ABORTADO, abort_reason: `faltando:${missing.join(',')}` });
      log.warn?.(`[dispatch] ABORTADO ${lead.whatsapp}: faltando ${missing.join(', ')}`);
      results.push({ lead: lead.whatsapp, ok: false, reason: `faltando:${missing.join(',')}` });
      continue;
    }
    try {
      const out = await think(lead, [], {});
      const check = validateOutbound(out.mensagem, lead, []);
      if (!check.ok) {
        setLeadState(db, lead.id, { status: STATUS.ABORTADO, abort_reason: `guardrail:${check.reason}` });
        log.error?.(`[dispatch] ABORTADO ${lead.whatsapp}: guardrail ${check.reason}`);
        results.push({ lead: lead.whatsapp, ok: false, reason: check.reason });
        continue;
      }
      if (dryRun) {
        log.info?.(`[dry-run] ${lead.whatsapp}: ${out.mensagem}`);
        results.push({ lead: lead.whatsapp, ok: true, dryRun: true, mensagem: out.mensagem });
        continue;
      }
      await transport.sendText(lead.whatsapp, out.mensagem);
      addMessage(db, lead.id, 'out', out.mensagem);
      setLeadState(db, lead.id, { status: STATUS.EM_CONVERSA, stage: out.stage, temperatura: out.temperatura });
      log.info?.(`[dispatch] enviado p/ ${lead.whatsapp}`);
      results.push({ lead: lead.whatsapp, ok: true });
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000)); // ritmo humano entre leads
    } catch (e) {
      log.error?.(`[dispatch] ERRO ${lead.whatsapp}: ${e.message} (lead permanece novo p/ retry)`);
      results.push({ lead: lead.whatsapp, ok: false, reason: e.message });
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
  const dryRun = args.includes('--dry-run');
  const db = openDb();
  const transport = dryRun ? { async sendText() {} } : makeEvolutionTransport();
  const r = await dispatchNewLeads(db, transport, { limit, dryRun });
  console.log(`[dispatch] concluído: ${r.filter(x => x.ok).length}/${r.length} ok`);
}
