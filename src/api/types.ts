// Shared API types matching API_CONTRACT.md

export interface FlowSummary {
  id: string;
  name: string;
  version: string;
  niche: string;
  updatedAt: string;
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

export interface ApiClient {
  // Health
  getHealth(): Promise<{ status: string; version: string }>;

  // Flows
  listFlows(): Promise<FlowSummary[]>;
  getFlow(id: string): Promise<Record<string, unknown>>;
  createFlow(flow: Record<string, unknown>): Promise<{ id: string }>;
  updateFlow(id: string, flow: Record<string, unknown>): Promise<{ id: string; updatedAt: string }>;

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
}
