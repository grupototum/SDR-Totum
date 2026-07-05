// /api/sim/turn (turno avulso stateless do InlineTestChat) e /api/sim/report (bateria mock).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/server.js';
import { makeFakeTransport } from '../src/evolution.js';

const silent = { info() {}, warn() {}, error() {} };
let server, port;

const post = (path, body) => fetch(`http://127.0.0.1:${port}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

before(() => {
  process.env.SDR_LLM = 'mock';
  const app = createApp({ db: openDb(':memory:'), transport: makeFakeTransport(), log: silent });
  return new Promise((res) => {
    server = app.listen(0, '127.0.0.1', () => { port = server.address().port; res(); });
  });
});
after(() => server.close());

test('sim/turn: 400 quando history não termina com mensagem do lead', async () => {
  const res = await post('/api/sim/turn', { history: [{ role: 'sdr', text: 'oi' }] });
  assert.equal(res.status, 400);
});

test('sim/turn: turno stateless devolve reply + stages no contrato SimTurnResponse', async () => {
  const res = await post('/api/sim/turn', {
    variables: { NOME_EMPRESA: 'OdontoTeste', NOME_DONO: 'Ana', CIDADE: 'Ipatinga', QTD_AVALIACOES: '50', ESPECIALIDADE: 'implantes' },
    history: [
      { role: 'sdr', text: 'Oi! Aqui é o Rael, da Totum. Vi a OdontoTeste nas avaliações. Falo com a Ana?' },
      { role: 'lead', text: 'oi, sou eu sim, pode falar' },
    ],
    currentStage: 'abertura',
    sessionState: {},
  });
  assert.equal(res.status, 200);
  const t = await res.json();
  assert.ok(t.reply.length > 0, 'reply não pode ser vazio');
  assert.equal(t.stage_from, 'abertura');
  assert.ok(typeof t.stage_to === 'string' && t.stage_to.length > 0);
  assert.ok(['frio', 'morno', 'quente'].includes(t.temperatura));
  assert.ok(t.score >= 1 && t.score <= 10);
  assert.equal(typeof t.flags.booked, 'boolean');
  assert.equal(t.guardrail_violation, false);
  assert.equal(t.raw.mock, true);
  assert.equal(t.raw.motor, 'v3');
  assert.ok(t.sessionState.status, 'sessionState carrega o status pro próximo turno');
});

test('sim/report: bateria mock agrega healthRate no contrato SimReport', async () => {
  const res = await fetch(`http://127.0.0.1:${port}/api/sim/report`);
  assert.equal(res.status, 200);
  const r = await res.json();
  assert.equal(r.total, 3, 'roda as 3 personas');
  assert.ok(r.healthy >= 0 && r.healthy <= r.total);
  assert.ok(r.healthRate >= 0 && r.healthRate <= 1);
  assert.equal(r.mock, true, 'report do V3 é mock — não vale como GO');
  assert.ok(r.generatedAt);

  // 2ª chamada bate no cache TTL (mesmo generatedAt)
  const again = await (await fetch(`http://127.0.0.1:${port}/api/sim/report`)).json();
  assert.equal(again.generatedAt, r.generatedAt);
});
