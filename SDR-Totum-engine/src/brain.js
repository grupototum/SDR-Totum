const { getActiveFlow } = require('./store');
const llmProvider         = require('./llm_provider');

// (SDK Gemini removido daqui: a geração é 100% via llm_provider, que instancia o SDK
//  lazy por chamada — o construtor no top-level quebrava o load do módulo no Node 26)
const allowedTemperatures = new Set(['frio', 'morno', 'quente', 'fora_de_perfil']);

// Marcador que o engine injeta quando o gatilho de no-response dispara (fix 6).
const NO_RESPONSE_MARKER = '[SEM RESPOSTA DO LEAD NO PRAZO DO GATILHO]';
// Follow-up nunca pode fingir que o lead respondeu.
const FAKE_ACK_RE = /^\s*(entendi|perfeito|[óo]timo|que bom|legal|certo|show|combinado|beleza|boa)\b/i;

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
function authorizeActions(stage, raw, { falandoCom = 'desconhecido' } = {}) {
  const send_preview = Boolean(raw.send_preview) && (stage === 'previa' || stage === 'oferta_previa');
  const booked = Boolean(raw.booked) && (stage === 'agendamento');
  // BLOCO ÁUDIO é o caminho do gatekeeper (RK-03 → G-05 SIM) — nunca handoff (fix 4)
  const send_audio = Boolean(raw.send_audio) && falandoCom === 'gatekeeper' && stage !== 'encerrado';
  return { send_preview, booked, send_audio };
}

function buildV2Prompt({ def, stageId, session, history, lastMessage, classificacao, ragContext, nextLine = null, falandoCom = 'desconhecido' }) {
  const vars = session.variables || {};
  const map = stageMap(def);
  const gk = (def.globals && def.globals.gatekeeper) || {};
  const gkCopy = (gk.copy || []).map((c) => renderTemplate(c, vars));
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

REGRA DE OURO (inviolável): o improviso serve SOMENTE para conduzir o lead ao objetivo através do script — usando o script o máximo possível, da forma mais personalizada possível. O script NÃO é sugestão, é a espinha dorsal da conversa.

OBJETIVO GERAL: ${def.objective || ''}

GUARDRAILS (obrigatórios):
${guardrails.map((g) => '- ' + g).join('\n')}

ESTÁGIO ATUAL: "${stageId}"
- META: ${st.goal || ''}
- COMO AGIR: ${renderTemplate(st.instruction || '', vars)}
${refCopy.length ? '- SCRIPT DESTE ESTÁGIO (espinha dorsal — envie estas mensagens, NESTA ORDEM, personalizando o mínimo necessário):\n' + refCopy.map((c) => '   • ' + c).join('\n') : ''}
${nextLine ? `- AÇÃO PADRÃO DESTE TURNO: envie a próxima mensagem do script ainda não enviada: «${nextLine}». Só deixe de enviá-la se a última mensagem do lead exigir outra coisa — nesse caso responda CURTO (1 frase) e volte pro script no turno seguinte.` : refCopy.length ? '- O script deste estágio já foi enviado: conduza o lead à condição de avanço com 1 mensagem curta, sem inventar pitch nem observação nova.' : ''}
- PROIBIDO PITCH/VENDA antes da oferta da prévia: nada de "ajudamos clínicas...", "presença digital", falar de serviço, proposta ou preço.
${actions.length ? '- AÇÕES POSSÍVEIS NESTE ESTÁGIO: ' + actions.join(', ') : ''}
PRÓXIMO ESTÁGIO no trilho: ${st.next || '(terminal)'} . Estágios válidos: ${stageIds}.

INTERLOCUTOR ATUAL: ${falandoCom}. Classifique em todo turno no campo "falando_com": "decisor" (é quem decide), "gatekeeper" (secretária/atendente/recepção) ou "desconhecido".
GATEKEEPER: se quem responde NÃO é o decisor, siga o caminho do script pra atendente: NUNCA a chame pelo nome do decisor (trate por "você", sem vocativo de nome), registre o nome do decisor se aparecer, e ofereça mandar um ÁUDIO curto pra ela encaminhar ao decisor.${gkCopy.length ? '\n- COPY DO CAMINHO GATEKEEPER (use nesta ordem):\n' + gkCopy.map((c) => '   • ' + c).join('\n') : ''}
Quando a atendente ACEITAR receber o áudio, marque "send_audio": true — o motor envia os áudios e o resumo automaticamente e a conversa CONTINUA. Isso NÃO é caso de humano.

HUMANO: "precisa_humano": true SOMENTE se a conversa não puder continuar sem um humano (lead exige falar com pessoa, recusa dura e definitiva, ou forneceu contato direto do decisor pra um humano assumir). Oferecer áudio, falar com secretária ou contornar objeção comum NUNCA é precisa_humano. Nos pontos de [NOTIFICAR HUMANO] do script em que a conversa continua, use "notificar_humano": true e siga o fluxo.

OBJEÇÕES: se o lead levantar objeção real (${obj ? obj.categories.join(', ') : 'preço, tempo, já tem, não preciso, genérica'}), ACOLHA (nunca corrija), reintroduza como curiosidade, e devolva o campo "objecao" com a categoria. Preço: nunca revele valor, redirecione pra prévia/página.

DEMANDA DE INFORMAÇÃO: se o lead estiver pedindo explicações detalhadas do método, fazendo perguntas difíceis em sequência, tentando extrair detalhes pelo WhatsApp antes da reunião, ou insistindo em entender "como funciona"/"no que ajudam", devolva "intent": "info_demand". Não entregue o método detalhado por WhatsApp.

REGRA DE MENSAGEM ÚNICA: gere EXATAMENTE UMA mensagem no campo "reply". Nunca envie variantes ou alternativas da mesma ideia — apenas a melhor versão. O engine só envia a primeira mensagem da lista.

REGRAS DE AVANÇO: você PROPÕE o próximo estágio em "stage_proposto", mas só avance 1 passo (para "${st.next || stageId}") quando a condição for satisfeita: "${st.advance_when || ''}". Se não, mantenha "${stageId}". Nunca pule etapas. Leia a ÚLTIMA mensagem do lead e responda ao que ele disse; não repita pergunta já respondida.
${ragSection}
CONTEXTO:
VARIÁVEIS: ${JSON.stringify(vars)}
HISTÓRICO (antigo→novo):
${histText || '(sem histórico ainda)'}
${lastMessage === NO_RESPONSE_MARKER
    ? 'SITUAÇÃO: o lead NÃO respondeu à sua última mensagem (follow-up automático). Gere um NUDGE curto e neutro: retome a última pergunta que você fez, com outras palavras. PROIBIDO começar com "Entendi", "Perfeito", "Que bom" ou qualquer coisa que finja que o lead respondeu.'
    : 'ÚLTIMA MENSAGEM DO LEAD: ' + (lastMessage || '')}
${classificacao ? 'CLASSIFICAÇÃO PRÉVIA: ' + classificacao : ''}

Responda SOMENTE um JSON válido:
{
  "reply": ["msg curta única — nunca duas variantes da mesma ideia"],
  "stage_proposto": "${stageIds.split(' | ').join('|')}",
  "temperatura": "frio|morno|quente|fora_de_perfil",
  "score": 1,
  "send_preview": false,
  "booked": false,
  "send_audio": false,
  "falando_com": "decisor|gatekeeper|desconhecido",
  "precisa_humano": false,
  "notificar_humano": false,
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

// ───────────────── aderência ao script (fix 1 — teste real 04/07) ─────────────────
// O script é a ESPINHA DORSAL: a ação padrão de cada turno é enviar a próxima
// mensagem do reference_copy do estágio que ainda não foi enviada.
function nextScriptLine(refCopies = [], history = []) {
  const sent = history.filter((m) => m && m.direction === 'out').map((m) => normalizeMsg(m.text));
  for (const line of refCopies) {
    if (/\{\{/.test(line)) continue; // variável não preenchida: não usar (guardrail 10)
    const n = normalizeMsg(line);
    if (!n) continue;
    const head = n.split(' ').slice(0, 8).join(' ');
    const already = sent.some((s) => s === n || (n.split(' ').length >= 8 && s.split(' ').slice(0, 8).join(' ') === head));
    if (!already) return line;
  }
  return null;
}

// Pitch/venda antes da oferta da prévia é proibido (regras 2, 3 e 8 do script).
const PITCH_PATTERNS = [
  /ajud(?:o|amos)\s+(?:as?\s+)?cl[ií]nicas?/i,
  /presen[çc]a digital/i,
  /ser(?:em)?\s+encontrad[oa]s?\s+(?:online|no google|na internet)/i,
  /marketing digital/i,
  /nossa ag[eê]ncia/i,
  /nossos?\s+servi[çc]os?/i,
  /proposta comercial/i,
  /transforma[çc][ãa]o digital/i,
  /potencializar/i,
];
function prematurePitchReason(text, def, stageId) {
  const map = stageMap(def);
  const boundaryId = (def.globals && def.globals.send_preview_stage) || 'oferta_previa';
  const boundary = map[boundaryId];
  const cur = map[stageId];
  if (!boundary || !cur || cur.__i >= boundary.__i) return null;
  const hit = PITCH_PATTERNS.find((re) => re.test(String(text || '')));
  return hit ? `pitch precoce (proibido antes de ${boundaryId})` : null;
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
  const vars = session.variables || (session.variables = {});
  const map = stageMap(def);
  const st = map[current] || map[def.entry_stage] || (def.stages || [])[0] || {};
  const refCopy = (st.reference_copy || []).map((c) => renderTemplate(c, vars));
  const scriptLine = nextScriptLine(refCopy, history);
  const falandoComAtual = vars.__falando_com || 'desconhecido';
  const prompt = buildV2Prompt({ def, stageId: current, session, history, lastMessage, classificacao, ragContext, nextLine: scriptLine, falandoCom: falandoComAtual });

  let raw;
  try { raw = extractJson(await generate(prompt, _kind)); }
  catch (e) {
    return {
      reply: ['Já te respondo em instantes 😊'], stage: current, stage_proposto: current, stage_anterior: current,
      temperatura: 'morno', temperature: 'morno', score: session.score || 1,
      send_preview: false, booked: false, send_audio: false, falando_com: falandoComAtual,
      notificar_humano: false, precisa_humano: true, done: false, objecao: null, intent: null,
    };
  }

  // Apenas variante A (índice 0): se o LLM retornar A+B juntos, descarta B e seguintes.
  const firstReply = (r) => (Array.isArray(r.reply) ? r.reply.map(String).filter(Boolean).slice(0, 1) : []);
  let reply = firstReply(raw);

  // guarda unificada (anti-repetição rígida + anti-pitch precoce): 1 re-geração;
  // se ainda falhar, fallback = próxima MSG do script (determinístico); sem script, suprime.
  const replyProblem = (text) =>
    (isRepeatOfHistory(text, history) ? 'você JÁ ENVIOU essa mensagem nesta conversa' : null)
    || prematurePitchReason(text, def, current)
    || (lastMessage === NO_RESPONSE_MARKER && FAKE_ACK_RE.test(text)
      ? 'o lead NÃO respondeu — proibido fingir resposta ("Entendi...")' : null);
  let suppressedRepeat = false;
  const problem = reply.length ? replyProblem(reply[0]) : null;
  if (problem) {
    let second = null;
    try {
      second = extractJson(await generate(
        prompt + `\n\nATENÇÃO: sua resposta foi rejeitada (${problem}). Reformule dentro das regras: use a próxima mensagem do script do estágio, NUNCA repita frase já enviada e NUNCA faça pitch antes da oferta da prévia.`,
        _kind,
      ));
    } catch { second = null; }
    const secondReply = second ? firstReply(second) : [];
    if (secondReply.length && !replyProblem(secondReply[0])) {
      raw = second; reply = secondReply;
    } else if (scriptLine && !replyProblem(scriptLine)) {
      console.error(`[brain] reply rejeitada 2x (${problem}) — fallback pra próxima MSG do script`);
      reply = [scriptLine];
    } else {
      console.error(`[brain] reply rejeitada 2x (${problem}) — suprimida, estágio mantido/decidido pelo motor`);
      suppressedRepeat = true; reply = [];
    }
  }
  const proposed = raw.stage_proposto || raw.stage || current;
  const decision = validateTransition({ def, current, proposed, raw, session });
  const stage = decision.stage;
  const temperatura = decision.forceTemp || (allowedTemperatures.has(raw.temperatura) ? raw.temperatura : 'morno');
  const score = Math.max(1, Math.min(10, Number.parseInt(raw.score, 10) || session.score || 1));

  // interlocutor: persiste na sessão (fix 5 — nunca chamar gatekeeper pelo nome do decisor)
  const falandoComRaw = String(raw.falando_com || '').toLowerCase();
  const falandoCom = ['decisor', 'gatekeeper', 'desconhecido'].includes(falandoComRaw) ? falandoComRaw : falandoComAtual;
  if (falandoCom !== 'desconhecido') vars.__falando_com = falandoCom;

  const { send_preview, booked, send_audio } = authorizeActions(stage, raw, { falandoCom });
  const done = Boolean(raw.done) || decision.done || booked || stage === 'encerrado';

  // guarda de saída: placeholder/demo bloqueia envio e escala pra humano.
  // No sim (session.id === 'sim') as variáveis demo são intencionais — só checa placeholder.
  let blocked = null;
  if (reply.length) {
    blocked = unsafeReplyReason(reply[0], { checkDemo: session.id !== 'sim' });
    if (blocked) console.error(`[brain] guarda de saída: reply bloqueada (${blocked}):`, reply[0]);
  }

  // notificar ≠ parar (fix 4): oferta/aceite de áudio segue o fluxo — nunca handoff.
  let precisa_humano = Boolean(raw.precisa_humano) || Boolean(blocked);
  const notificar_humano = Boolean(raw.notificar_humano) || (precisa_humano && send_audio);
  if (send_audio) precisa_humano = false;

  return {
    reply: blocked || suppressedRepeat ? [] : reply.length ? reply : ['(sem resposta gerada)'],
    stage,                       // AUTORITATIVO (engine persiste isto)
    stage_proposto: proposed,    // p/ shadow / auditoria
    stage_anterior: current,
    temperatura, temperature: temperatura, score,
    send_preview, booked, send_audio,
    falando_com: falandoCom,
    notificar_humano,
    precisa_humano,
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
  unsafeReplyReason, nextScriptLine, prematurePitchReason,
  NO_RESPONSE_MARKER,
};
