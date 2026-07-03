// Testes dos critérios de aceite. Rodar: npm test  (usa cérebro mock; não toca rede)
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, upsertLead, getLeadByPhone, getHistory, addMessage, STATUS } from '../src/db.js';
import { createApp, extractInbound } from '../src/server.js';
import { makeFakeTransport } from '../src/evolution.js';
import { dispatchNewLeads } from '../src/dispatch.js';
import { hasPlaceholder, hasInventedName, isRepeated, missingRequired } from '../src/guardrails.js';
import { respondToLead } from '../src/pipeline.js';

before(() => { process.env.SDR_LLM = 'mock'; });

const LEAD = {
  whatsapp: '5533911111111', nome_empresa: 'OdontoTeste', nome_dono: 'Ana',
  especialidade: 'implantes', cidade: 'Ipatinga', qtd_avaliacoes: '50',
};
const silent = { info() {}, warn() {}, error() {} };

function makeServer(db, transport, debounceMs = 40) {
  const app = createApp({ db, transport, debounceMs, log: silent });
  return new Promise(res => { const s = app.listen(0, '127.0.0.1', () => res({ s, app, port: s.address().port })); });
}
const post = (port, body) => fetch(`http://127.0.0.1:${port}/webhook/evolution`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const evoMsg = (phone, text, { fromMe = false, id = `M${Math.random()}` } = {}) => ({
  event: 'messages.upsert',
  data: { key: { fromMe, remoteJid: `${phone}@s.whatsapp.net`, id }, message: { conversation: text } },
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

test('webhook IGNORA fromMe=true (anti-loop)', async () => {
  assert.equal(extractInbound(evoMsg('5533911111111', 'oi', { fromMe: true })), null);
  const db = openDb(':memory:');
  upsertLead(db, LEAD);
  db.prepare(`UPDATE leads SET status='em_conversa'`).run();
  const transport = makeFakeTransport();
  const { s, port } = await makeServer(db, transport);
  try {
    await post(port, evoMsg(LEAD.whatsapp, 'mensagem do proprio bot', { fromMe: true }));
    await sleep(150);
    const lead = getLeadByPhone(db, LEAD.whatsapp);
    assert.equal(getHistory(db, lead.id).length, 0, 'nada deve ser gravado');
    assert.equal(transport.sent.length, 0, 'nada deve ser enviado');
  } finally { s.close(); }
});

test('webhook deduplica pela key.id da mensagem', async () => {
  const db = openDb(':memory:');
  upsertLead(db, LEAD);
  db.prepare(`UPDATE leads SET status='em_conversa'`).run();
  const transport = makeFakeTransport();
  const { s, port } = await makeServer(db, transport);
  try {
    await post(port, evoMsg(LEAD.whatsapp, 'oi', { id: 'DUP-1' }));
    await post(port, evoMsg(LEAD.whatsapp, 'oi', { id: 'DUP-1' }));
    await sleep(250);
    const lead = getLeadByPhone(db, LEAD.whatsapp);
    assert.equal(getHistory(db, lead.id).filter(m => m.direction === 'in').length, 1);
  } finally { s.close(); }
});

test('debounce agrupa mensagens rápidas em UMA resposta', async () => {
  const db = openDb(':memory:');
  upsertLead(db, LEAD);
  db.prepare(`UPDATE leads SET status='em_conversa'`).run();
  const transport = makeFakeTransport();
  const { s, port } = await makeServer(db, transport, 120);
  try {
    await post(port, evoMsg(LEAD.whatsapp, 'oi'));
    await post(port, evoMsg(LEAD.whatsapp, 'tudo bem?'));
    await post(port, evoMsg(LEAD.whatsapp, 'quem fala?'));
    await sleep(600);
    assert.equal(transport.sent.length, 1, 'exatamente 1 resposta para 3 mensagens rápidas');
    const lead = getLeadByPhone(db, LEAD.whatsapp);
    assert.equal(getHistory(db, lead.id).filter(m => m.direction === 'in').length, 3);
  } finally { s.close(); }
});

test('estado PERSISTE: serviço reiniciado no meio da conversa continua', async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'sdr-')), 'sdr.db');
  // processo 1: dispara abertura e recebe 1 resposta do lead (sem responder ainda)
  {
    const db = openDb(dbPath);
    upsertLead(db, LEAD);
    await dispatchNewLeads(db, makeFakeTransport(), { log: silent });
    const lead = getLeadByPhone(db, LEAD.whatsapp);
    addMessage(db, lead.id, 'in', 'sou eu sim, pode falar'); // chegou e o serviço "caiu"
    db.close();
  }
  // processo 2 (restart): resumePending deve retomar e responder
  {
    const db = openDb(dbPath);
    const transport = makeFakeTransport();
    const app = createApp({ db, transport, debounceMs: 40, log: silent });
    app.resumePending();
    await sleep(400);
    const lead = getLeadByPhone(db, LEAD.whatsapp);
    const hist = getHistory(db, lead.id);
    assert.equal(hist.at(-1).direction, 'out', 'bot respondeu após restart');
    assert.equal(lead.status, 'em_conversa');
    assert.ok(transport.sent.length === 1);
    db.close();
  }
});

test('disparo ABORTA lead com variável obrigatória vazia (nunca placeholder)', async () => {
  const db = openDb(':memory:');
  upsertLead(db, { whatsapp: '5533922222222', nome_empresa: '', especialidade: 'orto', cidade: 'BH', qtd_avaliacoes: '10' });
  const transport = makeFakeTransport();
  const r = await dispatchNewLeads(db, transport, { log: silent });
  assert.equal(r[0].ok, false);
  assert.match(r[0].reason, /faltando:nome_empresa/);
  assert.equal(transport.sent.length, 0, 'nada enviado');
  assert.equal(getLeadByPhone(db, '5533922222222').status, STATUS.ABORTADO);
});

test('guardrails: placeholder, nome inventado e repetição', () => {
  assert.ok(hasPlaceholder('Olá {{nome_empresa}}, tudo bem?'));
  assert.ok(hasPlaceholder('Oi, aqui é da Clínica Exemplo'));
  assert.ok(hasPlaceholder('Confira [LINK]'));
  assert.ok(!hasPlaceholder('Oi! Vi as 214 avaliações de vocês.'));
  assert.ok(hasInventedName('O Dr. Roberto vai adorar', { nome_dono: '' }));
  assert.ok(!hasInventedName('O Dr. Marcos vai gostar', { nome_dono: 'Marcos' }));
  assert.ok(!hasInventedName('achei coisas que o doutor vai querer ver', { nome_dono: '' }), 'uso genérico de "doutor" não é nome inventado');
  assert.ok(isRepeated('Vocês têm site ou página própria hoje?', ['vocês têm site ou página própria hoje']));
  assert.ok(!isRepeated('ok', ['ok']));
  assert.deepEqual(missingRequired({ whatsapp: '55', nome_empresa: 'X', especialidade: 'y', cidade: 'z', qtd_avaliacoes: '1' }), []);
});

test('mensagem repetida do cérebro NUNCA é enviada (trava e vira humano)', async () => {
  const db = openDb(':memory:');
  const lead = upsertLead(db, LEAD);
  db.prepare(`UPDATE leads SET status='em_conversa'`).run();
  addMessage(db, lead.id, 'out', 'Primeira mensagem de abertura da conversa aqui');
  addMessage(db, lead.id, 'in', 'oi');
  const repetidor = { calls: 0 };
  // cérebro stub que sempre repete a mesma frase
  const { think } = await import('../src/brain.js');
  const fakeLead = { ...getLeadByPhone(db, LEAD.whatsapp) };
  // usa pipeline com um "think" repetidor via monkeypatch do mock: mais simples, testa validateOutbound + retry no pipeline real
  const transport = makeFakeTransport();
  // injeta repetição: já gravamos como 'out' a frase que o mock geraria (rung1 variante 0)
  const { mockThink } = await import('../src/mockBrain.js');
  const previewed = mockThink(fakeLead, getHistory(db, lead.id));
  db.prepare('DELETE FROM messages').run();
  addMessage(db, lead.id, 'out', previewed.mensagem);            // bot "já enviou" essa frase
  addMessage(db, lead.id, 'in', 'oi');                            // lead respondeu de novo
  const r = await respondToLead(db, transport, fakeLead, silent);
  // mock com retry gera variante 1 (frase diferente) -> deve enviar SEM repetir
  if (r.sent) {
    assert.notEqual(transport.sent[0].text, previewed.mensagem, 'não repetiu a frase');
  } else {
    assert.equal(getLeadByPhone(db, LEAD.whatsapp).status, STATUS.HUMANO, 'travou e passou pro humano');
  }
});

test('webhook não responde lead com status ganho/humano/encerrado', async () => {
  const db = openDb(':memory:');
  upsertLead(db, LEAD);
  db.prepare(`UPDATE leads SET status='ganho'`).run();
  const transport = makeFakeTransport();
  const { s, port } = await makeServer(db, transport);
  try {
    await post(port, evoMsg(LEAD.whatsapp, 'obrigado!'));
    await sleep(200);
    assert.equal(transport.sent.length, 0);
    const lead = getLeadByPhone(db, LEAD.whatsapp);
    assert.equal(getHistory(db, lead.id).filter(m => m.direction === 'in').length, 1, 'registra mas não responde');
  } finally { s.close(); }
});
