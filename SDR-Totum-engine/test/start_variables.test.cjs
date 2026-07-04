/* FIX 1 — /api/conversations/start aborta (400) quando falta variável obrigatória do flow.
 * Node puro (sem deps). Roda: node test/start_variables.test.cjs */
'use strict';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://fake:fake@127.0.0.1:9/fake';
delete process.env.SDR_API_KEY;
delete process.env.MAESTRO_API_KEY;

const assert = require('node:assert');
const http = require('node:http');

// src/model_alert.js existe só na VPS (não rastreado no git) — stub pra carregar o server
const Module = require('node:module');
const path = require('node:path');
const maPath = path.join(__dirname, '..', 'src', 'model_alert.js');
const maStub = new Module(maPath); maStub.exports = { classifyLlmLogs: () => ({ level: 'ok', reason: 'stub' }) }; maStub.loaded = true;
require.cache[maPath] = maStub;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === './model_alert') return maPath;
  return origResolve.call(this, request, ...rest);
};

// stub do flow no store (patch ANTES de carregar o server — o destructuring pega a versão stubada)
const store = require('../src/store.js');
store.getFlow = async (id) => ({
  id,
  definition: {
    entry_stage: 'abertura',
    stages: [{ id: 'abertura', reference_copy: ['Oi {{NOME_DONO}}, vi a {{NOME_EMPRESA}} em {{CIDADE}}'] }],
  },
});

const { handler } = require('../src/server.js');

async function post(port, body) {
  const res = await fetch(`http://127.0.0.1:${port}/api/conversations/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function main() {
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  // sem variáveis → 400 com a lista do que falta
  const r1 = await post(port, { flowId: 'sdr-odonto-stages-v2', phone: '5533999999999', variables: {} });
  assert.strictEqual(r1.status, 400, `esperava 400, veio ${r1.status}: ${JSON.stringify(r1.body)}`);
  assert.deepStrictEqual([...r1.body.missing].sort(), ['CIDADE', 'NOME_DONO', 'NOME_EMPRESA']);

  // variável vazia conta como faltante
  const r2 = await post(port, {
    flowId: 'sdr-odonto-stages-v2',
    phone: '5533999999999',
    variables: { NOME_DONO: 'Dra. Carla', NOME_EMPRESA: '  ', CIDADE: 'Ipatinga' },
  });
  assert.strictEqual(r2.status, 400, `esperava 400, veio ${r2.status}`);
  assert.deepStrictEqual(r2.body.missing, ['NOME_EMPRESA']);

  server.close();
  console.log('✓ start aborta com 400 quando falta variável obrigatória do flow');
}

main().then(() => process.exit(0)).catch((e) => { console.error('✗', e.message); process.exit(1); });
