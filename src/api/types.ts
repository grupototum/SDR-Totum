// Shared API types matching API_CONTRACT.md

export interface FlowSummary {
  id: string;
  name: string;
  version: string;
  niche: string;
  updatedAt: string;
  /** Flow publicado = roteiro que o cérebro do motor usa. Só um fica ativo. */
  active?: boolean;
}

export interface ConversationSummary {
  id: string;
  empresa: string;
  numero: string;
  status: "ativa" | "aguardando" | "encerrada";
  temperatura: "frio" | "morno" | "quente" | "fora_de_perfil";
  ondeTravou?: string;
  lastMessageAt: string;
}

export interface Message {
  id: string;
  direction: "inbound" | "outbound";
  sender: "bot" | "human" | "lead";
  text: string;
  ts: string;
  nodeId?: string;
}

export interface ReportSchema {
  empresa: string;
  resultado: "reuniao_marcada" | "rejeitado" | "followup";
  temperatura: "frio" | "morno" | "quente" | "fora_de_perfil";
  score: number;
  abriu_pela_observacao: boolean;
  gatilho_preview: boolean;
  agendou: boolean;
  objecoes: string[];
  resumo: string;
  transcript: Message[];
  proxima_acao: string;
  onde_travou: string;
}

export interface ConversationDetail {
  id: string;
  status: "ativa" | "aguardando" | "encerrada";
  temperatura: "frio" | "morno" | "quente" | "fora_de_perfil";
  lead: {
    empresa: string;
    numero: string;
    nomeDono: string;
    variaveis: Record<string, string>;
  };
  messages: Message[];
  report: ReportSchema | null;
}

export interface ReportSummary {
  conversationId: string;
  empresa: string;
  resultado: ReportSchema["resultado"];
  temperatura: ReportSchema["temperatura"];
  score: number;
  agendou: boolean;
  criadoEm: string;
}

export interface StartConversationPayload {
  flowId: string;
  target: string;
  variables: {
    NOME_EMPRESA: string;
    NOME_DONO: string;
    ESPECIALIDADE: string;
    CIDADE: string;
    QTD_AVALIACOES: string;
    CONTEUDO_RECENTE: string;
    CONCORRENTE_1: string;
    CONCORRENTE_2: string;
    CONCORRENTE_3: string;
    tipo_clinica: string;
    [key: string]: string;
  };
}

// ── Research orders (página Pesquisa) ────────────────────────────────────────

export interface ResearchGeography {
  uf: string;
  cities: string[];
}

/** Configuração de uma ordem de pesquisa de lote (montada no wizard). */
export interface OrderData {
  // P1 — Nicho & ICP
  niche: string;
  icpDescription: string;
  naturalFit: string;
  upsellContext: string;
  // P2 — Geografia
  geography: ResearchGeography[];
  // P3 — Gate ICP + Exclusões
  minReviews: number;
  minRating: number;
  requireWhatsapp: boolean;
  instagramActiveDays: number;
  nonIndividualOnly: boolean;
  exclusions: string[];
  // P4 — Tipos & Ângulos
  opportunityTypes: string[];
  angles: string[];
  // P5 — Campos de saída desejados (keys do schema FASE 6)
  outputFields: string[];
}

export interface ResearchOrder {
  id: string;
  name: string;
  status: "rascunho" | "pronta" | "em_execucao" | "concluida";
  createdAt: string;
  /** Snapshot do prompt gerado no momento do salvamento. */
  prompt: string;
  data: OrderData;
}

// ── Simulator (testar um flow SEM WhatsApp via POST /api/sim/turn) ───────────

export interface SimFlags {
  send_preview: boolean;
  booked: boolean;
  precisa_humano: boolean;
  done: boolean;
}

export interface SimMessage {
  role: "lead" | "sdr";
  text: string;
}

export interface SimTurnRequest {
  /** Envelope do flow (v2 estágios ou v1 legado). */
  flow: Record<string, unknown>;
  variables: Record<string, string>;
  /** Histórico acumulado (lead/sdr alternados). */
  history: SimMessage[];
  /** Estágio atual (stage_to do último turno, ou entry_stage). */
  currentStage: string;
  /** Estado de sessão encadeado entre turnos (objecao_count, etc.). */
  sessionState?: Record<string, unknown>;
}

export interface SimTurnResponse {
  reply: string;
  stage_from: string;
  stage_to: string;
  temperatura: string;
  score: number;
  flags: SimFlags;
  /** Contagem de objeções na sessão (loop de interrupção). */
  objecao_count: number;
  /** True se o turno violou um guard-rail (usado na métrica de saúde). */
  guardrail_violation: boolean;
  /** Estado de sessão para alimentar o próximo turno. */
  sessionState: Record<string, unknown>;
  /** JSON cru do turno (para o painel lateral). */
  raw: Record<string, unknown>;
}

/**
 * Report de saúde da bateria (GET /api/sim/report) — métrica de decisão de GO.
 * IMPORTANTE: a decisão de GO só vale contra o engine REAL. Quando `mock=true`
 * o cockpit mostra mas marca como "não vale p/ GO".
 */
export interface SimReport {
  /** 0..1 — % de personas que fecham (booked) SEM violar guard-rail. */
  healthRate: number;
  healthy: number;
  total: number;
  guardrail_violations?: number;
  generatedAt?: string;
  /** True se o report veio do mock (não vale como baseline de GO). */
  mock?: boolean;
  [k: string]: unknown;
}

// ── N8N bridge (same-origin /api/n8n → proxy injeta X-N8N-API-KEY) ────────────

/** Item da lista de workflows do n8n (GET /workflows → { data: [...] }). */
export interface N8nWorkflowSummary {
  id: string;
  name: string;
  active: boolean;
}

/** Workflow completo do n8n (JSON cru: nodes, connections, settings, …). */
export type N8nWorkflow = Record<string, unknown>;

export interface ApiClient {
  // Health
  getHealth(): Promise<{ status: string; version: string }>;

  // Flows
  listFlows(): Promise<FlowSummary[]>;
  getFlow(id: string): Promise<Record<string, unknown>>;
  createFlow(flow: Record<string, unknown>): Promise<{ id: string }>;
  updateFlow(id: string, flow: Record<string, unknown>): Promise<{ id: string; updatedAt: string }>;
  /** Publica o flow (PUT /api/flows/:id active=true) — vira o roteiro do motor. */
  publishFlow(id: string): Promise<{ id: string; active: boolean; updatedAt: string }>;

  // Conversations
  listConversations(status?: string): Promise<ConversationSummary[]>;
  getConversation(id: string): Promise<ConversationDetail>;
  sendMessage(id: string, text: string): Promise<{ id: string }>;
  takeover(id: string): Promise<{ ok: boolean }>;
  resume(id: string): Promise<{ ok: boolean }>;
  startConversation(payload: StartConversationPayload): Promise<{ conversationId: string }>;

  // Reports
  listReports(): Promise<ReportSummary[]>;
  getReport(conversationId: string): Promise<ReportSchema>;

  // Research orders
  listResearchOrders(): Promise<ResearchOrder[]>;
  getResearchOrder(id: string): Promise<ResearchOrder>;
  createResearchOrder(input: { name: string; data: OrderData }): Promise<ResearchOrder>;

  // N8N bridge (same-origin; a key vive só no servidor)
  listN8nWorkflows(): Promise<N8nWorkflowSummary[]>;
  getN8nWorkflow(id: string): Promise<N8nWorkflow>;
  /** PUT /workflows/:id — round-trip lossless (envie o workflow inteiro). */
  updateN8nWorkflow(id: string, body: N8nWorkflow): Promise<N8nWorkflow>;
  /**
   * Liga/desliga via POST /workflows/:id/(de)activate. No n8n, `active` é
   * read-only no PUT — só muda por estes endpoints dedicados.
   */
  setN8nWorkflowActive(id: string, active: boolean): Promise<N8nWorkflow>;

  // Simulator
  simTurn(payload: SimTurnRequest): Promise<SimTurnResponse>;
  /** Report de saúde da bateria (GET /api/sim/report) — fonte da métrica de GO. */
  getSimReport(): Promise<SimReport>;

  /**
   * Traduz um roteiro Markdown para flow node-graph (POST /api/script/import via proxy).
   * A SDR_API_KEY é injetada no servidor — nunca exposta ao bundle.
   */
  importScript(scriptMd: string): Promise<{ flow: Record<string, unknown> }>;

  /**
   * Valida o flow JSON contra as regras do motor (POST /api/script/validate via proxy).
   * Retorna { valid: true } ou { valid: false, errors: string[] }.
   * A SDR_API_KEY é injetada no servidor — nunca exposta ao bundle.
   */
  validateFlow(flow: Record<string, unknown>): Promise<ValidateFlowResult>;
}

export interface ValidateFlowResult {
  valid: boolean;
  errors?: string[];
}
