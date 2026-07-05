// Testes da humanização de tráfego (rampa, janela, teto, anti-template). Rodar: npm test
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, upsertLead, incrementDispatchCount, dispatchDayOfLife, dispatchSentToday } from '../src/db.js';
import { makeFakeTransport, normalizeOutboundText } from '../src/evolution.js';
import { dispatchNewLeads, dailyCap, isWithinDispatchWindow, isTooSimilarToRecent, planToday } from '../src/dispatch.js';

before(() => { process.env.SDR_LLM = 'mock'; });

const silent = { info() {}, warn() {}, error() {} };
const lead = (n) => ({
  whatsapp: `553391${n}`, nome_empresa: `Clinica${n}`, nome_dono: 'Ana',
  especialidade: 'implantes', cidade: 'Ipatinga', qtd_avaliacoes: '50',
});

test('dailyCap segue o DISPATCH_RAMP e satura no último valor', () => {
  process.env.DISPATCH_RAMP = '5,8,12,18,25,35,50';
  assert.equal(dailyCap(1), 5);
  assert.equal(dailyCap(3), 12);
  assert.equal(dailyCap(7), 50);
  assert.equal(dailyCap(30), 50); // dia 30 satura no teto do dia 7+
  delete process.env.DISPATCH_RAMP;
});

test('isWithinDispatchWindow respeita janela comercial, fim de semana e quiet_hours do flow', () => {
  process.env.WINDOW_START = '09:00';
  process.env.WINDOW_END = '19:00';
  const flow = { globals: { humanization: { quiet_hours: ['12:00', '13:00'] } } };
  const seg10h = new Date('2026-07-06T10:00:00'); // segunda-feira
  const seg12h30 = new Date('2026-07-06T12:30:00'); // dentro do quiet hour
  const seg20h = new Date('2026-07-06T20:00:00'); // fora da janela
  const sab10h = new Date('2026-07-04T10:00:00'); // sábado
  assert.equal(isWithinDispatchWindow(seg10h, flow), true);
  assert.equal(isWithinDispatchWindow(seg12h30, flow), false, 'quiet hour do flow bloqueia');
  assert.equal(isWithinDispatchWindow(seg20h, flow), false, 'fora da janela comercial');
  assert.equal(isWithinDispatchWindow(sab10h, flow), false, 'fim de semana bloqueia');
  delete process.env.WINDOW_START;
  delete process.env.WINDOW_END;
});

test('teto diário: dispatch não envia além do cap do dia, mesmo com mais leads novos', async () => {
  process.env.DISPATCH_RAMP = '2'; // dia 1 = 2 aberturas
  process.env.WINDOW_START = '00:00';
  process.env.WINDOW_END = '23:59';
  const db = openDb(':memory:');
  for (let i = 0; i < 4; i++) upsertLead(db, lead(`900000${i}`));
  const transport = makeFakeTransport();
  const now = () => new Date('2026-07-06T10:00:00'); // segunda, dentro da janela
  const r = await dispatchNewLeads(db, transport, { log: silent, humanize: true, instanceId: 'test-cap', now, sleep: async () => {} });
  assert.equal(r.filter((x) => x.ok).length, 2, 'só 2 leads disparados (teto do dia 1)');
  assert.equal(dispatchSentToday(db, 'test-cap', '2026-07-06'), 2);
  delete process.env.DISPATCH_RAMP;
  delete process.env.WINDOW_START;
  delete process.env.WINDOW_END;
});

test('fora da janela comercial: dispatch não envia nada (leads continuam novos)', async () => {
  process.env.WINDOW_START = '09:00';
  process.env.WINDOW_END = '19:00';
  const db = openDb(':memory:');
  upsertLead(db, lead('9100001'));
  const transport = makeFakeTransport();
  const now = () => new Date('2026-07-06T22:00:00'); // fora da janela
  const r = await dispatchNewLeads(db, transport, { log: silent, humanize: true, instanceId: 'test-window', now });
  assert.deepEqual(r, []);
  assert.equal(transport.sent.length, 0);
  delete process.env.WINDOW_START;
  delete process.env.WINDOW_END;
});

test('ramp-up: dia de vida avança a cada dia novo registrado', () => {
  const db = openDb(':memory:');
  assert.equal(dispatchDayOfLife(db, 'ramp-x', '2026-07-01'), 1);
  incrementDispatchCount(db, 'ramp-x', '2026-07-01');
  assert.equal(dispatchDayOfLife(db, 'ramp-x', '2026-07-01'), 1);
  assert.equal(dispatchDayOfLife(db, 'ramp-x', '2026-07-03'), 3);
});

test('--plan (planToday) monta cronograma sem enviar nada', () => {
  process.env.DISPATCH_RAMP = '3';
  process.env.JITTER_MIN = '60000';
  process.env.JITTER_MAX = '120000';
  const db = openDb(':memory:');
  const now = new Date('2026-07-06T09:00:00');
  const plan = planToday(db, 'plan-test', now);
  assert.equal(plan.cap, 3);
  assert.equal(plan.schedule.length, 3);
  // horários crescentes e irregulares (não fixos)
  const gaps = plan.schedule.slice(1).map((t, i) => t - plan.schedule[i]);
  assert.ok(gaps.every((g) => g >= 60000 && g <= 120000), 'cada gap dentro do jitter configurado');
  assert.ok(new Set(gaps).size > 1 || gaps.length < 2, 'gaps não são todos idênticos (irregular)');
  delete process.env.DISPATCH_RAMP;
  delete process.env.JITTER_MIN;
  delete process.env.JITTER_MAX;
});

test('anti-template: abertura parecida com as últimas enviadas é sinalizada', () => {
  const recent = [
    'Oi! Aqui é o Rael, da Totum. Vi que vocês tem boa nota no Google.',
    'Olá! Sou o Rael da Totum, notei sua clínica com ótimas avaliações.',
  ];
  const parecida = 'Oi! Aqui é o Rael, da Totum. Vi que sua clínica tem boa nota no Google.';
  const diferente = 'E aí, tudo certo? Passando pra comentar sobre um problema que identifiquei na divulgação de vocês.';
  assert.equal(isTooSimilarToRecent(parecida, recent), true);
  assert.equal(isTooSimilarToRecent(diferente, recent), false);
});

test('Evolution recebe texto UTF-8 puro mesmo se a origem vier com mojibake Latin-1', async () => {
  const broken = 'ClÃ­nica OdontoSorriso Ã©️ referencia em implantes e ortodontia em Foz do IguaÃ§u\nVocÃªs tÃªm 187 avaliaÃ§Ãµes 🤔';
  const fixed = 'Clínica OdontoSorriso é️ referencia em implantes e ortodontia em Foz do Iguaçu\nVocês têm 187 avaliações 🤔';
  assert.equal(normalizeOutboundText(broken), fixed);

  const transport = makeFakeTransport();
  await transport.sendText('5533999999999', Buffer.from(broken, 'utf8'));
  assert.equal(transport.sent[0].text, fixed);
});
