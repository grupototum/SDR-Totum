/* Trava anti-regressão do bug 4 (loop fromMe). Node puro (sem deps).
 * Roda: node test/webhook_fromme.test.cjs
 * Garante: webhook com key.fromMe=true → {ignored:true, reason:'fromMe'} SEM chamar o cérebro. */
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

// trava: se o cérebro for chamado, o teste falha (patch ANTES de carregar o server)
const brain = require('../src/brain.js');
brain.callBrain = async () => { throw new Error('callBrain NÃO deveria ser chamado para fromMe'); };

const { handler } = require('../src/server.js');

async function main() {
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  const res = await fetch(`http://127.0.0.1:${port}/webhooks/evolution/sdr`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'messages.upsert',
      instance: 'sdr-test',
      data: {
        key: { fromMe: true, remoteJid: '5533991294114@s.whatsapp.net', id: 'ABC123' },
        message: { conversation: 'mensagem enviada pelo próprio bot' },
      },
    }),
  });
  const body = await res.json();

  assert.strictEqual(res.status, 200, `esperava 200, veio ${res.status}`);
  assert.strictEqual(body.ignored, true, 'esperava ignored:true');
  assert.strictEqual(body.reason, 'fromMe', `esperava reason:'fromMe', veio ${body.reason}`);

  server.close();
  console.log('✓ webhook fromMe ignorado sem chamar o cérebro');
}

main().then(() => process.exit(0)).catch((e) => { console.error('✗', e.message); process.exit(1); });
