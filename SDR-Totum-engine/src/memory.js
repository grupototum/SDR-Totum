'use strict';

const { createClient } = require('@supabase/supabase-js');
const https = require('node:https');

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'nvidia/nv-embedqa-e5-v5';
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 1024);
const TOP_K = 3;

let _supabase = null;
function supabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('[memory] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

async function embed(text, inputType = 'passage') {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('[memory] NVIDIA_API_KEY not set');

  const body = JSON.stringify({ model: EMBEDDING_MODEL, input: String(text || ''), input_type: inputType });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'integrate.api.nvidia.com',
        path: '/v1/embeddings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const vec = parsed?.data?.[0]?.embedding;
            if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
              return reject(new Error(`[memory] unexpected embedding shape: ${JSON.stringify(parsed).slice(0, 200)}`));
            }
            resolve(vec);
          } catch (e) { reject(e); }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('[memory] embed timeout')); });
    req.write(body);
    req.end();
  });
}

// ingestMemory: generates embedding for `text` and saves to sdr_memories.
// Non-blocking: errors are logged but never thrown to the caller.
async function ingestMemory(phone, text, stage) {
  if (!phone || !text) return;
  try {
    const embedding = await embed(text, 'passage');
    const { error } = await supabase()
      .from('sdr_memories')
      .insert({ id_lead: String(phone), embedding, texto_original: String(text), etapa_funil: stage || null });
    if (error) console.error('[memory] ingest error:', error.message);
  } catch (e) {
    console.error('[memory] ingest failed:', e.message);
  }
}

// retrieveMemory: semantic search — returns up to TOP_K memory strings for this lead.
async function retrieveMemory(phone, query) {
  if (!phone || !query) return [];
  try {
    const embedding = await embed(query, 'query');
    const { data, error } = await supabase().rpc('match_sdr_memories', {
      query_embedding: embedding,
      lead_id: String(phone),
      match_count: TOP_K,
    });
    if (error) {
      console.error('[memory] retrieve error:', error.message);
      return [];
    }
    return (data || []).map((row) => row.texto_original).filter(Boolean);
  } catch (e) {
    console.error('[memory] retrieve failed:', e.message);
    return [];
  }
}

// buildPrompt: assembles the enriched prompt for the brain LLM call.
async function buildPrompt(phone, currentMsg, shortTermHistory) {
  const longTerm = await retrieveMemory(phone, currentMsg);

  const longTermSection = longTerm.length
    ? longTerm.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(nenhuma memória relevante encontrada ainda)';

  const historyLines = Array.isArray(shortTermHistory) ? shortTermHistory.slice(-10) : [];
  const histText = historyLines.map((m) => `[${m.direction === 'in' ? 'LEAD' : 'BOT'}] ${m.text}`).join('\n') || '(sem histórico)';

  return `[Memória de Longo Prazo]
Fatos relevantes que você já sabe sobre este lead:
${longTermSection}

[Memória de Curto Prazo]
Últimas mensagens da conversa:
${histText}

[Interação Atual]
Lead: ${currentMsg}
SDR:`;
}

module.exports = { ingestMemory, retrieveMemory, buildPrompt };
