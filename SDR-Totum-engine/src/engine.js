const crypto = require('node:crypto');
const { callBrain } = require('./brain');
const { addMessage, getActiveFlow, touch } = require('./store');
const { canSend } = require('./evolution');
const senderState = require('./sender_state');
const memory = require('./memory');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typingDelayMs(text) {
  return 0;
}

function readingDelayMs(text) {
  const wordsPerMin = Number(process.env.READING_WORDS_PER_MIN || 200);
  const safeWordsPerMin = Number.isFinite(wordsPerMin) && wordsPerMin > 0 ? wordsPerMin : 200;
  const chars = String(text || '').length;
  return Math.max((chars / 5 / safeWordsPerMin) * 60000, 3000);
}

const demoVariableDefaults = {
  NOME_DONO: 'Rael',
  NOME_EMPRESA: 'Clínica OdontoSorriso',
  ESPECIALIDADE: 'implantes e ortodontia',
  CIDADE: 'Foz do Iguaçu',
  QTD_AVALIACOES: '187',
  CONTEUDO_RECENTE: 'clareamento dental',
  TEM_SITE: 'não',
  TIPO_OPORTUNIDADE: 'A',
  CONCORRENTE_1: 'Clínica A',
  CONCORRENTE_2: 'Clínica B',
  CONCORRENTE_3: 'Clínica C',
  NOTA_SEO: '6',
  NOME_SDR: 'Israel',
  PRECO_MINIMO: '1.500',
  LINK_AGENDA: 'wa.me/5533997001893',
};

function defaultDemoVariables() {
  return Object.fromEntries(
    Object.entries(demoVariableDefaults).map(([key, fallback]) => [
      key,
      process.env[key] || process.env[`DEMO_${key}`] || fallback,
    ]),
  );
}

function mergeVariables(...sources) {
  return Object.assign({}, defaultDemoVariables(), ...sources);
}

function renderTemplate(text, variables = {}) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    return value === undefined || value === null || value === '' ? _match : String(value);
  });
}

function loadFlow(flowId) {
  return {
    id: flowId,
    mode: 'gemini-brain',
    entryNode: 'abertura',
  };
}

function hasOptOut(text) {
  return /\b(parar|remover|descadastrar|nao quero|não quero|nao me chama|não me chama|pare|stop)\b/i.test(text || '');
}

function alreadySent(phone, msgId) {
  return senderState.alreadySent(phone, msgId);
}

function senderDefaults(conversation, overrides = {}) {
  const phone = conversation.target?.phone || conversation.phone;
  return {
    name: conversation.target?.name || '',
    remoteJid: phone ? `${phone}@s.whatsapp.net` : undefined,
    stage: conversation.currentNodeId || conversation.stage || null,
    flow: conversation.flowId,
    vars: conversation.variables || {},
    status: 'opened',
    ...overrides,
  };
}

function setAwaitUser(conversation, awaitUser, overrides = {}) {
  const phone = conversation.target?.phone || conversation.phone;
  if (!phone) return null;
  return senderState.setAwaitUser(phone, awaitUser, senderDefaults(conversation, overrides));
}

function syncInboxState(conversation, awaitUser, overrides = {}) {
  const phone = conversation.target?.phone || conversation.phone;
  if (!phone) return null;
  return senderState.updateInbox(phone, {
    awaitUser,
    stage: conversation.currentNodeId || conversation.stage || null,
    flow: conversation.flowId,
    vars: conversation.variables || {},
    status: overrides.status || (
      ['completed', 'done'].includes(conversation.status)
        ? 'closed'
        : conversation.status === 'handed_off' ? 'paused' : 'opened'
    ),
  }, senderDefaults(conversation, overrides));
}

function reserveForSend(conversation, msgId, text) {
  const phone = conversation.target?.phone;
  if (!phone || !msgId) return true;
  const reserved = senderState.reserveOutbound(phone, msgId, text, {
    ...senderDefaults(conversation, { awaitUser: false, status: 'opened' }),
    stage: conversation.currentNodeId || conversation.stage || msgId,
  });
  if (!reserved) console.log(`[DEDUP] Skipping ${msgId} for ${phone} — already sent`);
  return reserved;
}

const SCRIPT_TRIGGER_WAIT_MS = {
  'G-00': 14 * 1000,
  'G-08': 20 * 60 * 1000,
  'G-09': 20 * 60 * 1000,
  'G-11': 20 * 60 * 1000,
  'G-35': 24 * 60 * 60 * 1000,
};

const DEFAULT_NO_RESPONSE_WAIT_MS = 20 * 60 * 1000;
const MAX_NO_RESPONSE_TOUCHES = 2;
const COMPLEX_REDIRECT_STAGE = 'COMPLEX_REDIRECT';
const COMPLEX_QUESTION_THRESHOLD = 2;

function nowMs() {
  return Date.now();
}

function iso(ms = nowMs()) {
  return new Date(ms).toISOString();
}

function parseTimeMs(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 0 ? value : 0;
  const text = String(value).trim().toLowerCase();
  if (!text) return 0;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const match = text.match(/^(\d+(?:\.\d+)?)\s*(ms|s|sec|secs|seg|segs|second|seconds|min|mins|m|h|hr|hrs|hour|hours|d|day|days)$/i);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'ms') return amount;
  if (['s', 'sec', 'secs', 'seg', 'segs', 'second', 'seconds'].includes(unit)) return amount * 1000;
  if (['min', 'mins', 'm'].includes(unit)) return amount * 60 * 1000;
  if (['h', 'hr', 'hrs', 'hour', 'hours'].includes(unit)) return amount * 60 * 60 * 1000;
  if (['d', 'day', 'days'].includes(unit)) return amount * 24 * 60 * 60 * 1000;
  return 0;
}

function triggerIdForWait(nodeId, node) {
  const explicit = node?.triggerId || node?.trigger_id || node?.gatilho || node?.data?.triggerId || node?.data?.trigger_id;
  if (explicit) return String(explicit);
  const label = `${nodeId || ''} ${node?.id || ''} ${node?.label || ''} ${node?.name || ''} ${node?.instruction || ''}`;
  const match = label.match(/\bG-\d{2}\b/i);
  if (match) return match[0].toUpperCase();
  const waitMatch = String(nodeId || '').match(/^wait0?(\d+)$/i);
  if (waitMatch) {
    const n = Number(waitMatch[1]);
    if (n === 1) return 'G-00';
    if (n === 5) return 'G-08';
    if (n === 6) return 'G-35';
  }
  return String(nodeId || '');
}

function waitMsForReplyNode(nodeId, node) {
  const explicit = parseTimeMs(
    node?.noResponseWaitMs ??
    node?.no_response_wait_ms ??
    node?.timeoutMs ??
    node?.timeout_ms ??
    node?.waitMs ??
    node?.wait_ms ??
    node?.data?.noResponseWaitMs ??
    node?.data?.timeoutMs ??
    node?.data?.waitMs,
  );
  if (explicit > 0) return explicit;

  const explicitSeconds = Number(
    node?.noResponseWaitSeconds ??
    node?.no_response_wait_seconds ??
    node?.timeoutSeconds ??
    node?.timeout_seconds ??
    node?.waitSeconds ??
    node?.wait_seconds ??
    node?.data?.noResponseWaitSeconds ??
    node?.data?.timeoutSeconds ??
    node?.data?.waitSeconds,
  );
  if (Number.isFinite(explicitSeconds) && explicitSeconds > 0) return explicitSeconds * 1000;

  return SCRIPT_TRIGGER_WAIT_MS[triggerIdForWait(nodeId, node)] || DEFAULT_NO_RESPONSE_WAIT_MS;
}

function stageMap(def) {
  const stages = Array.isArray(def?.stages) ? def.stages : [];
  return Object.fromEntries(stages.map((stage) => [stage.id, stage]));
}

function triggerIdForStage(stageId, stage) {
  const explicit = stage?.triggerId || stage?.trigger_id || stage?.gatilho || stage?.data?.triggerId || stage?.data?.trigger_id;
  if (explicit) return String(explicit);
  const label = `${stageId || ''} ${stage?.id || ''} ${stage?.label || ''} ${stage?.name || ''} ${stage?.instruction || ''}`;
  const match = label.match(/\bG-\d{2}\b/i);
  if (match) return match[0].toUpperCase();

  const normalized = String(stageId || '').toLowerCase();
  if (normalized === 'abertura') return 'G-00';
  if (normalized === 'observacao') return 'G-01';
  if (normalized === 'oferta_previa') return 'G-08';
  if (normalized === 'previa') return 'G-09';
  if (normalized === 'implicacao') return 'G-11';
  if (normalized === 'agendamento') return 'G-35';
  return String(stageId || '');
}

function waitMsForStage(stageId, stage) {
  const explicit = parseTimeMs(
    stage?.noResponseWaitMs ??
    stage?.no_response_wait_ms ??
    stage?.timeoutMs ??
    stage?.timeout_ms ??
    stage?.waitMs ??
    stage?.wait_ms ??
    stage?.data?.noResponseWaitMs ??
    stage?.data?.timeoutMs ??
    stage?.data?.waitMs,
  );
  if (explicit > 0) return explicit;

  const explicitSeconds = Number(
    stage?.noResponseWaitSeconds ??
    stage?.no_response_wait_seconds ??
    stage?.timeoutSeconds ??
    stage?.timeout_seconds ??
    stage?.waitSeconds ??
    stage?.wait_seconds ??
    stage?.data?.noResponseWaitSeconds ??
    stage?.data?.timeoutSeconds ??
    stage?.data?.waitSeconds,
  );
  if (Number.isFinite(explicitSeconds) && explicitSeconds > 0) return explicitSeconds * 1000;

  return SCRIPT_TRIGGER_WAIT_MS[triggerIdForStage(stageId, stage)] || DEFAULT_NO_RESPONSE_WAIT_MS;
}

function lastOutboundAtMs(conversation) {
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.direction === 'out') {
      const at = Date.parse(messages[i].createdAt || messages[i].created_at || messages[i].ts || '');
      if (Number.isFinite(at)) return at;
    }
  }
  const updated = Date.parse(conversation.updatedAt || conversation.updated_at || '');
  return Number.isFinite(updated) ? updated : nowMs();
}

function noResponseState(conversation) {
  return conversation.variables?._sdrNoResponse || {};
}

function armNoResponseTimer(conversation, nodeId, node) {
  const triggerId = triggerIdForWait(nodeId, node);
  const waitMs = waitMsForReplyNode(nodeId, node);
  const state = noResponseState(conversation);
  const now = nowMs();
  const existingSameWait = state.nodeId === nodeId && state.triggerId === triggerId;
  const waitingSinceMs = existingSameWait && state.waitingSince
    ? Date.parse(state.waitingSince)
    : lastOutboundAtMs(conversation);
  const safeWaitingSinceMs = Number.isFinite(waitingSinceMs) ? waitingSinceMs : now;
  const deadlineMs = safeWaitingSinceMs + waitMs;

  conversation.variables._sdrNoResponse = {
    ...state,
    nodeId,
    triggerId,
    waitMs,
    waitingSince: iso(safeWaitingSinceMs),
    deadlineAt: iso(deadlineMs),
    armedAt: existingSameWait && state.armedAt ? state.armedAt : iso(now),
    touches: Number(state.touches || 0),
  };
}

function armStageNoResponseTimer(conversation, stageId, stage) {
  const triggerId = triggerIdForStage(stageId, stage);
  const waitMs = waitMsForStage(stageId, stage);
  const state = noResponseState(conversation);
  const now = nowMs();
  const existingSameWait = state.stageId === stageId && state.triggerId === triggerId;
  const waitingSinceMs = existingSameWait && state.waitingSince
    ? Date.parse(state.waitingSince)
    : lastOutboundAtMs(conversation);
  const safeWaitingSinceMs = Number.isFinite(waitingSinceMs) ? waitingSinceMs : now;
  const deadlineMs = safeWaitingSinceMs + waitMs;

  conversation.variables._sdrNoResponse = {
    ...state,
    stageId,
    triggerId,
    waitMs,
    waitingSince: iso(safeWaitingSinceMs),
    deadlineAt: iso(deadlineMs),
    armedAt: existingSameWait && state.armedAt ? state.armedAt : iso(now),
    touches: Number(state.touches || 0),
  };
}

function clearNoResponseTimer(conversation) {
  if (conversation.variables?._sdrNoResponse) delete conversation.variables._sdrNoResponse;
}

function landingPageUrl() {
  return process.env.LANDING_PAGE_URL || 'https://grupototum.com';
}

function complexRedirectResult(conversation, reason = 'complex') {
  return {
    reply: [
      'Posso ver que você tem interesse real no método 👀 As perguntas que você está fazendo são exatamente as que a gente responde em profundidade na nossa reunião de apresentação.',
      `Aqui está nossa página pra você conhecer antes da gente conversar: ${landingPageUrl()}`,
      'Qual o melhor horário pra você amanhã ou depois? Tenho manhã ou tarde disponível.',
    ],
    msgIds: [
      `${COMPLEX_REDIRECT_STAGE}:msg1`,
      `${COMPLEX_REDIRECT_STAGE}:msg2`,
      `${COMPLEX_REDIRECT_STAGE}:msg3`,
    ],
    stage: COMPLEX_REDIRECT_STAGE,
    stage_proposto: COMPLEX_REDIRECT_STAGE,
    stage_anterior: conversation.currentNodeId || conversation.stage || null,
    temperatura: conversation.temperature || 'quente',
    temperature: conversation.temperature || 'quente',
    score: Math.max(1, Number(conversation.score || 1)),
    send_preview: false,
    booked: false,
    precisa_humano: false,
    done: false,
    objecao: null,
    intent: 'complex_redirect',
    complex: true,
    complex_reason: reason,
  };
}

function isInfoDemandIntent(result) {
  return String(result?.intent || result?.intencao || result?.intenção || '').toLowerCase() === 'info_demand';
}

function isQuestionLike(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('?')) return true;
  return /\b(por\s*que|porque|como|qual|quais|quando|onde|quem|quanto|quantos|voc[eê]s?\s+podem|me\s+explica|explica|detalhe|detalhar|ajudar\s+no\s+que|no\s+que\s+voc[eê]s?\s+ajudam)\b/i.test(normalized);
}

function updateComplexityState(conversation, text) {
  if (!conversation.variables) conversation.variables = {};
  const vars = conversation.variables;
  const currentStage = conversation.currentNodeId || conversation.stage || null;
  const wasWaiting = conversation.status === 'waiting_input';
  const questionLike = isQuestionLike(text);

  if (!wasWaiting || !questionLike) {
    vars.__questionCount = 0;
    vars.__questionStage = currentStage;
    return { complex: Boolean(vars.complex || vars.__complex), questionCount: Number(vars.__questionCount || 0) };
  }

  const previousQuestionStage = vars.__questionStage || currentStage;
  const stageDidNotAdvance = previousQuestionStage === currentStage;
  const questionCount = stageDidNotAdvance ? Number(vars.__questionCount || 0) + 1 : 1;
  vars.__questionCount = questionCount;
  vars.__questionStage = currentStage;

  if (questionCount >= COMPLEX_QUESTION_THRESHOLD) {
    vars.complex = true;
    vars.__complex = true;
    vars.__complexReason = 'question_loop';
    vars.__complexMarkedAt = iso();
  }

  return { complex: Boolean(vars.complex || vars.__complex), questionCount };
}

async function markColdAndClose(conversation, reason = 'no_response_after_second_touch') {
  conversation.status = 'frio';
  conversation.temperature = 'frio';
  conversation.done = true;
  conversation.currentNodeId = conversation.currentNodeId || 'encerrado';
  conversation.variables._sdrNoResponse = {
    ...(conversation.variables._sdrNoResponse || {}),
    closedAt: iso(),
    closeReason: reason,
  };
  conversation.variables.crm_status = 'FRIO';
  await touch(conversation);
  syncInboxState(conversation, false, { status: 'closed' });
  return {
    status: conversation.status,
    brain: {
      node_flow: true,
      stage: conversation.currentNodeId,
      reply: [],
      temperatura: 'frio',
      temperature: 'frio',
      score: conversation.score,
      send_preview: false,
      booked: false,
      precisa_humano: false,
      done: true,
      waiting_for_reply: false,
      no_response_closed: true,
    },
    outbound: [],
  };
}

function applyBrainResult(conversation, result) {
  conversation.currentNodeId = result.stage;
  conversation.temperature = result.temperatura || result.temperature;
  conversation.score = result.score;
  conversation.booked = result.booked;
  conversation.done = result.done;
  conversation.precisaHumano = result.precisa_humano;
  conversation.sendPreview = result.send_preview;
  conversation.variables = {
    ...conversation.variables,
    __brain: {
      stage: result.stage,
      temperatura: result.temperatura || result.temperature,
      temperature: result.temperatura || result.temperature,
      score: result.score,
      send_preview: result.send_preview,
      booked: result.booked,
      precisa_humano: result.precisa_humano,
      done: result.done,
      intent: result.intent,
      complex: result.complex,
      complex_reason: result.complex_reason,
      updated_at: new Date().toISOString(),
    },
  };

  if (result.done || result.booked || result.stage === 'encerrado') {
    conversation.status = 'done';
  } else if (result.precisa_humano) {
    conversation.status = 'handed_off';
  } else {
    conversation.status = 'waiting_input';
  }
}

function generateReport(conversation, result) {
  return {
    conversationId: conversation.id,
    phone: conversation.target?.phone,
    stage: result.stage,
    temperatura: result.temperatura || result.temperature,
    score: result.score,
    booked: result.booked,
    done: result.done,
    precisa_humano: result.precisa_humano,
    send_preview: result.send_preview,
    total_messages: conversation.messages?.length || 0,
    generated_at: new Date().toISOString(),
  };
}

function stableTextHash(text) {
  return crypto.createHash('sha1').update(String(text || '')).digest('hex').slice(0, 12);
}

function brainReplyMsgId(result, conversation, index, total, text) {
  const explicit = Array.isArray(result.msgIds) ? result.msgIds[index]
    : Array.isArray(result.msg_ids) ? result.msg_ids[index]
      : result.msgId || result.msg_id || result.messageId || result.message_id;
  const base = explicit || `brain:${result.stage || conversation.currentNodeId || 'reply'}:${stableTextHash(text)}`;
  return total > 1 ? `${base}#${index + 1}` : String(base);
}

async function sendBrainReplies({ conversation, result, sendText }) {
  const replies = Array.isArray(result?.reply) ? result.reply : [];
  const outbound = [];
  if (replies.length) setAwaitUser(conversation, false);

  for (const [index, text] of replies.entries()) {
    const msgId = brainReplyMsgId(result, conversation, index, replies.length, text);
    if (!reserveForSend(conversation, msgId, text)) continue;
    const transport = await sendText({ number: conversation.target.phone, text, msgId, dedupReserved: true });
    const message = await addMessage(conversation, {
      direction: 'out',
      sender: 'bot',
      text,
      msgId,
      nodeId: msgId,
      transport,
    });
    outbound.push(message);
    const phone = conversation.target?.phone;
    const stage = result.stage || conversation.currentNodeId;
    memory.ingestMemory(phone, text, stage);
  }

  return outbound;
}

function getNodeText(node) {
  if (!node) return '';
  if (node.text || node.message || node.content) return node.text || node.message || node.content;
  if (Array.isArray(node.messages)) return node.messages.join('\n');
  return '';
}

function isWaitForReplyNode(node) {
  if (!node) return false;
  const type = String(node.type || '').toLowerCase();
  if (type === 'wait_input' || type === 'wait_for_reply') return true;
  if (node.awaitResponse === true || node.await_response === true || node.waitForReply === true) return true;
  const label = `${node.id || ''} ${node.label || ''} ${node.name || ''} ${node.instruction || ''}`;
  return /\baguardar\s+resposta\b|\bwait\s+for\s+reply\b/i.test(label);
}

function nodeDelayMs(node) {
  if (!node) return 0;
  const rawMs = node.delayMs ?? node.delay_ms ?? node.waitMs ?? node.wait_ms ?? node.durationMs ?? node.duration_ms;
  const rawSeconds = node.delaySeconds ?? node.delay_seconds ?? node.waitSeconds ?? node.wait_seconds ?? node.seconds;
  const dataMs = node.data?.delayMs ?? node.data?.delay_ms ?? node.data?.waitMs ?? node.data?.wait_ms;
  const dataSeconds = node.data?.delaySeconds ?? node.data?.delay_seconds ?? node.data?.waitSeconds ?? node.data?.wait_seconds;
  const ms = Number(rawMs ?? dataMs);
  if (Number.isFinite(ms) && ms > 0) return ms;
  const seconds = Number(rawSeconds ?? dataSeconds);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return 0;
}

function isDelayOnlyNode(node) {
  if (!node) return false;
  const type = String(node.type || '').toLowerCase();
  if (['delay', 'wait', 'timer', 'sleep', 'read_delay', 'reading_delay'].includes(type)) return true;
  return nodeDelayMs(node) > 0 && !isWaitForReplyNode(node) && !getNodeText(node);
}

function isBVariantNode(nodeId, nodes) {
  const id = String(nodeId || '');
  const match = id.match(/^(.*?)([._-]?)[Bb]$/);
  if (!match) return false;
  return Boolean(nodes?.[`${match[1]}${match[2]}A`]);
}

function selectTransition(node, text) {
  const transitions = Array.isArray(node?.transitions) ? node.transitions : [];
  for (const transition of transitions) {
    if (!transition || transition.default || !transition.pattern) continue;
    try {
      if (new RegExp(transition.pattern, 'i').test(text || '')) return transition;
    } catch {
      // Flux regex invalida: ignora e cai no default.
    }
  }
  return transitions.find((transition) => transition && transition.default) || transitions[0] || null;
}

async function sendSequencedText({ conversation, text, nodeId, sendText, outbound, previousText, explicitDelayMs }) {
  if (!reserveForSend(conversation, nodeId, text)) return text;
  setAwaitUser(conversation, false);

  if (canSend()) {
    if (explicitDelayMs > 0) await sleep(explicitDelayMs);
  }

  conversation.currentNodeId = nodeId;
  const transport = await sendText({ number: conversation.target.phone, text, msgId: nodeId, dedupReserved: true });
  const message = await addMessage(conversation, {
    direction: 'out',
    sender: 'bot',
    text,
    msgId: nodeId,
    nodeId,
    transport,
  });
  outbound.push(message);
  return text;
}

async function runNodeFlowTurn({ conversation, lastMessage, sendText, noResponseTimeout = false }) {
  let active;
  try { active = await getActiveFlow(); } catch { active = null; }
  const definition = active?.definition || {};
  const nodes = definition.nodes || null;
  if (!nodes || typeof nodes !== 'object') return null;

  const outbound = [];
  const variables = mergeVariables(conversation.variables);
  let nodeId = conversation.currentNodeId;
  if (!nodes[nodeId]) {
    // Only fall back to entryNode when nodeId is null/undefined (fresh start).
    // If nodeId has a value but isn't in this flow's nodes (e.g. a brain stage like
    // 'observacao'), return null so the caller can handle it — never restart the node
    // flow mid-conversation by jumping to entryNode.
    if (nodeId) return null;
    nodeId = definition.entryNode || definition.entry_node || definition.start || Object.keys(nodes)[0];
  }
  let node = nodes[nodeId];

  if (isWaitForReplyNode(node)) {
    if (!noResponseTimeout) armNoResponseTimer(conversation, nodeId, node);
    const transition = selectTransition(node, lastMessage);
    nodeId = transition?.next;
    node = nodes[nodeId];
    if (transition?.scoreHint) {
      conversation.score = Math.min(10, Number(conversation.score || 0) + Number(transition.scoreHint || 0));
    }
  }

  let previousText = '';
  let explicitDelayMs = 0;
  let sendPreview = false;
  let done = false;
  let guard = 0;

  while (node && guard < 80) {
    guard += 1;

    if (isWaitForReplyNode(node)) {
      conversation.currentNodeId = nodeId;
      conversation.status = 'waiting_input';
      armNoResponseTimer(conversation, nodeId, node);
      await touch(conversation);
      syncInboxState(conversation, true);
      return {
        status: conversation.status,
        brain: {
          node_flow: true,
          stage: nodeId,
          reply: outbound.map((message) => message.text),
          temperatura: conversation.temperature,
          temperature: conversation.temperature,
          score: conversation.score,
          send_preview: sendPreview,
          booked: false,
          precisa_humano: false,
          done: false,
          waiting_for_reply: true,
        },
        outbound,
      };
    }

    if (node.type === 'end') {
      done = true;
      conversation.currentNodeId = nodeId;
      break;
    }

    if (isBVariantNode(nodeId, nodes)) {
      nodeId = node.next;
      node = nodes[nodeId];
      continue;
    }

    if (isDelayOnlyNode(node)) {
      explicitDelayMs += nodeDelayMs(node);
      nodeId = node.next;
      node = nodes[nodeId];
      continue;
    }

    if (node.type === 'action') {
      if (/previa|prévia|preview/i.test(node.action || node.name || node.id || '')) sendPreview = true;
      explicitDelayMs += nodeDelayMs(node);
      nodeId = node.next;
      node = nodes[nodeId];
      continue;
    }

    const rawText = getNodeText(node);
    if (rawText) {
      const text = renderTemplate(rawText, variables).trim();
      previousText = await sendSequencedText({
        conversation,
        text,
        nodeId,
        sendText,
        outbound,
        previousText,
        explicitDelayMs,
      });
      explicitDelayMs = 0;
      if (node.temperature) conversation.temperature = node.temperature;
      if (node.optOut) conversation.optOut = true;
    }

    nodeId = node.next;
    node = nodes[nodeId];
  }

  conversation.currentNodeId = nodeId || conversation.currentNodeId;
  conversation.status = done ? 'done' : 'waiting_input';
  conversation.done = done;
  conversation.sendPreview = sendPreview || conversation.sendPreview;
  await touch(conversation);
  syncInboxState(conversation, !done, { status: done ? 'closed' : 'opened' });

  return {
    status: conversation.status,
    brain: {
      node_flow: true,
      stage: conversation.currentNodeId,
      reply: outbound.map((message) => message.text),
      temperatura: conversation.temperature,
      temperature: conversation.temperature,
      score: conversation.score,
      send_preview: sendPreview,
      booked: done && conversation.temperature === 'hot',
      precisa_humano: false,
      done,
      waiting_for_reply: false,
    },
    outbound,
  };
}

async function runBrainTurn({ conversation, lastMessage, sendText }) {
  if ((conversation.variables?.complex || conversation.variables?.__complex)
    && conversation.currentNodeId !== COMPLEX_REDIRECT_STAGE) {
    const result = complexRedirectResult(conversation, conversation.variables.__complexReason || 'complex');
    console.log('[complex] redirect antes do brain:', JSON.stringify({
      phone: conversation.target?.phone,
      stage: conversation.currentNodeId,
      reason: result.complex_reason,
    }));
    applyBrainResult(conversation, result);
    await touch(conversation);
    const outbound = await sendBrainReplies({ conversation, result, sendText });
    syncInboxState(conversation, true);
    return { status: conversation.status, brain: result, outbound };
  }

  const nodeFlowResult = await runNodeFlowTurn({ conversation, lastMessage, sendText });
  if (nodeFlowResult) return nodeFlowResult;

  const phone = conversation.target?.phone;
  let ragContext = null;
  if (phone && lastMessage) {
    try { ragContext = await memory.buildPrompt(phone, lastMessage, conversation.messages || []); }
    catch (e) { console.error('[memory] buildPrompt failed:', e.message); }
  }

  let result = await callBrain({
    session: conversation,
    history: conversation.messages || [],
    lastMessage,
    classificacao: conversation.variables?.classificacao || '',
    ragContext,
  });

  if (isInfoDemandIntent(result)) {
    conversation.variables.complex = true;
    conversation.variables.__complex = true;
    conversation.variables.__complexReason = 'info_demand';
    conversation.variables.__complexMarkedAt = iso();
    result = complexRedirectResult(conversation, 'info_demand');
  }

  console.log('[brain] JSON antes do envio:', JSON.stringify(result, null, 2));
  applyBrainResult(conversation, result);

  if (result.done) {
    conversation.variables.__report = generateReport(conversation, result);
    console.log('[engine] sessão marcada como done:', conversation.variables.__report);
  }

  await touch(conversation);

  if (result.precisa_humano) {
    console.log('[engine] sessão entregue para humano:', {
      conversationId: conversation.id,
      phone: conversation.target?.phone,
      stage: result.stage,
      score: result.score,
    });

    syncInboxState(conversation, false, { status: 'paused' });
    return {
      status: conversation.status,
      brain: result,
      outbound: [],
    };
  }

  const outbound = await sendBrainReplies({ conversation, result, sendText });
  if (conversation.status === 'waiting_input') {
    let active;
    try { active = await getActiveFlow(); } catch { active = null; }
    const stages = stageMap(active?.definition || {});
    const stage = stages[conversation.currentNodeId];
    if (stage) {
      armStageNoResponseTimer(conversation, conversation.currentNodeId, stage);
      await touch(conversation);
    }
    syncInboxState(conversation, true);
  } else {
    syncInboxState(conversation, false, { status: ['done', 'completed'].includes(conversation.status) ? 'closed' : 'opened' });
  }

  return {
    status: conversation.status,
    brain: result,
    outbound,
  };
}

async function processNoResponseTimeout({ conversation, sendText }) {
  if (conversation.status !== 'waiting_input') {
    return { status: conversation.status, outbound: [], brain: null, skipped: true, reason: 'not_waiting_input' };
  }
  if (!conversation.variables) conversation.variables = {};

  let active;
  try { active = await getActiveFlow(); } catch { active = null; }
  const nodes = active?.definition?.nodes || null;
  const nodeId = conversation.currentNodeId;
  const node = nodes && nodes[nodeId];
  const stages = stageMap(active?.definition || {});
  const stage = stages[nodeId];
  if (!isWaitForReplyNode(node) && !stage) {
    return { status: conversation.status, outbound: [], brain: null, skipped: true, reason: 'current_node_is_not_wait' };
  }

  if (isWaitForReplyNode(node)) armNoResponseTimer(conversation, nodeId, node);
  else armStageNoResponseTimer(conversation, nodeId, stage);
  const state = noResponseState(conversation);
  const deadlineMs = Date.parse(state.deadlineAt || '');
  if (!Number.isFinite(deadlineMs) || nowMs() < deadlineMs) {
    await touch(conversation);
    return {
      status: conversation.status,
      outbound: [],
      brain: {
        node_flow: true,
        stage: nodeId,
        waiting_for_reply: true,
        no_response_due_at: state.deadlineAt,
      },
      skipped: true,
      reason: 'waiting_for_deadline',
    };
  }

  const touches = Number(state.touches || 0);
  if (touches >= MAX_NO_RESPONSE_TOUCHES - 1) {
    return markColdAndClose(conversation);
  }

  conversation.variables._sdrNoResponse = {
    ...state,
    touches: touches + 1,
    firedAt: iso(),
  };
  conversation.status = 'running';
  setAwaitUser(conversation, false);
  await touch(conversation);

  if (stage && !isWaitForReplyNode(node)) {
    return runBrainTurn({
      conversation,
      lastMessage: '[SEM RESPOSTA DO LEAD NO PRAZO DO GATILHO]',
      sendText,
    });
  }

  return runNodeFlowTurn({
    conversation,
    lastMessage: '[SEM RESPOSTA DO LEAD NO PRAZO DO GATILHO]',
    sendText,
    noResponseTimeout: true,
  });
}

async function startConversation({ conversation, sendText }) {
  conversation.variables = mergeVariables(conversation.variables);
  // null currentNodeId → runNodeFlowTurn will start from entryNode automatically
  conversation.temperature = conversation.temperature || 'frio';
  conversation.status = 'running';
  setAwaitUser(conversation, false);
  await touch(conversation);

  return runBrainTurn({
    conversation,
    lastMessage: 'Inicie a abordagem com base nas variáveis da clínica.',
    sendText,
  });
}

async function receiveHumanMessage({ conversation, text, variables = {}, sendText }) {
  if (conversation.status === 'handed_off' || conversation.status === 'done' || conversation.status === 'completed') {
    return { status: conversation.status, outbound: [], brain: null };
  }

  updateComplexityState(conversation, text);
  setAwaitUser(conversation, false);

  await addMessage(conversation, {
    direction: 'in',
    sender: 'lead',
    text,
  });
  const phone = conversation.target?.phone;
  const stage = conversation.currentNodeId || conversation.stage;
  memory.ingestMemory(phone, text, stage);

  conversation.variables = mergeVariables(conversation.variables, variables, { last_human_message: text });
  clearNoResponseTimer(conversation);

  if (hasOptOut(text)) {
    conversation.optOut = true;
    conversation.status = 'completed';
    conversation.currentNodeId = 'encerrado';
    await touch(conversation);
    syncInboxState(conversation, false, { status: 'closed' });
    return { status: conversation.status, outbound: [], brain: null };
  }

  conversation.status = 'running';
  await touch(conversation);

  return runBrainTurn({
    conversation,
    lastMessage: text,
    sendText,
  });
}

module.exports = {
  defaultDemoVariables,
  alreadySent,
  loadFlow,
  processNoResponseTimeout,
  receiveHumanMessage,
  renderTemplate,
  startConversation,
};
