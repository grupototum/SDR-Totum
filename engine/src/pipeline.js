// Orquestra: inbound salvo -> cérebro -> guardrails -> envio -> estado.
import { STATUS, addMessage, getHistory, getSentTexts, setLeadState, getLeadByPhone } from './db.js';
import { think } from './brain.js';
import { validateOutbound } from './guardrails.js';
import { getFlow, validateTransition, authorizeActions, leadVars, renderTemplate } from './flow.js';

/**
 * BLOCO ÁUDIO (portado do engine antigo): gatekeeper aceitou → envia os áudios NA ORDEM
 * e depois o resumo em texto como fallback. Fontes: def.globals.audio_block.{files,summary};
 * files pode vir do env AUDIO_BLOCK_URLS (URLs separadas por vírgula).
 * Retorna os textos registráveis no histórico (labels dos áudios + resumo enviado).
 */
export async function sendAudioBlock(def, lead, transport, log = console) {
  const block = def.globals?.audio_block || {};
  const files = Array.isArray(block.files) && block.files.length
    ? block.files
    : String(process.env.AUDIO_BLOCK_URLS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!files.length) log.warn?.('[audio-block] sem arquivos (globals.audio_block.files ou AUDIO_BLOCK_URLS) — enviando só o resumo');

  const registered = [];
  for (const [i, audio] of files.entries()) {
    await transport.sendAudio(lead.whatsapp, audio);
    registered.push(`[áudio ${i + 1}/${files.length}]`);
  }
  const vars = leadVars(lead, def);
  const summary = Array.isArray(block.summary) ? block.summary : block.summary ? [block.summary] : [];
  for (const raw of summary) {
    // guardrail: linha com variável não preenchida não vai pro lead
    const text = renderTemplate(raw, vars).split('\n').filter(l => !/\{\{/.test(l)).join('\n').trim();
    if (!text) continue;
    await transport.sendText(lead.whatsapp, text);
    registered.push(text);
  }
  return registered;
}

/**
 * Gera e envia a próxima resposta para um lead com mensagem(ns) pendente(s).
 * Retorna { sent, state, reason } — sent=false quando guardrail travar (vira precisa_humano).
 */
export async function respondToLead(db, transport, lead, log = console) {
  const fresh = getLeadByPhone(db, lead.whatsapp);
  if (!fresh || fresh.status !== STATUS.EM_CONVERSA) {
    return { sent: false, reason: `status=${fresh?.status}` };
  }
  const history = getHistory(db, fresh.id);
  const sentTexts = getSentTexts(db, fresh.id);

  let out = await think(fresh, history, { sentTexts });
  let check = validateOutbound(out.mensagem, fresh, sentTexts);

  if (!check.ok && (check.reason === 'repeticao' || check.reason === 'mensagem_vazia')) {
    log.warn?.(`[guardrail] ${check.reason} p/ ${fresh.whatsapp}, pedindo reformulação`);
    out = await think(fresh, history, {
      sentTexts,
      retryNote: 'Sua última tentativa repetiu uma frase já enviada (ou veio vazia). Reformule com OUTRAS palavras, mesma intenção.',
    });
    check = validateOutbound(out.mensagem, fresh, sentTexts);
  }

  // Conversa continua => a mensagem PRECISA terminar induzindo resposta (pergunta/CTA).
  const conversaSegue = !out.objetivo_atingido && !out.precisa_humano && out.stage !== 'encerrado';
  if (check.ok && conversaSegue && !out.mensagem.includes('?')) {
    log.warn?.(`[guardrail] sem pergunta p/ ${fresh.whatsapp}, pedindo gancho`);
    const retry = await think(fresh, history, {
      sentTexts,
      retryNote: 'Sua última tentativa NÃO terminava com pergunta. Reescreva a mesma mensagem terminando com UMA pergunta curta que induza o lead a responder (o próximo passo do fluxo).',
    });
    const retryCheck = validateOutbound(retry.mensagem, fresh, sentTexts);
    if (retryCheck.ok && retry.mensagem.includes('?')) { out = retry; check = retryCheck; }
  }

  if (!check.ok) {
    // Placeholder/nome inventado/repetição persistente: NUNCA envia. Passa pro humano.
    setLeadState(db, fresh.id, { status: STATUS.HUMANO, abort_reason: `guardrail:${check.reason}` });
    log.error?.(`[guardrail] BLOQUEADO (${check.reason}) lead ${fresh.whatsapp}; status=humano`);
    return { sent: false, reason: check.reason };
  }

  await transport.sendText(fresh.whatsapp, out.mensagem);
  addMessage(db, fresh.id, 'out', out.mensagem);

  // Autoridade do motor (portado do engine antigo): o LLM PROPÕE o stage; o flow decide.
  const def = getFlow();
  const t = validateTransition({ def, current: fresh.stage, proposed: out.stage });
  const acts = authorizeActions(t.stage, fresh.stage, out);
  if (t.clamped) log.warn?.(`[flow] transição ilegal ${fresh.stage}→${out.stage} clampada p/ ${t.stage}`);

  // BLOCO ÁUDIO: aceite de áudio pelo gatekeeper NUNCA é handoff — notifica e o fluxo segue.
  if (acts.send_audio) {
    if (out.precisa_humano) log.info?.(`[notificar] humano avisado, fluxo segue (gatekeeper aceitou áudio) ${fresh.whatsapp}`);
    out.precisa_humano = false;
    try {
      for (const text of await sendAudioBlock(def, fresh, transport, log)) {
        addMessage(db, fresh.id, 'out', text);
      }
    } catch (e) {
      log.error?.(`[audio-block] falha no envio p/ ${fresh.whatsapp}: ${e.message}`);
    }
  }

  let status = STATUS.EM_CONVERSA;
  if (acts.booked) status = STATUS.GANHO;
  else if (out.precisa_humano) status = STATUS.HUMANO;
  else if (t.done || t.stage === 'encerrado') status = STATUS.ENCERRADO;
  setLeadState(db, fresh.id, { status, stage: t.stage, temperatura: out.temperatura });

  return { sent: true, state: { ...out, stage: t.stage }, status };
}
