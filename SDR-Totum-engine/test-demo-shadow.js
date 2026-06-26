#!/usr/bin/env node
// Validação ponta a ponta em BRIDGE_MODE=shadow.
// Simula o lead respondendo em cada wait_input e confirma que o flow
// vai do bloco 1 ao END sem quebrar, gerando o report final.
//
// Uso: node test-demo-shadow.js [flowId]
// Exemplo: node test-demo-shadow.js sdr-demo

process.env.BRIDGE_MODE = 'shadow';
process.env.ALLOW_AUTOSEND = 'false';

const { createConversation, getConversation } = require('./src/store');
const { startConversation, receiveHumanMessage } = require('./src/engine');
const evolution = require('./src/evolution');

const flowId = process.argv[2] || 'sdr-demo';

// Variables must use UPPERCASE keys to match {{NOME_DONO}} etc. in flow templates
const DEMO_VARS = {
  NOME_EMPRESA: process.env.DEMO_NOME_EMPRESA || 'Clínica OdontoSorriso',
  NOME_DONO: process.env.DEMO_NOME_DONO || 'Rael',
  ESPECIALIDADE: process.env.DEMO_ESPECIALIDADE || 'implantes e ortodontia',
  CIDADE: process.env.DEMO_CIDADE || 'Foz do Iguaçu',
  QTD_AVALIACOES: process.env.DEMO_QTD_AVALIACOES || '187',
  CONTEUDO_RECENTE: process.env.DEMO_CONTEUDO_RECENTE || 'clareamento dental',
  TEM_SITE: process.env.DEMO_TEM_SITE || 'não',
  TIPO_OPORTUNIDADE: process.env.DEMO_TIPO_OPORTUNIDADE || 'A',
};

// 6 [WAIT] points in sdr-demo.json (in order)
const LEAD_REPLIES = [
  'sou eu sim',                                // wait01 — abertura (confirmação empresa)
  'não temos site não',                        // wait02 — pk01 (tem site?)
  'faz sentido sim',                           // wait03 — lógica SPIN ("tem lógica?")
  'com certeza, deve acontecer bastante',      // wait04 — implicação (dor)
  'pode mandar sim',                           // wait05 — oferta prévia
  'amanhã às 10h fica ótimo',                 // wait06 — agendamento
];

function sep(label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[${label}]`);
}

function assertRendered(outbound, label) {
  for (const message of outbound) {
    if (/\{\{\s*[\w.-]+\s*\}\}/.test(message.text)) {
      console.error(`\nFAIL: unresolved template variable in ${label}: ${message.text}`);
      process.exit(1);
    }
  }
}

async function run() {
  sep('INIT');
  console.log(`Flow: ${flowId}`);
  console.log('Variables:', DEMO_VARS);

  const conv = await createConversation({
    flowId,
    target: '5545999999999',
    variables: DEMO_VARS,
  });
  console.log('Conversation created:', conv.id);

  sep('START (bloco 1 abertura)');
  let result = await startConversation({ conversation: conv, sendText: evolution.sendText });
  assertRendered(result.outbound, 'START');
  const expectedFirst = 'Vi vocês aqui nas avaliações de implantes e ortodontia na região. 187 avaliações. Aí é a Clínica OdontoSorriso, do Rael?';
  if (result.outbound[0]?.text !== expectedFirst) {
    console.error('\nFAIL: first message was not rendered as expected.');
    console.error('Expected:', expectedFirst);
    console.error('Received:', result.outbound[0]?.text);
    process.exit(1);
  }
  console.log('Status:', conv.status, '| Node:', conv.currentNodeId);
  console.log('Outbound messages:', result.outbound.map(m => `  "${m.text.slice(0, 80)}"`).join('\n'));

  let replyIdx = 0;
  let rounds = 0;
  const MAX_ROUNDS = 20;

  while (conv.status === 'waiting_input' && rounds < MAX_ROUNDS) {
    rounds++;
    const reply = LEAD_REPLIES[replyIdx];
    if (reply === undefined) {
      console.error(`\nFAIL: more wait_input nodes than LEAD_REPLIES entries (stopped at round ${rounds})`);
      console.error('Add more entries to LEAD_REPLIES in this script.');
      process.exit(1);
    }

    sep(`ROUND ${rounds} — lead: "${reply}"`);
    result = await receiveHumanMessage({
      conversation: conv,
      text: reply,
      variables: {},
      sendText: evolution.sendText,
    });
    assertRendered(result.outbound, `ROUND ${rounds}`);
    replyIdx++;
    console.log('Status:', conv.status, '| Node:', conv.currentNodeId);
    if (result.outbound.length) {
      console.log('Bot sent:', result.outbound.map(m => `  "${m.text.slice(0, 80)}"`).join('\n'));
    }
    const stubbed = conv.nodeLog.filter(n => n.stubbed).slice(-3);
    if (stubbed.length) console.log('Stubbed actions:', stubbed.map(n => n.action || n.nodeId));
  }

  sep('RESULT');
  if (conv.status === 'completed') {
    console.log('✅ Flow completed without errors.');
  } else {
    console.log(`❌ Flow ended with status: ${conv.status} (expected: completed)`);
    process.exit(1);
  }

  console.log('\nREPORT:');
  console.log({
    conversationId: conv.id,
    flowId: conv.flowId,
    target: conv.target,
    status: conv.status,
    temperature: conv.temperature,
    score: conv.score,
    optOut: conv.optOut,
    totalMessages: conv.messages.length,
    outbound: conv.messages.filter(m => m.direction === 'outbound').length,
    inbound: conv.messages.filter(m => m.direction === 'inbound').length,
    nodeLogLength: conv.nodeLog.length,
  });

  console.log('\nNode log:');
  conv.nodeLog.forEach(n => console.log(' ', n.nodeId, `(${n.type})${n.stubbed ? ' [stubbed]' : ''}`));
}

run().catch(err => {
  console.error('\nFAIL:', err.message);
  process.exit(1);
});
