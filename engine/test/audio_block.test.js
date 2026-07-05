// BLOCO ÁUDIO: send_audio só no caminho gatekeeper; áudios na ordem + resumo sem {{}}.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeActions } from '../src/flow.js';
import { parseBrainOutput } from '../src/brain.js';
import { sendAudioBlock } from '../src/pipeline.js';
import { makeFakeTransport } from '../src/evolution.js';

const silent = { info() {}, warn() {}, error() {} };
const LEAD = { whatsapp: '5533911111111', nome_empresa: 'OdontoTeste', nome_dono: 'Ana' };

test('authorizeActions: send_audio só quando falando_com=gatekeeper', () => {
  assert.equal(authorizeActions('qualificacao', 'qualificacao', { send_audio: true, falando_com: 'gatekeeper' }).send_audio, true);
  assert.equal(authorizeActions('qualificacao', 'qualificacao', { send_audio: true, falando_com: 'decisor' }).send_audio, false);
  assert.equal(authorizeActions('qualificacao', 'qualificacao', { send_audio: true }).send_audio, false);
});

test('parseBrainOutput: passa send_audio/falando_com com defaults seguros', () => {
  const j = parseBrainOutput('{"mensagem":"oi","stage":"a","send_audio":true,"falando_com":"gatekeeper"}', { stage: 'a' }, ['a']);
  assert.equal(j.send_audio, true);
  assert.equal(j.falando_com, 'gatekeeper');
  const d = parseBrainOutput('{"mensagem":"oi","stage":"a"}', { stage: 'a' }, ['a']);
  assert.equal(d.send_audio, false);
  assert.equal(d.falando_com, null);
});

test('sendAudioBlock: áudios na ordem, resumo renderizado, linha com {{}} não vai', async () => {
  const def = { stages: [{ id: 'a' }], globals: { audio_block: {
    files: ['https://cdn/a1.opus', 'https://cdn/a2.opus'],
    summary: ['Resumo pra {{NOME_EMPRESA}}\nlinha com {{VAR_VAZIA}}\nfim'],
  } } };
  const t = makeFakeTransport();
  const reg = await sendAudioBlock(def, LEAD, t, silent);
  assert.deepEqual(t.sent.map(s => s.type || 'text'), ['audio', 'audio', 'text']);
  assert.equal(t.sent[0].audio, 'https://cdn/a1.opus');
  assert.ok(t.sent[2].text.includes('OdontoTeste'));
  assert.ok(!t.sent[2].text.includes('{{'), 'linha com placeholder não pode ir pro lead');
  assert.equal(reg.length, 3, 'labels dos áudios + resumo registráveis no histórico');
});

test('sendAudioBlock: sem files e sem env → só o resumo (não explode)', async () => {
  delete process.env.AUDIO_BLOCK_URLS;
  const def = { stages: [{ id: 'a' }], globals: { audio_block: { files: [], summary: ['Resumo simples'] } } };
  const t = makeFakeTransport();
  await sendAudioBlock(def, LEAD, t, silent);
  assert.deepEqual(t.sent.map(s => s.type || 'text'), ['text']);
});
