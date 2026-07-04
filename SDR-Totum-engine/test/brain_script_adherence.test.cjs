/* FIX 1+2 (teste real 04/07): script como espinha dorsal do brain v2.
 * - regra de ouro + AÇÃO PADRÃO (próxima MSG do script) no prompt
 * - guarda anti-pitch precoce com fallback determinístico pro script
 * Node puro (sem deps), LLM stubado. Roda: node test/brain_script_adherence.test.cjs */
'use strict';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://fake:fake@127.0.0.1:9/fake';

const assert = require('node:assert');

const llm = require('../src/llm_provider.js');
const queue = [];
llm.generate = async () => {
  if (!queue.length) throw new Error('fila de respostas do stub vazia');
  return queue.shift();
};

const { callBrain, buildV2Prompt, nextScriptLine, prematurePitchReason } = require('../src/brain.js');

const def = {
  entry_stage: 'abertura',
  objective: 'agendar reunião',
  globals: { send_preview_stage: 'oferta_previa' },
  stages: [
    {
      id: 'abertura',
      next: 'oferta_previa',
      goal: 'confirmar decisor',
      instruction: 'abrir com observação real',
      advance_when: 'lead confirma',
      reference_copy: [
        'Vi vocês nas avaliações de {{ESPECIALIDADE}} na região. Aí é a {{NOME_EMPRESA}}, do {{NOME_DONO}}?',
        'Estava pesquisando clínicas de {{ESPECIALIDADE}} em {{CIDADE}} e a de vocês me chamou atenção.',
      ],
    },
    { id: 'oferta_previa', next: null, goal: '', instruction: '' },
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
  return {
    id: 'test', currentNodeId: 'abertura', score: 5,
    variables: { NOME_DONO: 'Dra. Karla', NOME_EMPRESA: 'Sorriso Vale', ESPECIALIDADE: 'implantes', CIDADE: 'Governador Valadares' },
  };
}

async function main() {
  // 1) prompt carrega regra de ouro + script como espinha dorsal + ação padrão
  const prompt = buildV2Prompt({
    def, stageId: 'abertura', session: freshSession(), history: [], lastMessage: 'oi',
    nextLine: 'Aí é a Sorriso Vale, da Dra. Karla?',
  });
  assert.ok(/REGRA DE OURO/.test(prompt), 'prompt sem regra de ouro');
  assert.ok(/espinha dorsal/.test(prompt), 'prompt não trata script como espinha dorsal');
  assert.ok(/AÇÃO PADRÃO DESTE TURNO/.test(prompt), 'prompt sem ação padrão do turno');
  assert.ok(/PROIBIDO PITCH/.test(prompt), 'prompt sem proibição de pitch precoce');

  // 2) nextScriptLine: pula linha já enviada e linha com placeholder não resolvido
  const line = nextScriptLine(
    ['Aí é a Sorriso Vale, da Dra. Karla?', 'Linha com {{VAR_NAO_PREENCHIDA}}', 'Estava pesquisando clínicas de implantes.'],
    [{ direction: 'out', text: 'aí é a sorriso vale, da dra. karla?' }],
  );
  assert.strictEqual(line, 'Estava pesquisando clínicas de implantes.');

  // 3) prematurePitchReason: pega pitch antes de oferta_previa, libera depois
  assert.ok(prematurePitchReason('Nós ajudamos clínicas a serem encontradas online', def, 'abertura'));
  assert.ok(prematurePitchReason('trabalho com presença digital', def, 'abertura'));
  assert.strictEqual(prematurePitchReason('Nós ajudamos clínicas', def, 'oferta_previa'), null);
  assert.strictEqual(prematurePitchReason('Posso te mandar uma prévia sem compromisso?', def, 'abertura'), null);

  // 4) pitch precoce 2x → fallback determinístico = próxima MSG do script
  queue.push(llmJson('A gente ajuda clínicas a serem encontradas online!'));
  queue.push(llmJson('Somos especialistas em presença digital para clínicas'));
  let r = await callBrain({ session: freshSession(), history: [], lastMessage: 'oi', flowOverride });
  assert.strictEqual(r.reply.length, 1, 'fallback deveria mandar 1 mensagem');
  assert.ok(/avalia[çc][õo]es|Sorriso Vale/.test(r.reply[0]), `fallback deveria ser a copy do script, veio: ${r.reply[0]}`);
  assert.strictEqual(r.precisa_humano, false, 'fallback de script não escala pra humano');

  // 5) pitch precoce 1x → re-geração limpa é usada
  queue.push(llmJson('Fazemos marketing digital para clínicas como a sua'));
  queue.push(llmJson('Aí é a Sorriso Vale, da Dra. Karla?'));
  r = await callBrain({ session: freshSession(), history: [], lastMessage: 'oi', flowOverride });
  assert.deepStrictEqual(r.reply, ['Aí é a Sorriso Vale, da Dra. Karla?']);

  assert.strictEqual(queue.length, 0, 'stub: sobrou resposta na fila');
  console.log('✓ aderência ao script: regra de ouro + ação padrão + anti-pitch com fallback');
}

main().then(() => process.exit(0)).catch((e) => { console.error('✗', e.message); process.exit(1); });
