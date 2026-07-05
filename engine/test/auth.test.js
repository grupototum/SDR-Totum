// ENGINE_V3_KEY (Opção A): /api/* exige a chave quando setada; /health sempre aberto;
// sem a env = liberado (dev/local). O middleware lê a env por request.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';
import { makeFakeTransport } from '../src/evolution.js';

const silent = { info() {}, warn() {}, error() {} };
let server, port;
const get = (path, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, { headers });

before(() => new Promise((res) => {
  const app = createApp({ db: openDb(':memory:'), transport: makeFakeTransport(), log: silent });
  server = app.listen(0, '127.0.0.1', () => { port = server.address().port; res(); });
}));
after(() => { delete process.env.ENGINE_V3_KEY; server.close(); });

test('sem ENGINE_V3_KEY no env: /api/* liberado', async () => {
  delete process.env.ENGINE_V3_KEY;
  assert.equal((await get('/api/sim/status')).status, 200);
});

test('com ENGINE_V3_KEY: sem header 401; Bearer ou X-Engine-Key corretos passam; errada 401', async () => {
  process.env.ENGINE_V3_KEY = 'xyz';
  assert.equal((await get('/api/sim/status')).status, 401);
  assert.equal((await get('/api/sim/status', { Authorization: 'Bearer xyz' })).status, 200);
  assert.equal((await get('/api/sim/status', { 'X-Engine-Key': 'xyz' })).status, 200);
  assert.equal((await get('/api/sim/status', { Authorization: 'Bearer errada' })).status, 401);
  assert.equal((await get('/api/sim/status', { 'X-Engine-Key': 'errada' })).status, 401);
});

test('com ENGINE_V3_KEY: /health e /webhook/evolution ficam fora da exigência', async () => {
  process.env.ENGINE_V3_KEY = 'xyz';
  assert.equal((await get('/health')).status, 200);
  const r = await fetch(`http://127.0.0.1:${port}/webhook/evolution`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.notEqual(r.status, 401, 'webhook nunca exige a chave (protegido por não ser exposto no Traefik)');
});
