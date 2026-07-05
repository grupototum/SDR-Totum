// Envio via Evolution API. Transporte injetável (o simulador usa FakeTransport).
export function makeEvolutionTransport(env = process.env) {
  const url = env.EVOLUTION_URL, key = env.EVOLUTION_KEY, instance = env.EVOLUTION_INSTANCE;
  if (!url || !key || !instance) throw new Error('EVOLUTION_URL / EVOLUTION_KEY / EVOLUTION_INSTANCE não setadas');
  return {
    name: 'evolution',
    async sendText(number, text) {
      // delay = indicador de "digitando..." proporcional ao tamanho (parecer humano; teto configurável)
      const cap = Number(process.env.TYPING_CAP_MS || 4000);
      const delay = Math.min(cap, Math.max(800, Math.round(text.split(/\s+/).length / 55 * 60000)));
      const res = await fetch(`${url.replace(/\/$/, '')}/message/sendText/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ number, text, delay }),
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
    async sendText(number, text) { sent.push({ number, text }); return { ok: true }; },
    async sendAudio(number, audio) { sent.push({ number, audio, type: 'audio' }); return { ok: true }; },
  };
}
