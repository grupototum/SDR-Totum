/* nvidia_ratelimit_probe.cjs — mede o rate limit REAL da NVIDIA (não confiar em "ilimitado").
 * Dispara um burst pequeno e reporta: ok/429/erros, latência, e QUALQUER header de quota
 * (x-ratelimit-*, retry-after). NÃO toca produção. Usa chave de SIM por padrão.
 * Uso: node nvidia_ratelimit_probe.cjs [burst=15] [intervalo_ms=0]
 */
const KEY = process.env.NVIDIA_API_KEY_SIM || process.env.NVIDIA_API_KEY || '';
const BASE = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
const MODEL = process.env.NVIDIA_MODEL_SIM || process.env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
const BURST = Math.max(1, Number(process.argv[2] || 15));
const GAP = Number(process.argv[3] || 0);

if (!KEY) { console.error('BLOQUEADO: defina NVIDIA_API_KEY_SIM (ou NVIDIA_API_KEY) antes de medir.'); process.exit(3); }

const RL_HEADERS = ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset',
  'x-ratelimit-limit-requests', 'x-ratelimit-remaining-requests', 'x-ratelimit-limit-tokens', 'x-ratelimit-remaining-tokens'];

async function one(i) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: 'responda só: ok' }], max_tokens: 5, temperature: 0 }),
    });
    const ms = Date.now() - t0;
    const seen = {};
    for (const h of RL_HEADERS) { const v = res.headers.get(h); if (v != null) seen[h] = v; }
    return { i, status: res.status, ms, seen };
  } catch (e) { return { i, status: 'ERR', ms: Date.now() - t0, err: String(e.message).slice(0, 120) }; }
}

(async () => {
  console.log(`probe NVIDIA · base=${BASE} · model=${MODEL} · burst=${BURST} · gap=${GAP}ms\n`);
  const results = [];
  if (GAP > 0) { for (let i = 0; i < BURST; i++) { results.push(await one(i)); await new Promise((r) => setTimeout(r, GAP)); } }
  else { results.push(...await Promise.all(Array.from({ length: BURST }, (_, i) => one(i)))); } // burst paralelo = estressa RPM
  const ok = results.filter((r) => r.status === 200).length;
  const r429 = results.filter((r) => r.status === 429).length;
  const other = results.filter((r) => r.status !== 200 && r.status !== 429);
  const lat = results.filter((r) => typeof r.ms === 'number').map((r) => r.ms).sort((a, b) => a - b);
  const headersSeen = Object.assign({}, ...results.map((r) => r.seen || {}));
  console.log(`200 OK: ${ok}/${BURST}   429: ${r429}   outros: ${other.length}`);
  if (lat.length) console.log(`latência ms: min ${lat[0]} · mediana ${lat[Math.floor(lat.length / 2)]} · max ${lat[lat.length - 1]}`);
  console.log('headers de quota vistos:', Object.keys(headersSeen).length ? JSON.stringify(headersSeen, null, 2) : '(nenhum — provider não expõe; medir empiricamente)');
  if (other.length) console.log('outros status/erros:', other.map((r) => `${r.status}${r.err ? ' ' + r.err : ''}`).slice(0, 5));
  console.log(`\nVEREDITO RPM (burst): ${r429 === 0 ? 'sem 429 no burst de ' + BURST + ' — limite >= ' + BURST + '/instante' : 'estourou em ' + ok + ' req simultâneas → RPM real ~' + ok}`);
  console.log('Para /dia: rodar este probe periodicamente e somar, OU consultar o painel NVIDIA. NÃO assumir ilimitado.');
})();
