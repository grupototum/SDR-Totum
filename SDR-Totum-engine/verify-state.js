#!/usr/bin/env node
/**
 * verify-state.js - Verifica o estado de uma conversa antes de processar webhook
 * Uso: node verify-state.js <phone>
 */

const { getConversationByPhone } = require('./src/store');
const senderState = require('./src/sender_state');

const phone = process.argv[2];
if (!phone) {
  console.error('Uso: node verify-state.js <phone>');
  process.exit(1);
}

async function verify() {
  console.log(`=== Verificando estado para ${phone} ===\n`);
  
  // 1. Check sender state JSON
  const snapshot = senderState.getSender(phone);
  console.log('Sender State (sdr-state.json):');
  if (snapshot) {
    console.log(`  phone: ${snapshot.phone}`);
    console.log(`  stage: ${snapshot.stage}`);
    console.log(`  flow: ${snapshot.flow}`);
    console.log(`  history length: ${snapshot.history?.length || 0}`);
  } else {
    console.log('  (nenhum estado encontrado)');
  }
  console.log();
  
  // 2. Check DB conversation
  const conv = await getConversationByPhone(phone);
  console.log('Database (sdr_sessions):');
  if (conv) {
    console.log(`  id: ${conv.id}`);
    console.log(`  phone: ${conv.target?.phone}`);
    console.log(`  stage: ${conv.currentNodeId || conv.stage}`);
    console.log(`  status: ${conv.status}`);
    console.log(`  temperature: ${conv.temperature}`);
    console.log(`  score: ${conv.score}`);
    console.log(`  messages: ${conv.messages?.length || 0}`);
    console.log(`  flowId: ${conv.flowId}`);
  } else {
    console.log('  (nenhuma sessão encontrada)');
  }
  console.log();
  
  // 3. Verify consistency
  console.log('=== Verificação de Consistência ===');
  if (!conv) {
    console.log('⚠️  WARN: Nenhuma sessão no DB - webhook criará nova sessão');
  } else if (conv.status === 'waiting_input' || conv.status === 'active') {
    console.log(`✓ OK: Sessão ativa em stage=${conv.currentNodeId || conv.stage}`);
  } else {
    console.log(`⚠️  WARN: Sessão em status=${conv.status}`);
  }
}

verify().catch(console.error);