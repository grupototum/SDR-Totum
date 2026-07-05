// Rotas /api/flows: o "banco" é o arquivo FLOW_PATH; POST/PUT gravam e derrubam o cache.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';
import { makeFakeTransport } from '../src/evolution.js';
import { getFlow, resetFlowCache } from '../src/flow.js';

const FLOW = {
  id: 'flow-teste', nome: 'Flow Teste', nicho: 'odonto',
  entry_stage: 'abertura',
  stages: [{ id: 'abertura', copy: ['oi'] }, { id: 'fim', terminal: true }],
};
const silent = { info() {}, warn() {}, error() {} };
let server, port;

const url = (p) => `http://127.0.0.1:${port}${p}`;
const send = (method, path, body) => fetch(url(path), {
  method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
});

before(() => {
  const dir = mkdtempSync(join(tmpdir(), 'flows-api-'));
  process.env.FLOW_PATH = join(dir, 'flow.json');
  writeFileSync(process.env.FLOW_PATH, JSON.stringify(FLOW));
  resetFlowCache();
  const app = createApp({ db: openDb(':memory:'), transport: makeFakeTransport(), log: silent });
  return new Promise((res) => {
    server = app.listen(0, '127.0.0.1', () => { port = server.address().port; res(); });
  });
});
after(() => server.close());

test('GET /api/flows retorna lista de 1 no shape do frontend', async () => {
  const res = await send('GET', '/api/flows');
  assert.equal(res.status, 200);
  const flows = await res.json();
  assert.equal(flows.length, 1);
  assert.equal(flows[0].id, 'flow-teste');
  assert.equal(flows[0].name, 'Flow Teste');
  assert.equal(flows[0].niche, 'odonto');
  assert.equal(flows[0].active, true);
  assert.ok(Array.isArray(flows[0].definition.stages));
});

test('GET /api/flows/:id retorna a definition pura (stages no topo)', async () => {
  const res = await send('GET', '/api/flows/flow-teste');
  assert.equal(res.status, 200);
  const def = await res.json();
  assert.equal(def.entry_stage, 'abertura');
  assert.ok(Array.isArray(def.stages));
  assert.equal((await send('GET', '/api/flows/nao-existe')).status, 404);
});

test('POST /api/flows valida stages[] e entry_stage', async () => {
  assert.equal((await send('POST', '/api/flows', { id: 'x' })).status, 400);
  assert.equal((await send('POST', '/api/flows', { stages: [], entry_stage: 'a' })).status, 400);
});

test('POST /api/flows grava no FLOW_PATH e o motor passa a usar (resetFlowCache)', async () => {
  assert.equal(getFlow().id, 'flow-teste'); // prime do cache
  const novo = { ...FLOW, id: 'flow-v2', nome: 'Flow V2' };
  const res = await send('POST', '/api/flows', novo);
  assert.equal(res.status, 201);
  assert.equal((await res.json()).id, 'flow-v2');
  assert.equal(JSON.parse(readFileSync(process.env.FLOW_PATH, 'utf8')).id, 'flow-v2');
  assert.equal(getFlow().id, 'flow-v2', 'cache deve ser derrubado no POST');
});

test('PUT /api/flows/:id publica (no-op) e atualiza quando tem definition', async () => {
  const pub = await send('PUT', '/api/flows/flow-v2', { active: true });
  assert.equal(pub.status, 200);
  assert.equal((await pub.json()).active, true);

  const upd = await send('PUT', '/api/flows/flow-v2', { definition: { ...FLOW, id: 'flow-v3' } });
  assert.equal(upd.status, 200);
  assert.equal(getFlow().id, 'flow-v3');

  assert.equal((await send('PUT', '/api/flows/flow-v3', { definition: { id: 'quebrado' } })).status, 400);
});
