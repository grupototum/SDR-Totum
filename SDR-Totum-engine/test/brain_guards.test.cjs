/* FIX 1 (guarda de saída) + FIX 2 (anti-repetição rígida) no brain.js.
 * Node puro (sem deps), LLM stubado. Roda: node test/brain_guards.test.cjs */
'use strict';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://fake:fake@127.0.0.1:9/fake';

const assert = require('node:assert');

// stub do LLM: fila de respostas (patch ANTES de carregar o brain)
const llm = require('../src/llm_provider.js');
const queue = [];
llm.generate = async () => {
  if (!queue.length) throw new Error('fila de respostas do stub vazia');
  return queue.shift();
};

const { callBrain, unsafeReplyReason } = require('../src/brain.js');

const def = {
  entry_stage: 'abertura',
  objective: 'teste',
  stages: [
    { id: 'abertura', next: 'diagnostico', goal: '', instruction: '', advance_when: 'sempre' },
    { id: 'diagnostico', next: null, goal: '', instruction: '' },
  ],
};
const flowOverride = { definition: def };

function llmJson(reply, extra = {}) {
  return JSON.stringify({
    reply: [reply], stage_proposto: 'abertura', temperatura: 'morno', score: 5,
    send_preview: false, booked: false, precisa_humano: false, done: false, objecao: null, intent: null, ...extra,
  });
}
function freshSession() {
  return { id: 'test', currentNodeId: 'abertura', score: 5, variables: { NOME_DONO: 'Dra. Carla', NOME_EMPRESA: 'Sorriso Vale' } };
}

async function main() {
  // 1) placeholder não resolvido → bloqueia, precisa_humano
  queue.push(llmJson('Oi {{NOME_DONO}}, tudo bem?'));
  let r = await callBrain({ session: freshSession(), history: [], lastMessage: 'oi', flowOverride });
  assert.deepStrictEqual(r.reply, [], 'placeholder deveria zerar reply');
  assert.strictEqual(r.precisa_humano, true, 'placeholder deveria escalar pra humano');

  // 2) literal de demo → bloqueia
  queue.push(llmJson('Aqui é da Clínica Exemplo, posso te mostrar uma análise?'));
  r = await callBrain({ session: freshSession(), history: [], lastMessage: 'oi', flowOverride });
  assert.deepStrictEqual(r.reply, [], 'literal de demo deveria zerar reply');
  assert.strictEqual(r.precisa_humano, true);

  // 3) no sim (session.id === 'sim') literal de demo é intencional → passa
  queue.push(llmJson('Aqui é da Clínica OdontoSorriso, posso te mostrar?'));
  r = await callBrain({ session: { ...freshSession(), id: 'sim' }, history: [], lastMessage: 'oi', flowOverride });
  assert.strictEqual(r.reply.length, 1, 'sim com variáveis demo deveria passar');
  assert.strictEqual(r.precisa_humano, false);

  // 4) reply normal passa
  queue.push(llmJson('Oi Dra. Carla, vi a Sorriso Vale no Google e tenho uma análise pra te mostrar'));
  r = await callBrain({ session: freshSession(), history: [], lastMessage: 'oi', flowOverride });
  assert.strictEqual(r.reply.length, 1);
  assert.strictEqual(r.precisa_humano, false);

  // 5) anti-repetição: 1ª geração repete → re-gera e usa a reformulada
  const repetida = 'Consegui uma análise completa da sua clínica aqui e queria muito te mostrar hoje';
  const history = [
    { direction: 'out', text: repetida },
    { direction: 'in', text: 'hm' },
  ];
  queue.push(llmJson(repetida)); // repete
  queue.push(llmJson('Entendo! Então deixa eu te mostrar por outro ângulo: sua concorrente aparece na sua frente no Google'));
  r = await callBrain({ session: freshSession(), history, lastMessage: 'hm', flowOverride });
  assert.strictEqual(r.reply.length, 1, 'deveria ter usado a re-geração');
  assert.ok(!/an[aá]lise completa/i.test(r.reply[0]), 'não deveria repetir a frase antiga');

  // 6) anti-repetição: re-geração TAMBÉM repete → suprime (nunca manda a mesma frase 2x)
  queue.push(llmJson(repetida));
  queue.push(llmJson(repetida.toUpperCase() + '!!!')); // mesma frase normalizada
  r = await callBrain({ session: freshSession(), history, lastMessage: 'hm', flowOverride });
  assert.deepStrictEqual(r.reply, [], 'repetição dupla deveria suprimir a reply');
  assert.strictEqual(r.precisa_humano, false, 'supressão não escala pra humano');
  assert.ok(r.stage, 'decisão de estágio preservada');

  // 7) primeiras ~8 palavras iguais também conta como repetição
  queue.push(llmJson('Consegui uma análise completa da sua clínica aqui mas agora com um final diferente'));
  queue.push(llmJson('Vamos por outro caminho: te mando a prévia da página agora?'));
  r = await callBrain({ session: freshSession(), history, lastMessage: 'hm', flowOverride });
  assert.ok(/outro caminho/.test(r.reply[0]), 'head de 8 palavras igual deveria disparar re-geração');

  // 8) unsafeReplyReason exportado (sanidade)
  assert.ok(unsafeReplyReason('{{X}}'));
  assert.strictEqual(unsafeReplyReason('texto limpo'), null);

  assert.strictEqual(queue.length, 0, 'stub: sobrou resposta na fila');
  console.log('✓ guarda de saída + anti-repetição rígida');
}

main().then(() => process.exit(0)).catch((e) => { console.error('✗', e.message); process.exit(1); });
