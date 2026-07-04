const fs = require('node:fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getActiveFlow } = require('./store');
const llmProvider         = require('./llm_provider');

// ───────────────────────── infra (mantida do v1) ─────────────────────────
function readEnvValue(file, key) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const line = content.split(/\r?\n/).find((item) => item.match(new RegExp(`^${key}\\s*=`)));
    if (!line) return '';
    return line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  } catch { return ''; }
}
function geminiApiKey() {
  return process.env.GEMINI_API_KEY || readEnvValue('/home/totum/.pepper/.env', 'GEMINI_API_KEY');
}
const genAI = new GoogleGenerativeAI(geminiApiKey());
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash';
const allowedTemperatures = new Set(['frio', 'morno', 'quente', 'fora_de_perfil']);

function extractJson(text) {
  const clean = String(text || '').replace(/```json\n?/gi, '').replace(/```/g, '').trim();
  if (!clean) throw new Error('Gemini returned an empty response');
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf('{'); const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1));
  throw new Error('Gemini response did not contain valid JSON');
}
function renderTemplate(text, vars = {}) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => {
    const v = vars[k]; return v === undefined || v === null || v === '' ? m : String(v);
  });
}

// ───────────────────────── máquina de estados v2 ─────────────────────────
function stageMap(def) {
  const map = {}; (def.stages || []).forEach((s, i) => { map[s.id] = { ...s, __i: i }; });
  return map;
}
function objectionInterrupt(def) {
  return (def.interrupts || []).find((it) => it.id === 'objecao') || null;
}

// Decide o stage AUTORITATIVO a partir do proposto pelo LLM. O motor é a autoridade.
function validateTransition({ def, current, proposed, raw, session }) {
  const map = stageMap(def);
  const entry = def.entry_stage || (def.stages && def.stages[0] && def.stages[0].id) || 'abertura';
  const curId = map[current] ? current : entry;
  const cur = map[curId];
  const vars = session.variables || (session.variables = {});
  const obj = objectionInterrupt(def);
  const flags = { objecao: null, objecao_count: Number(vars.__objecao_count || 0), clamped: false };

  // 0) terminal já encerrado → permanece
  if (cur && cur.terminal) return { stage: curId, done: true, flags };

  // 1) fora de perfil → encerra
  const temp = allowedTemperatures.has(raw.temperatura) ? raw.temperatura : 'morno';
  if (temp === 'fora_de_perfil') {
    return { stage: 'encerrado', done: true, flags };
  }

  // 2) objeção (interrupt) tem prioridade sobre transição normal
  const cat = raw.objecao && String(raw.objecao).trim() ? String(raw.objecao).trim() : null;
  if (cat && obj) {
    const count = Number(vars.__objecao_count || 0) + 1;
    vars.__objecao_count = count;
    if (!vars.__ponto_retorno) vars.__ponto_retorno = curId; // PONTO_RETORNO
    flags.objecao = cat; flags.objecao_count = count;
    const maxIt = Number(obj.max_iterations || 2);
    if (count > maxIt) {
      const goto = (obj.on_exceed && obj.on_exceed.goto) || 'encerrado';
      vars.__objecao_count = 0; delete vars.__ponto_retorno;
      return { stage: goto, done: true, forceTemp: (obj.on_exceed && obj.on_exceed.set && obj.on_exceed.set.temperatura) || 'frio', flags };
    }
    // acolhe e PERMANECE no estágio de origem (retorno = PONTO_RETORNO)
    return { stage: curId, done: false, flags };
  }

  // 3) sem objeção → zera contador e libera retorno
  vars.__objecao_count = 0; const ponto = vars.__ponto_retorno; delete vars.__ponto_retorno;

  // 4) transição normal: permitir manter, avançar 1 (cur.next), ou retornar ao ponto
  const want = map[proposed] ? proposed : curId;
  const legalNext = cur && cur.next;
  if (want === curId) return { stage: curId, done: false, flags };
  if (legalNext && want === legalNext) return { stage: legalNext, done: map[legalNext] && map[legalNext].terminal ? true : false, flags };
  if (ponto && want === ponto) return { stage: ponto, done: false, flags }; // retorno legítimo
  // ilegal (pular >1 ou regredir) → clampa pro atual; motor manda
  flags.clamped = true;
  return { stage: curId, done: false, flags };
}

// autoridade das ações por estágio
function authorizeActions(stage, raw) {
  const send_preview = Boolean(raw.send_preview) && (stage === 'previa' || stage === 'oferta_previa');
  const booked = Boolean(raw.booked) && (stage === 'agendamento');
  return { send_preview, booked };
}

function buildV2Prompt({ def, stageId, session, history, lastMessage, classificacao, ragContext }) {
  const vars = session.variables || {};
  const map = stageMap(def);
  const st = map[stageId] || map[def.entry_stage] || (def.stages || [])[0] || {};
  const _gr = (def.globals && def.globals.guardrails) || [];
  const guardrails = Array.isArray(_gr) ? _gr : typeof _gr === 'string' ? [_gr] : [];
  const refCopy = (st.reference_copy || []).map((c) => renderTemplate(c, vars));
  const actions = st.actions || [];
  const obj = objectionInterrupt(def);
  const histText = history.map((m) => `[${m.direction === 'in' ? 'LEAD' : 'BOT'}] ${m.text}`).join('\n');
  const stageIds = (def.stages || []).map((s) => s.id).join(' | ');

  const ragSection = ragContext ? `\nMEMÓRIA DE LONGO PRAZO (recuperada por similaridade semântica):\n${ragContext}\n` : '';

  return `Você é um SDR consultivo da Totum no WhatsApp (voz humana, BR, mensagens curtas estilo WhatsApp).

OBJETIVO GERAL: ${def.objective || ''}

GUARDRAILS (obrigatórios):
${guardrails.map((g) => '- ' + g).join('\n')}

ESTÁGIO ATUAL: "${stageId}"
- META: ${st.goal || ''}
- COMO AGIR: ${renderTemplate(st.instruction || '', vars)}
${refCopy.length ? '- REFERÊNCIA DE FALA (adapte, não copie literal):\n' + refCopy.map((c) => '   • ' + c).join('\n') : ''}
${actions.length ? '- AÇÕES POSSÍVEIS NESTE ESTÁGIO: ' + actions.join(', ') : ''}
PRÓXIMO ESTÁGIO no trilho: ${st.next || '(terminal)'} . Estágios válidos: ${stageIds}.

OBJEÇÕES: se o lead levantar objeção real (${obj ? obj.categories.join(', ') : 'preço, tempo, já tem, não preciso, genérica'}), ACOLHA (nunca corrija), reintroduza como curiosidade, e devolva o campo "objecao" com a categoria. Preço: nunca revele valor, redirecione pra prévia/página.

DEMANDA DE INFORMAÇÃO: se o lead estiver pedindo explicações detalhadas do método, fazendo perguntas difíceis em sequência, tentando extrair detalhes pelo WhatsApp antes da reunião, ou insistindo em entender "como funciona"/"no que ajudam", devolva "intent": "info_demand". Não entregue o método detalhado por WhatsApp.

REGRA DE MENSAGEM ÚNICA: gere EXATAMENTE UMA mensagem no campo "reply". Nunca envie variantes ou alternativas da mesma ideia — apenas a melhor versão. O engine só envia a primeira mensagem da lista.

REGRAS DE AVANÇO: você PROPÕE o próximo estágio em "stage_proposto", mas só avance 1 passo (para "${st.next || stageId}") quando a condição for satisfeita: "${st.advance_when || ''}". Se não, mantenha "${stageId}". Nunca pule etapas. Leia a ÚLTIMA mensagem do lead e responda ao que ele disse; não repita pergunta já respondida.
${ragSection}
CONTEXTO:
VARIÁVEIS: ${JSON.stringify(vars)}
HISTÓRICO (antigo→novo):
${histText || '(sem histórico ainda)'}
ÚLTIMA MENSAGEM DO LEAD: ${lastMessage || ''}
${classificacao ? 'CLASSIFICAÇÃO PRÉVIA: ' + classificacao : ''}

Responda SOMENTE um JSON válido:
{
  "reply": ["msg curta única — nunca duas variantes da mesma ideia"],
  "stage_proposto": "${stageIds.split(' | ').join('|')}",
  "temperatura": "frio|morno|quente|fora_de_perfil",
  "score": 1,
  "send_preview": false,
  "booked": false,
  "precisa_humano": false,
  "done": false,
  "objecao": null,
  "intent": null
}`;
}

async function generate(prompt, kind = 'prod') {
  return llmProvider.generate(prompt, kind);
}

// ───────────────────── guarda de saída (produção) ─────────────────────
// Mensagem com placeholder não resolvido ou literal de demo NUNCA vai pro lead.
const DEMO_LITERALS = ['clínica exemplo', 'clinica exemplo', 'dr. exemplo', 'dr exemplo', 'clínica odontosorriso', 'clinica odontosorriso'];
function unsafeReplyReason(text, { checkDemo = true } = {}) {
  const t = String(text || '');
  if (/\{\{\s*[\w.-]+\s*\}\}/.test(t)) return 'placeholder não resolvido';
  if (checkDemo) {
    const low = t.toLowerCase();
    const hit = DEMO_LITERALS.find((d) => low.includes(d));
    if (hit) return `literal de demo "${hit}"`;
  }
  return null;
}

// ───────────────────── anti-repetição rígida ─────────────────────
// Repetição = igual (normalizado) a uma das últimas 3 mensagens do BOT,
// ou mesmas primeiras 8 palavras. Nunca mandar a mesma frase 2x.
function normalizeMsg(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
// (acima: normalize('NFD') separa acentos; a faixa U+0300–U+036F remove os diacríticos)
function isRepeatOfHistory(text, history = []) {
  const n = normalizeMsg(text);
  if (!n) return false;
  const nWords = n.split(' ');
  const nHead = nWords.slice(0, 8).join(' ');
  return history
    .filter((m) => m && m.direction === 'out')
    .slice(-3)
    .map((m) => normalizeMsg(m.text))
    .some((b) => b && (b === n || (nWords.length >= 8 && b.split(' ').slice(0, 8).join(' ') === nHead)));
}

// callBrain: contrato compatível com engine.js. flowOverride permite SHADOW sem ativar em prod.
async function callBrain({ session, history = [], lastMessage, classificacao = '', flowOverride = null, ragContext = null }) {
  const _kind = flowOverride ? 'sim' : 'prod'; // sim usa LLM_CHAIN_SIM, prod usa LLM_CHAIN_PROD

  let active = flowOverride;
  if (!active) { try { active = await getActiveFlow(); } catch { active = null; } }
  const def = (active && active.definition) || {};
  const isV2 = Array.isArray(def.stages) && def.stages.length > 0;

  // fallback: se o flow ativo não for v2 (sem stages), usa caminho legado mínimo
  if (!isV2) {
    const legacy = require('./brain.legacy.js');
    return legacy.callBrain({ session, history, lastMessage, classificacao });
  }

  const current = session.currentNodeId || session.stage || def.entry_stage || 'abertura';
  const prompt = buildV2Prompt({ def, stageId: current, session, history, lastMessage, classificacao, ragContext });

  let raw;
  try { raw = extractJson(await generate(prompt, _kind)); }
  catch (e) {
    return {
      reply: ['Já te respondo em instantes 😊'], stage: current, stage_proposto: current, stage_anterior: current,
      temperatura: 'morno', temperature: 'morno', score: session.score || 1,
      send_preview: false, booked: false, precisa_humano: true, done: false, objecao: null, intent: null,
    };
  }

  // Apenas variante A (índice 0): se o LLM retornar A+B juntos, descarta B e seguintes.
  const firstReply = (r) => (Array.isArray(r.reply) ? r.reply.map(String).filter(Boolean).slice(0, 1) : []);
  let reply = firstReply(raw);

  // anti-repetição rígida: 1 re-geração; se ainda repetir, suprime (nunca manda a mesma frase 2x)
  let suppressedRepeat = false;
  if (reply.length && isRepeatOfHistory(reply[0], history)) {
    let second = null;
    try {
      second = extractJson(await generate(
        prompt + '\n\nATENÇÃO: você JÁ ENVIOU essa mensagem nesta conversa. Reformule com outras palavras ou avance a conversa dentro das regras do estágio. NUNCA repita a mesma frase.',
        _kind,
      ));
    } catch { second = null; }
    const secondReply = second ? firstReply(second) : [];
    if (secondReply.length && !isRepeatOfHistory(secondReply[0], history)) {
      raw = second; reply = secondReply;
    } else {
      console.error('[brain] anti-repetição: reply idêntica às últimas mensagens do bot — suprimida, estágio mantido/decidido pelo motor');
      suppressedRepeat = true; reply = [];
    }
  }
  const proposed = raw.stage_proposto || raw.stage || current;
  const decision = validateTransition({ def, current, proposed, raw, session });
  const stage = decision.stage;
  const temperatura = decision.forceTemp || (allowedTemperatures.has(raw.temperatura) ? raw.temperatura : 'morno');
  const score = Math.max(1, Math.min(10, Number.parseInt(raw.score, 10) || session.score || 1));
  const { send_preview, booked } = authorizeActions(stage, raw);
  const done = Boolean(raw.done) || decision.done || booked || stage === 'encerrado';

  // guarda de saída: placeholder/demo bloqueia envio e escala pra humano.
  // No sim (session.id === 'sim') as variáveis demo são intencionais — só checa placeholder.
  let blocked = null;
  if (reply.length) {
    blocked = unsafeReplyReason(reply[0], { checkDemo: session.id !== 'sim' });
    if (blocked) console.error(`[brain] guarda de saída: reply bloqueada (${blocked}):`, reply[0]);
  }

  return {
    reply: blocked || suppressedRepeat ? [] : reply.length ? reply : ['(sem resposta gerada)'],
    stage,                       // AUTORITATIVO (engine persiste isto)
    stage_proposto: proposed,    // p/ shadow / auditoria
    stage_anterior: current,
    temperatura, temperature: temperatura, score,
    send_preview, booked,
    precisa_humano: Boolean(raw.precisa_humano) || Boolean(blocked),
    done,
    objecao: decision.flags.objecao,
    objecao_count: decision.flags.objecao_count,
    clamped: decision.flags.clamped,
    intent: raw.intent || null,
  };
}

module.exports = {
  callBrain,
  callGemini: (session, history, lastMessage) => callBrain({ session, history, lastMessage }),
  extractJson, renderTemplate, validateTransition, authorizeActions, buildV2Prompt, stageMap,
  unsafeReplyReason,
};
