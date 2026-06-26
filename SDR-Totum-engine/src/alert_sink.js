/* alert_sink.js — sink de alerta de saúde do modelo LLM.
 * ALERT  = sobrescreve SDR_ALERT_FILE + envia Telegram.
 * WARN   = append em SDR_DIGEST_FILE + envia Telegram.
 * Throttle por nível: não pagina mais de 1x por SDR_ALERT_THROTTLE_MS (default 10min).
 * Telegram: usa TG_BOT_TOKEN + TG_CHAT_ID do process.env (carregado via .env no ecosystem.config.cjs).
 */
"use strict";
const fs    = require("node:fs");
const https = require("node:https");

const ALERT_FILE  = process.env.SDR_ALERT_FILE         || "/tmp/sdr-llm-alert.json";
const DIGEST_FILE = process.env.SDR_DIGEST_FILE        || "/tmp/sdr-llm-digest.jsonl";
const THROTTLE_MS = Number(process.env.SDR_ALERT_THROTTLE_MS || 10 * 60 * 1000);
const TG_TOKEN    = process.env.TG_BOT_TOKEN           || "";
const TG_CHAT     = process.env.TG_CHAT_ID             || "";

let _lastAlertAt = 0;
let _lastWarnAt  = 0;

/** Fire-and-forget: não bloqueia o fluxo principal nem propaga exceção. */
function _sendTelegram(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const body = JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: "HTML" });
  const req = https.request(
    {
      hostname: "api.telegram.org",
      path: `/bot${TG_TOKEN}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => { res.resume(); }  // drena resposta sem processar
  );
  req.on("error", () => {});    // swallow erros de rede
  req.write(body);
  req.end();
}

function emit({ level, reason, recovered = false, exhausted = false, attempts = [] }) {
  const now = Date.now();
  const ts  = new Date().toISOString();

  if (level === "ALERT") {
    if (now - _lastAlertAt < THROTTLE_MS) return;
    _lastAlertAt = now;

    // 1. Arquivo (backup para monitor local)
    const payload = JSON.stringify({ level, reason, exhausted, attempts, ts }, null, 2);
    try { fs.writeFileSync(ALERT_FILE, payload, "utf8"); }
    catch (e) { console.error("[alert_sink] write ALERT falhou:", e.message); }

    // 2. Telegram
    _sendTelegram(
      `\u{1F6A8} <b>SDR ALERT</b>\n` +
      `<b>Motivo:</b> ${reason}\n` +
      `<b>Esgotado:</b> ${exhausted}\n` +
      `<code>${ts}</code>`
    );

    console.error(`[SDR→OPS] ⚠️  ALERT LLM: ${reason}`);

  } else if (level === "WARN") {
    if (now - _lastWarnAt < THROTTLE_MS) return;
    _lastWarnAt = now;

    // 1. Arquivo
    const line = JSON.stringify({ level, reason, recovered, attempts, ts }) + "\n";
    try { fs.appendFileSync(DIGEST_FILE, line, "utf8"); }
    catch (e) { console.error("[alert_sink] append WARN falhou:", e.message); }

    // 2. Telegram
    _sendTelegram(
      `⚠️ <b>SDR WARN</b>\n` +
      `<b>Motivo:</b> ${reason}\n` +
      `<b>Recuperado:</b> ${recovered}\n` +
      `<code>${ts}</code>`
    );

    console.warn(`[SDR→OPS] ⚠️  WARN LLM: ${reason}`);
  }
  // OK: sem log extra
}

/** Reset de throttle (útil p/ testes). */
function _resetThrottle() { _lastAlertAt = 0; _lastWarnAt = 0; }

module.exports = { emit, _resetThrottle };
