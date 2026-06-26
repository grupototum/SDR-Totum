/**
 * debounce.js — fila por phone + janela de debounce para mensagens inbound.
 *
 * Problema que resolve: se o lead enviar 3 mensagens rápidas ("oi", "tudo bem", "é a clínica?"),
 * sem debounce o brain dispararia 3 vezes em paralelo.
 *
 * Comportamento:
 *   - Cada mensagem reinicia o timer daquele phone.
 *   - Quando o timer expira, todas as mensagens acumuladas são combinadas em UMA
 *     string e entregues via onFlush.
 *   - Retorna imediatamente (não aguarda o turn do brain).
 *
 * Habilitado via DEBOUNCE_ENABLED=true no .env.
 * Timer configurável via DEBOUNCE_MS (padrão 1500ms).
 *
 * Criado por Cowork-VPS, 2026-06-23. Gated — NÃO ativo sem DEBOUNCE_ENABLED=true.
 */

const DEBOUNCE_MS = Number(process.env.DEBOUNCE_MS || 1500);
const DEBOUNCE_ENABLED = process.env.DEBOUNCE_ENABLED === 'true';

// Map<phone, { timer: NodeJS.Timeout, messages: string[], flushAt: number }>
const pending = new Map();

/**
 * Enfileira uma mensagem e agenda o flush com debounce.
 *
 * @param {object} opts
 * @param {string}   opts.phone      — número do lead (chave da fila)
 * @param {string}   opts.text       — texto da mensagem recebida
 * @param {Function} opts.onFlush    — async (combinedText: string) => void
 *                                     chamada quando o timer expira
 * @returns {boolean} true se enfileirou (debounce ativo), false se deve processar agora
 */
function enqueue({ phone, text, onFlush }) {
  if (!DEBOUNCE_ENABLED) return false;

  let entry = pending.get(phone);
  if (entry) {
    clearTimeout(entry.timer);
    entry.messages.push(text);
  } else {
    entry = { messages: [text], timer: null, flushAt: 0 };
    pending.set(phone, entry);
  }

  entry.flushAt = Date.now() + DEBOUNCE_MS;
  entry.timer = setTimeout(async () => {
    const e = pending.get(phone);
    if (!e) return;
    pending.delete(phone);
    const combined = e.messages.join('\n');
    console.log(`[debounce] flush phone=${phone} msgs=${e.messages.length} combined_len=${combined.length}`);
    try { await onFlush(combined); }
    catch (err) { console.error('[debounce] onFlush error:', err && err.message); }
  }, DEBOUNCE_MS);

  console.log(`[debounce] queued phone=${phone} queue_size=${entry.messages.length} flush_in=${DEBOUNCE_MS}ms`);
  return true; // enfileirado — caller retorna 200 imediatamente
}

/** Quantas filas abertas (útil para health/debug). */
function pendingCount() { return pending.size; }

/** Cancela a fila de um phone (ex: optout chegou antes do flush). */
function cancel(phone) {
  const e = pending.get(phone);
  if (e) { clearTimeout(e.timer); pending.delete(phone); }
}

module.exports = { enqueue, pendingCount, cancel, DEBOUNCE_ENABLED };
