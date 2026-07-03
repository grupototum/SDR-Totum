/**
 * flow-v2.ts — schema STAGE-LEVEL (flow_odonto_stages_v2.json), formato primário.
 *
 * ESTRATÉGIA LOSSLESS:
 *   O modelo de trabalho É o próprio objeto v2 (mantido inteiro no store). Os
 *   tipos têm index signatures (`[k: string]: unknown`) para preservar QUALQUER
 *   campo desconhecido. Import = JSON.parse; export = JSON.stringify do objeto.
 *   Nenhuma transformação é aplicada → round-trip sem edição é deep-equal à
 *   origem. Edições mexem só nos campos alvo (merge imutável), preservando o
 *   resto. Compat de leitura do v1 (181 nós) é só para visualização do legado.
 */

// ─── Tipos v2 (1:1 com o schema) ─────────────────────────────────────────────

export interface V2Humanization {
  typing_wpm: number;
  reading_wpm: number;
  typing_indicator: string;
  max_consecutive: number;
  quiet_hours: string[];
  timezone: string;
  [k: string]: unknown;
}

export interface V2ModelDefaults {
  generator: string;
  classifier: string;
  [k: string]: unknown;
}

export interface V2Globals {
  humanization: V2Humanization;
  model_defaults: V2ModelDefaults;
  guardrails: string[];
  [k: string]: unknown;
}

export interface V2Stage {
  id: string;
  goal?: string;
  instruction?: string;
  reference_copy?: string[];
  /** Guardrails por estágio (opcional no schema; preservado se presente). */
  guardrails?: string[];
  actions?: string[];
  advance_when?: string;
  next?: string | null;
  terminal?: boolean;
  report?: string;
  [k: string]: unknown;
}

export interface V2InterruptOnExceed {
  goto?: string;
  set?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface V2Interrupt {
  id: string;
  trigger?: string;
  handler_instruction?: string;
  categories?: string[];
  max_iterations?: number;
  on_exceed?: V2InterruptOnExceed;
  return?: string;
  [k: string]: unknown;
}

export interface V2ReportSchema {
  fields: string[];
  [k: string]: unknown;
}

export interface FlowV2 {
  flow_id: string;
  name: string;
  version: string;
  source?: string;
  niche?: string;
  channel?: string;
  objective?: string;
  required_variables?: string[];
  runtime_variables?: string[];
  /** mapa nome→valor (formato usado pelo motor v3, engine/flows/*.json). */
  variables?: Record<string, string>;
  /** descrições de placeholder custom, criadas via UI (não faz parte do schema do motor). */
  variable_descriptions?: Record<string, string>;
  meta?: { authoring_mode?: "copilot" | "flow_builder"; [k: string]: unknown };
  globals: V2Globals;
  entry_stage: string;
  stages: V2Stage[];
  interrupts?: V2Interrupt[];
  report_schema?: V2ReportSchema;
  [k: string]: unknown;
}

// ─── Variáveis / placeholders ─────────────────────────────────────────────────

const PLACEHOLDER_RE = /\{\{?([A-Z][A-Z0-9_]*)\}?\}/g;

/** Extrai nomes de placeholder ({{VAR}} ou {VAR}) usados no texto do estágio. */
export function extractPlaceholders(stage: V2Stage): string[] {
  const text = [stage.goal, stage.instruction, ...(stage.reference_copy ?? [])]
    .filter(Boolean)
    .join("\n");
  const found = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER_RE)) found.add(m[1]);
  return [...found];
}

/** Nomes de variável já registrados no flow (variables map + required/runtime arrays). */
export function registeredVariableNames(flow: FlowV2): Set<string> {
  const names = new Set<string>();
  const varsObj = flow.variables;
  if (varsObj && typeof varsObj === "object") {
    for (const k of Object.keys(varsObj as Record<string, unknown>)) names.add(k);
  }
  for (const k of flow.required_variables ?? []) names.add(k);
  for (const k of flow.runtime_variables ?? []) names.add(k);
  return names;
}

/** Estágios (exceto entry_stage) sem nenhuma transição de outro estágio apontando pra eles. */
export function findOrphanStageIds(flow: FlowV2): Set<string> {
  const incoming = new Set(flow.stages.map((s) => s.next).filter((n): n is string => !!n));
  const orphans = new Set<string>();
  for (const s of flow.stages) {
    if (s.id !== flow.entry_stage && !incoming.has(s.id)) orphans.add(s.id);
  }
  return orphans;
}

// ─── Detecção de formato ─────────────────────────────────────────────────────

export type FlowFormat = "v2" | "v1" | "unknown";

export function detectFormat(obj: unknown): FlowFormat {
  if (!obj || typeof obj !== "object") return "unknown";
  const o = obj as Record<string, unknown>;
  if (Array.isArray(o.stages) && typeof o.entry_stage === "string") return "v2";
  if (Array.isArray(o.nodes)) return "v1";
  return "unknown";
}

export function isFlowV2(obj: unknown): obj is FlowV2 {
  return detectFormat(obj) === "v2";
}

// ─── Import / Export (lossless) ──────────────────────────────────────────────

export function parseFlowV2(json: string): FlowV2 {
  const obj = JSON.parse(json) as unknown;
  if (!isFlowV2(obj)) {
    throw new Error("JSON não é um flow v2 (faltam `stages` / `entry_stage`).");
  }
  return obj;
}

/** Serializa o flow v2 (2 espaços, igual ao arquivo de origem). */
export function serializeFlowV2(flow: FlowV2): string {
  return JSON.stringify(flow, null, 2);
}

// ─── Leitura do legado v1 (somente para visualização) ────────────────────────

export interface V1LegacyNodeSummary {
  id: string;
  type: string;
  label: string;
}

export interface V1LegacySummary {
  flowId: string;
  version: string;
  nodeCount: number;
  entry: string;
  nodes: V1LegacyNodeSummary[];
  raw: Record<string, unknown>;
}

/** Resume um flow v1 (181 nós) para visualização read-only. Não converte p/ v2. */
export function summarizeV1(json: string): V1LegacySummary {
  const o = JSON.parse(json) as Record<string, unknown>;
  if (detectFormat(o) !== "v1") throw new Error("JSON não é um flow v1 (legado).");
  const nodes = (o.nodes as Record<string, unknown>[]) ?? [];
  return {
    flowId: String(o.flow_id ?? "—"),
    version: String(o.version ?? "1.0"),
    nodeCount: nodes.length,
    entry: String(o.entry ?? ""),
    nodes: nodes.map((n) => ({
      id: String(n.id ?? ""),
      type: String(n.type ?? n.kind ?? "—"),
      label: String(n.label ?? n.title ?? n.name ?? n.id ?? ""),
    })),
    raw: o,
  };
}
