// Envio via Evolution API. Transporte injetável (o simulador usa FakeTransport).
export function normalizeOutboundText(value) {
  const input = typeof value === 'string'
    ? value
    : Buffer.isBuffer(value)
      ? value.toString('utf8')
      : String(value ?? '');

  // Repara mojibake clássico: UTF-8 lido como Latin-1/Windows-1252 antes de chegar aqui.
  // A correção fica na borda de envio para proteger dispatch, pipeline e blocos de áudio.
  return input.replace(/[\x20-\x7e\u00a0-\u00ff]*[ÃÂ][\x20-\x7e\u00a0-\u00ff]*/g, (segment) => {
    const decoded = Buffer.from(segment, 'latin1').toString('utf8');
    const badBefore = (segment.match(/[ÃÂ]/g) || []).length;
    const badAfter = (decoded.match(/[ÃÂ�]/g) || []).length;
    return badAfter < badBefore ? decoded : segment;
  });
}

export function makeEvolutionTransport(env = process.env) {
  const url = env.EVOLUTION_URL, key = env.EVOLUTION_KEY, instance = env.EVOLUTION_INSTANCE;
  if (!url || !key || !instance) throw new Error('EVOLUTION_URL / EVOLUTION_KEY / EVOLUTION_INSTANCE não setadas');
  return {
    name: 'evolution',
    async sendText(number, text) {
      const cleanText = normalizeOutboundText(text);
      // delay = indicador de "digitando..." proporcional ao tamanho (parecer humano; teto configurável)
      const cap = Number(process.env.TYPING_CAP_MS || 4000);
      const delay = Math.min(cap, Math.max(800, Math.round(cleanText.split(/\s+/).length / 55 * 60000)));
      const res = await fetch(`${url.replace(/\/$/, '')}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ number, text: cleanText, delay }),
      });
      if (!res.ok) throw new Error(`Evolution HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
    // Voice note (BLOCO ÁUDIO). `audio` = URL pública ou base64.
    async sendAudio(number, audio) {
      const res = await fetch(`${url.replace(/\/$/, '')}/message/sendWhatsAppAudio/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ number, audio }),
      });
      if (!res.ok) throw new Error(`Evolution HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return res.json();
    },
  };
}

// Transporte fake para simulador/testes: captura em memória, não toca rede.
export function makeFakeTransport() {
  const sent = [];
  return {
    name: 'fake',
    sent,
    async sendText(number, text) { sent.push({ number, text: normalizeOutboundText(text) }); return { ok: true }; },
    async sendAudio(number, audio) { sent.push({ number, audio, type: 'audio' }); return { ok: true }; },
  };
}
