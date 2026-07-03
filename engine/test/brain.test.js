// Testa a cadeia de fallback do cérebro (gemini -> groq -> nvidia) sem rede real.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { think } from '../src/brain.js';

const flow = {
  entry_stage: 'abertura',
  globals: {},
  stages: [{ id: 'abertura', goal: 'abrir', instruction: 'oi', reference_copy: [], next: null, terminal: true }],
};
const lead = { whatsapp: '5533999999999', nome_empresa: 'Clinica X', especialidade: 'implantes', cidade: 'Ipatinga' };

let realFetch;
before(() => {
  realFetch = globalThis.fetch;
  process.env.SDR_LLM = 'gemini,groq';
  process.env.GEMINI_API_KEY = 'fake-gemini-key';
  process.env.GROQ_API_KEY = 'fake-groq-key';
});
after(() => {
  globalThis.fetch = realFetch;
  delete process.env.SDR_LLM;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
});

test('cadeia LLM cai gemini -> groq quando gemini responde 429', async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('generativelanguage.googleapis.com')) {
      return { ok: false, status: 429, text: async () => 'rate limited' };
    }
    if (String(url).includes('groq.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ mensagem: 'oi do groq', stage: 'abertura', temperatura: 'morno', objetivo_atingido: false, precisa_humano: false }) } }],
        }),
      };
    }
    throw new Error(`URL inesperada: ${url}`);
  };

  const out = await think(lead, [], { flow });
  assert.equal(out.mensagem, 'oi do groq');
  // callLlm tenta 2x por provider antes de desistir (retry de rede já existente) — 2x gemini + 1x groq.
  assert.equal(calls.length, 3, 'tentou gemini 2x (retry interno), depois groq');
  assert.match(calls[0], /generativelanguage/);
  assert.match(calls[1], /generativelanguage/);
  assert.match(calls[2], /groq/);
});

test('URL do gemini nunca carrega a API key (vai no header x-goog-api-key)', async () => {
  let capturedUrl, capturedHeaders;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedHeaders = init.headers;
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ mensagem: 'oi', stage: 'abertura', temperatura: 'morno', objetivo_atingido: false, precisa_humano: false }) }] } }] }),
    };
  };
  process.env.SDR_LLM = 'gemini';
  await think(lead, [], { flow });
  process.env.SDR_LLM = 'gemini,groq';
  assert.ok(!capturedUrl.includes('fake-gemini-key'), 'a key não deve aparecer na URL');
  assert.equal(capturedHeaders['x-goog-api-key'], 'fake-gemini-key');
});
