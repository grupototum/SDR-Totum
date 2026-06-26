'use strict';
/**
 * script_translator.js — Totum Script Spec v1 ↔ node-graph JSON
 *
 * Mapping (Spec → node-graph):
 *   MSG  → { type:"message",    text, next }
 *   G    → { type:"wait_input", transitions:[{next, default:true, scoreHint?}] }
 *   RK   → wait_input com múltiplas transitions (ramos condicionais)
 *   AC   → { type:"action",     action, next }
 *   FIM  → { type:"end" }
 *   JMP  → { type:"message", text:"", next:"targetId" }  (salto limpo)
 *   VAL  → { type:"wait_input", transitions:[{next, default:true, validate:true}] }
 *   SUB  → { type:"action", action:"subflow:<id>", next }
 *
 * Schema de referência (extraído do sdr-demo):
 *   { id, name, entryNode, nodes: { [nodeId]: nodeObj } }
 *   — sem array "edges"; ligações via campo "next" ou "transitions[].next"
 */

const llmProvider = require('./llm_provider');

// ─── Schema de referência em texto para o prompt ─────────────────────────────
const SCHEMA_REFERENCE = `
SCHEMA DO NODE-GRAPH (formato exato):
{
  "id": "slug-do-flow",
  "name": "Nome Legível do Flow",
  "entryNode": "id_do_primeiro_nó",
  "nodes": {
    "msg01": { "type": "message", "text": "Texto {{VARIAVEL}}", "next": "wait01" },
    "wait01": { "type": "wait_input", "transitions": [{ "next": "msg02", "default": true }] },
    "wait_rk": { "type": "wait_input", "transitions": [
      { "next": "msg_sim",   "label": "Positivo",  "scoreHint": 2.0 },
      { "next": "msg_nao",   "label": "Negativo",  "scoreHint": -1.0 },
      { "next": "msg_outro", "label": "Fora/padrão", "default": true }
    ]},
    "act01": { "type": "action", "action": "enviar_previa", "next": "msg_pos_previa" },
    "end01": { "type": "end" }
  }
}

TIPOS DE NÓ VÁLIDOS:
- message    : { type, text, next, temperature? }          — envia texto
- wait_input : { type, transitions:[{next,default?,label?,scoreHint?,validate?}] }  — aguarda resposta
- action     : { type, action, next }                      — executa ação (enviar_previa / book / handoff / crm)
- end        : { type }                                    — encerra conversa

REGRAS:
- nodes é um objeto { nodeId: nodeObj }, NÃO um array.
- Cada nó tem um ID único (snake_case ou alfanumérico).
- Ligações via "next" (string) ou "transitions[].next" — NÃO existe array "edges" separado.
- Sempre deve existir exatamente um nó "end".
- Variáveis usam dupla chave: {{NOME_VARIAVEL}}.
`;

// ─── Prompt IMPORT (MD → node-graph) ─────────────────────────────────────────
function buildImportPrompt(scriptMd) {
  return `Você é um compilador de scripts de vendas. Converta o Totum Script abaixo para o node-graph JSON do SDR Engine.

${SCHEMA_REFERENCE}

MAPEAMENTO DE BLOCOS DO SCRIPT:
- MSG / mensagem numerada  → nó "message"
- G / [espera] / GATE      → nó "wait_input" (transitions default)
- RK / [ramo] / condicional → nó "wait_input" com múltiplas transitions (uma por ramo)
- AC / [ação]              → nó "action" (action: enviar_previa | book | handoff | crm)
- FIM / [fim]              → nó "end"
- JMP / [pula para X]      → nó "message" com text:"" e next:alvo
- VAL / [valida]           → nó "wait_input" com validate:true na transition default
- SUB / [subflow:id]       → nó "action" com action:"subflow:<id>"

INSTRUÇÕES:
1. Gere IDs de nós sequenciais (msg01, msg02, wait01, act01, end01…).
2. Preserve todas as variáveis {{NOME}} do script.
3. O campo "id" do flow deve ser slug do nome (kebab-case, sem acentos).
4. Se o script não tiver nome explícito, use "flow-importado".
5. Responda SOMENTE com JSON válido, sem texto extra, sem markdown, sem \`\`\`.

SCRIPT A CONVERTER:
${scriptMd}

JSON:`;
}

// ─── Prompt EXPORT (node-graph → MD) ─────────────────────────────────────────
function buildExportPrompt(flow) {
  return `Você é um descompilador de flows SDR. Converta o node-graph JSON abaixo para o Totum Script Spec v1 em Markdown.

FORMATO DO TOTUM SCRIPT SPEC v1:
\`\`\`
# Nome do Flow

## VARIÁVEIS
- NOME_VAR: descrição

## REGRAS / GUARDRAILS
(se presentes no flow)

## FLUXO

MSG01: Texto da mensagem {{VARIAVEL}}
G01: [espera resposta do lead]
  → MSG02 (padrão)
  → MSG_OBJECAO (se: condição negativa, scoreHint:-1)
MSG02: Continua...
AC01: [ação: enviar_previa]  → MSG_POS
FIM: [fim da conversa]
\`\`\`

INSTRUÇÕES:
1. Cada nó vira um bloco com seu ID e tipo no prefixo.
2. "message" → MSG<n>: texto
3. "wait_input" com 1 transition → G<n>: [espera] → PRÓXIMO
4. "wait_input" com N transitions → RK<n>: [ramo] com subentradas → DESTINO (condição)
5. "action" → AC<n>: [ação: <action>] → PRÓXIMO
6. "end" → FIM
7. Preserve variáveis {{NOME}}.
8. Responda SOMENTE com o Markdown do script, sem texto extra.

NODE-GRAPH JSON:
${JSON.stringify(flow, null, 2)}

SCRIPT:`;
}

// ─── Validação básica do node-graph ──────────────────────────────────────────
function validateFlow(flow) {
  const errors = [];
  if (!flow || typeof flow !== 'object') { errors.push('flow não é objeto'); return errors; }
  if (!flow.nodes || typeof flow.nodes !== 'object') errors.push('nodes ausente ou não-objeto');
  if (!flow.entryNode) errors.push('entryNode ausente');
  if (flow.entryNode && flow.nodes && !flow.nodes[flow.entryNode])
    errors.push(`entryNode "${flow.entryNode}" não existe em nodes`);

  const validTypes = new Set(['message','wait_input','action','end']);
  const nodes = flow.nodes || {};
  let hasEnd = false;

  for (const [id, node] of Object.entries(nodes)) {
    if (!node.type) { errors.push(`nó ${id}: sem type`); continue; }
    if (!validTypes.has(node.type)) errors.push(`nó ${id}: type inválido "${node.type}"`);
    if (node.type === 'end') hasEnd = true;
    if (node.type === 'message' && !node.text && node.text !== '')
      errors.push(`nó ${id} (message): sem text`);
    if (node.type === 'wait_input' && !Array.isArray(node.transitions))
      errors.push(`nó ${id} (wait_input): transitions deve ser array`);
  }
  if (!hasEnd) errors.push('nenhum nó "end" encontrado');
  return errors;
}

// ─── Extrai JSON da resposta LLM (tolerante a markdown) ──────────────────────
function extractJson(text) {
  if (!text) throw new Error('LLM retornou vazio');
  // remove blocos ```json ... ``` se presentes
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Nenhum JSON encontrado na resposta LLM');
  return JSON.parse(clean.slice(start, end + 1));
}

// ─── IMPORT: MD → node-graph ─────────────────────────────────────────────────
async function importScript(scriptMd) {
  const prompt = buildImportPrompt(scriptMd);

  async function attempt() {
    const raw = await llmProvider.generate(prompt, 'script');
    const flow = extractJson(raw);
    const errs = validateFlow(flow);
    if (errs.length > 0) throw new Error('Schema inválido: ' + errs.join('; '));
    return flow;
  }

  try {
    return await attempt();
  } catch (e1) {
    // retry 1x com contexto do erro
    const retryPrompt = buildImportPrompt(scriptMd) +
      `\n\nATENÇÃO: a tentativa anterior falhou com erro: "${e1.message}". Corrija e retorne SOMENTE JSON válido conforme o schema.\n\nJSON:`;
    try {
      const raw2 = await llmProvider.generate(retryPrompt, 'sim');
      const flow2 = extractJson(raw2);
      const errs2 = validateFlow(flow2);
      if (errs2.length > 0) throw new Error('Schema inválido após retry: ' + errs2.join('; '));
      return flow2;
    } catch (e2) {
      throw new Error(`importScript falhou após 2 tentativas. Última: ${e2.message}`);
    }
  }
}

// ─── EXPORT: node-graph → MD ─────────────────────────────────────────────────
async function exportScript(flow) {
  const errs = validateFlow(flow);
  if (errs.length > 0) throw new Error('Flow inválido para exportar: ' + errs.join('; '));

  const prompt = buildExportPrompt(flow);

  async function attempt() {
    const raw = await llmProvider.generate(prompt, 'script');
    if (!raw || raw.trim().length < 10) throw new Error('LLM retornou script vazio');
    return raw.trim();
  }

  try {
    return await attempt();
  } catch (e1) {
    // retry 1x
    try {
      const raw2 = await llmProvider.generate(prompt + '\n\n(Responda SOMENTE o Markdown, sem explicações)', 'sim');
      if (!raw2 || raw2.trim().length < 10) throw new Error('LLM retornou vazio no retry');
      return raw2.trim();
    } catch (e2) {
      throw new Error(`exportScript falhou após 2 tentativas. Última: ${e2.message}`);
    }
  }
}

module.exports = { importScript, exportScript, validateFlow };
