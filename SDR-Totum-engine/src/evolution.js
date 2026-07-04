const config = {
  mode: process.env.BRIDGE_MODE || 'shadow',
  allowAutoSend: process.env.ALLOW_AUTOSEND === 'true',
  baseUrl: process.env.EVOLUTION_BASE_URL || '',
  apiKey: process.env.EVOLUTION_API_KEY || '',
  instance: process.env.EVOLUTION_INSTANCE || 'sdr-553131577292',
};

const senderState = require('./sender_state');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readingDelayMs(text) {
  const wordsPerMin = Number(process.env.READING_WORDS_PER_MIN || 200);
  const safeWordsPerMin = Number.isFinite(wordsPerMin) && wordsPerMin > 0 ? wordsPerMin : 200;
  const chars = String(text || '').length;
  return Math.max((chars / 5 / safeWordsPerMin) * 60000, 3000);
}

function canSend() {
  return config.mode === 'approved-send' && config.allowAutoSend;
}

async function evolutionPost(path, payload) {
  if (!config.baseUrl || !config.apiKey) {
    throw new Error('Evolution API env vars are required for real send');
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let body = responseText;
  try {
    body = responseText ? JSON.parse(responseText) : {};
  } catch {
    body = responseText;
  }

  if (!response.ok) {
    throw new Error(`Evolution HTTP ${response.status}: ${responseText}`);
  }

  return { status: response.status, body };
}

async function sendPresence({ number, presence }) {
  if (!number) throw new Error('target number is required');
  if (!presence) throw new Error('presence is required');
  if (!canSend()) {
    return {
      sent: false,
      mode: config.mode,
      blockedReason: 'shadow mode or ALLOW_AUTOSEND=false',
      payload: { number, presence },
    };
  }
  const result = await evolutionPost(`/chat/sendPresence/${config.instance}`, {
    number,
    presence,
    delay: Number(process.env.EVOLUTION_PRESENCE_DELAY_MS || 1200),
  });
  return {
    sent: true,
    provider: 'evolution',
    ...result,
  };
}

async function sendText({ number, text, msgId, dedupReserved = false }) {
  if (!number) throw new Error('target number is required');
  if (!text) throw new Error('message text is required');
  if (msgId && !dedupReserved) {
    const reserved = senderState.reserveOutbound(number, msgId, text);
    if (!reserved) {
      console.log(`[DEDUP] Skipping ${msgId} for ${number} — already sent`);
      return {
        sent: false,
        deduped: true,
        blockedReason: 'msgId already present in sdr-state history',
        payload: { number, text, msgId },
      };
    }
  }

  if (!canSend()) {
    return {
      sent: false,
      mode: config.mode,
      blockedReason: 'shadow mode or ALLOW_AUTOSEND=false',
      payload: { number, text },
    };
  }

  await sendPresence({ number, presence: 'composing' });
  await sleep(readingDelayMs(text));
  let result;
  try {
    result = await evolutionPost(`/message/sendText/${config.instance}`, {
      number,
      text,
      delay: Number(process.env.EVOLUTION_SEND_DELAY_MS || 1200),
    });
  } finally {
    try {
      await sendPresence({ number, presence: 'paused' });
    } catch (error) {
      console.warn('[evolution] failed to pause presence:', error.message);
    }
  }

  return {
    sent: true,
    provider: 'evolution',
    status: result.status,
    body: result.body,
  };
}

// Envia áudio (voice note) via Evolution API. `audio` = URL pública ou base64.
async function sendAudio({ number, audio, msgId, dedupReserved = false }) {
  if (!number) throw new Error('target number is required');
  if (!audio) throw new Error('audio (url or base64) is required');
  if (msgId && !dedupReserved) {
    const reserved = senderState.reserveOutbound(number, msgId, `[audio] ${audio}`);
    if (!reserved) {
      console.log(`[DEDUP] Skipping ${msgId} for ${number} — already sent`);
      return {
        sent: false,
        deduped: true,
        blockedReason: 'msgId already present in sdr-state history',
        payload: { number, audio, msgId },
      };
    }
  }

  if (!canSend()) {
    return {
      sent: false,
      mode: config.mode,
      blockedReason: 'shadow mode or ALLOW_AUTOSEND=false',
      payload: { number, audio },
    };
  }

  await sendPresence({ number, presence: 'recording' });
  let result;
  try {
    result = await evolutionPost(`/message/sendWhatsAppAudio/${config.instance}`, {
      number,
      audio,
      delay: Number(process.env.EVOLUTION_SEND_DELAY_MS || 1200),
    });
  } finally {
    try {
      await sendPresence({ number, presence: 'paused' });
    } catch (error) {
      console.warn('[evolution] failed to pause presence:', error.message);
    }
  }

  return {
    sent: true,
    provider: 'evolution',
    status: result.status,
    body: result.body,
  };
}

module.exports = {
  canSend,
  readingDelayMs,
  sendPresence,
  sendText,
  sendAudio,
};
