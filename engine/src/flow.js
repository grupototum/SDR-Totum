// Flow v2 (formato do builder em /builder do SDR-Totum): o roteiro vive no JSON, não no código.
// Editou no builder → exportou/salvou o JSON → o motor obedece. Portado do engine antigo:
// validateTransition (motor autoritativo) e authorizeActions — com o fix do avanço travado
// (baseline antigo dava 0% booked porque só permitia avançar 1 passo).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
let _cache = null;

export function loadFlow(path = process.env.FLOW_PATH || join(__dir, '..', 'flows', 'flow_odonto_v2.6.json')) {
  const p = isAbsolute(path) ? path : join(process.cwd(), path);
  const raw = JSON.parse(readFileSync(p, 'utf8'));
  const def = raw.definition || raw; // aceita {definition:{...}} (API /api/flows) ou o JSON puro
  if (!Array.isArray(def.stages) || !def.stages.length) throw new Error(`flow sem stages: ${p}`);
  return def;
}

export function getFlow() { return (_cache ??= loadFlow()); }
export function resetFlowCache() { _cache = null; }
/** Override em memória (usado pelo simulador do builder para rodar o flow do canvas, sem tocar no arquivo). */
export function setFlowOverride(def) { _cache = def; }

export const stageIds = (def) => def.stages.map(s => s.id);
export const stageMap = (def) => Object.fromEntries(def.stages.map((s, i) => [s.id, { ...s, __i: i }]));
export const entryStage = (def) => def.entry_stage || def.stages[0].id;
export const objectionInterrupt = (def) => (def.interrupts || []).find(i => i.id === 'objecao') || null;

// Variáveis do flow (UPPERCASE, padrão do builder) preenchidas com os dados do lead + env.
export function leadVars(lead, def = null) {
  const conc = String(lead.concorrentes || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const vars = {
    NOME_EMPRESA: lead.nome_empresa || '',
    NOME_DONO: lead.nome_dono || '',
    NOME_DECISOR: lead.nome_dono || '',
    ESPECIALIDADE: lead.especialidade || '',
    CIDADE: lead.cidade || '',
    QTD_AVALIACOES: lead.qtd_avaliacoes || '',
    CONTEUDO_RECENTE: lead.conteudo_recente || '',
    CONCORRENTE_1: conc[0] || '', CONCORRENTE_2: conc[1] || '', CONCORRENTE_3: conc[2] || '',
    NOTA_SEO: lead.nota_seo || '',
    TEM_SITE: lead.tem_site || '',
    NOME_SDR: process.env.NOME_SDR || 'Rael',
    LINK_AGENDA: process.env.LINK_AGENDA || '',
    LINK_LP: process.env.LINK_LP || 'https://lp.grupototum.com/',
    PRECO_MINIMO: process.env.PRECO_MINIMO || '',
  };
  // defaults declarados no flow (não sobrescrevem dado real do lead)
  for (const [k, v] of Object.entries(def?.variables || {})) if (!vars[k] && v) vars[k] = String(v);
  return vars;
}

// Substitui {{VAR}} quando existir valor; linha com placeholder não resolvido é descartada
// (o guardrail de saída ainda bloqueia qualquer {{...}} que o LLM tente escrever).
export function renderTemplate(text, vars = {}) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => {
    const v = vars[k] ?? vars[String(k).toUpperCase()];
    return v === undefined || v === null || v === '' ? m : String(v);
  });
}
export const renderCopy = (lines, vars) =>
  (lines || []).map(l => renderTemplate(l, vars)).filter(l => !/\{\{/.test(l));

/**
 * Decide o stage AUTORITATIVO a partir do proposto pelo LLM. O motor manda.
 * Diferença do engine antigo (fix do 0% booked): avanço PRA FRENTE no trilho é
 * permitido em qualquer quantidade de passos; regressão ou stage desconhecido = clamp.
 */
export function validateTransition({ def, current, proposed }) {
  const map = stageMap(def);
  const entry = entryStage(def);
  const curId = map[current] ? current : entry;
  const cur = map[curId];
  if (cur.terminal) return { stage: curId, done: true, clamped: false };
  const want = map[proposed] ? proposed : curId;
  if (want === curId) return { stage: curId, done: false, clamped: false };
  if (map[want].__i > cur.__i) return { stage: want, done: !!map[want].terminal, clamped: false }; // avanço
  return { stage: curId, done: false, clamped: true }; // regressão/desconhecido: motor manda
}

// Ações só valem no estágio certo (autoridade do motor, portado do engine antigo).
export function authorizeActions(stage, current, raw) {
  const inPreview = ['oferta_previa', 'previa'].includes(stage) || ['oferta_previa', 'previa'].includes(current);
  const inBooking = ['agendamento', 'encerrado', 'COMPLEX_REDIRECT'].includes(stage) || current === 'agendamento';
  return {
    send_preview: Boolean(raw.send_preview) && inPreview,
    booked: Boolean(raw.objetivo_atingido || raw.booked) && inBooking,
  };
}
