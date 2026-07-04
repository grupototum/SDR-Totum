/* FIX 3–6 (teste real 04/07):
 * 3) evolution.sendAudio existe e respeita shadow mode
 * 4) gatekeeper aceita áudio → send_audio autorizado, precisa_humano NUNCA, notificar sim
 * 5) falando_com persistido + regra "não chamar gatekeeper pelo nome do decisor" no prompt
 * 6) no-response → nudge neutro; "Entendi..." é rejeitado
 * Node puro (sem deps), LLM stubado. Roda: node test/brain_gatekeeper_audio.test.cjs */
'use strict';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://fake:fake@127.0.0.1:9/fake';

const assert = require('node:assert');

const llm = require('../src/llm_provider.js');
const queue = [];
llm.generate = async () => {
  if (!queue.length) throw new Error('fila de respostas do stub vazia');
  return queue.shift();
};

const { callBrain, buildV2Prompt, NO_RESPONSE_MARKER } = require('../src/brain.js');
const evolution = require('../src/evolution.js');

const def = {
  entry_stage: 'abertura',
  objective: 'agendar reunião',
  globals: {
    send_preview_stage: 'oferta_previa',
    gatekeeper: {
      copy: ['Posso te mandar um áudio rápido para encaminhar pro {{NOME_DONO}}?'],
    },
  },
  stages: [
    { id: 'abertura', next: 'qualificacao', goal: '', instruction: '', reference_copy: ['Aí é a {{NOME_EMPRESA}}?'] },
    { id: 'qualificacao', next: 'oferta_previa', goal: '', instruction: '' },
    { id: 'oferta_previa', next: null, goal: '', instruction: '' },
  ],
};
const flowOverride = { definition: def };

function llmJson(reply, extra = {}) {
  return JSON.stringify({
    reply: [reply], stage_proposto: 'qualificacao', temperatura: 'morno', score: 5,
    send_preview: false, booked: false, precisa_humano: false, done: false, objecao: null, intent: null, ...extra,
  });
}
function session(stage = 'qualificacao', vars = {}) {
  return { id: 'test', currentNodeId: stage, score: 5, variables: { NOME_DONO: 'Dra. Karla', NOME_EMPRESA: 'Sorriso Vale', ...vars } };
}

async function main() {
  // FIX 3: sendAudio em shadow mode não envia e explica o porquê
  const audio = await evolution.sendAudio({ number: '5533999999999', audio: 'https://cdn/x1.opus' });
  assert.strictEqual(audio.sent, false);
  assert.ok(/shadow/.test(audio.blockedReason), 'shadow mode deveria bloquear envio real');

  // FIX 4: gatekeeper aceita áudio; LLM (sensível demais) marca precisa_humano junto
  // → motor autoriza send_audio, DERRUBA precisa_humano e liga notificar_humano
  queue.push(llmJson('Vou te mandar o áudio aqui, pode encaminhar?', {
    send_audio: true, falando_com: 'gatekeeper', precisa_humano: true,
  }));
  let r = await callBrain({ session: session(), history: [], lastMessage: 'pode mandar o áudio', flowOverride });
  assert.strictEqual(r.send_audio, true, 'send_audio deveria ser autorizado pro gatekeeper');
  assert.strictEqual(r.precisa_humano, false, 'aceite de áudio NUNCA é handoff (fix 4)');
  assert.strictEqual(r.notificar_humano, true, 'handoff sensível vira notificação (segue fluxo)');

  // FIX 4b: send_audio de quem NÃO é gatekeeper não é autorizado
  queue.push(llmJson('Te mando um áudio!', { send_audio: true, falando_com: 'decisor' }));
  r = await callBrain({ session: session(), history: [], lastMessage: 'manda áudio', flowOverride });
  assert.strictEqual(r.send_audio, false, 'send_audio só no caminho gatekeeper');

  // FIX 5: falando_com persiste na sessão e o prompt seguinte carrega a regra do nome
  const s = session();
  queue.push(llmJson('Consigo falar com a Dra. Karla?', { falando_com: 'gatekeeper' }));
  r = await callBrain({ session: s, history: [], lastMessage: 'ela tá em atendimento', flowOverride });
  assert.strictEqual(s.variables.__falando_com, 'gatekeeper', 'falando_com deveria persistir');
  const prompt = buildV2Prompt({ def, stageId: 'qualificacao', session: s, history: [], lastMessage: 'oi', falandoCom: 'gatekeeper' });
  assert.ok(/INTERLOCUTOR ATUAL: gatekeeper/.test(prompt));
  assert.ok(/NUNCA a chame pelo nome do decisor/.test(prompt), 'prompt sem a regra do nome do decisor');
  assert.ok(/COPY DO CAMINHO GATEKEEPER/.test(prompt), 'prompt sem a copy do gatekeeper do flow');

  // FIX 6: prompt de no-response pede nudge neutro; "Entendi..." é rejeitado e re-gerado
  const npPrompt = buildV2Prompt({ def, stageId: 'qualificacao', session: session(), history: [], lastMessage: NO_RESPONSE_MARKER });
  assert.ok(/NUDGE curto e neutro/.test(npPrompt), 'prompt de no-response sem instrução de nudge');
  assert.ok(/PROIBIDO começar com "Entendi"/.test(npPrompt));

  queue.push(llmJson('Entendi, Dra. Karla! Então seguimos assim.'));
  queue.push(llmJson('Oi! Conseguiu ver minha última mensagem?'));
  r = await callBrain({ session: session(), history: [{ direction: 'out', text: 'Você cuida do marketing da clínica?' }], lastMessage: NO_RESPONSE_MARKER, flowOverride });
  assert.ok(!/^entendi/i.test(r.reply[0] || ''), `nudge não pode fingir resposta, veio: ${r.reply[0]}`);
  assert.ok(/conseguiu ver/i.test(r.reply[0]), 'deveria usar a re-geração neutra');

  assert.strictEqual(queue.length, 0, 'stub: sobrou resposta na fila');
  console.log('✓ gatekeeper/áudio/notificar/no-response: fixes 3–6');
}

main().then(() => process.exit(0)).catch((e) => { console.error('✗', e.message); process.exit(1); });
