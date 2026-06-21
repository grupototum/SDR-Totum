/**
 * mock.ts — implementação local dos dados, sem rede.
 * Ativa quando VITE_API_BASE_URL está vazia.
 * Persona: Clínica Sorriso Perfeito, Foz do Iguaçu, Odontologia.
 */

import type {
  ApiClient,
  ConversationDetail,
  ConversationSummary,
  FlowSummary,
  Message,
  ReportSchema,
  ReportSummary,
  StartConversationPayload,
} from "./types";

const FLOW_ID = "odonto_sdr_v1";
const NOW = new Date().toISOString();

const mockMessages: Message[] = [
  {
    id: "m1",
    direction: "outbound",
    sender: "bot",
    text: "Vi vocês aqui nas avaliações de Odontologia na região. 187 avaliações. Aí é a Sorriso Perfeito, do Dr. Carlos?",
    ts: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    nodeId: "msg01",
  },
  {
    id: "m2",
    direction: "inbound",
    sender: "lead",
    text: "Sim, sou eu mesmo. O que é isso?",
    ts: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
  },
  {
    id: "m3",
    direction: "outbound",
    sender: "bot",
    text: "Estava pesquisando clínicas de Odontologia aqui em Foz do Iguaçu e a de vocês me chamou atenção.",
    ts: new Date(Date.now() - 1000 * 60 * 27).toISOString(),
    nodeId: "msg02",
  },
  {
    id: "m4",
    direction: "outbound",
    sender: "bot",
    text: "Vi um conteúdo recente de vocês sobre implante de zircônia. Bem diferente do que outras clínicas costumam postar.",
    ts: new Date(Date.now() - 1000 * 60 * 26).toISOString(),
    nodeId: "msg03",
  },
  {
    id: "m5",
    direction: "outbound",
    sender: "bot",
    text: "Vocês têm algum site ou página própria hoje?",
    ts: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    nodeId: "pk01",
  },
  {
    id: "m6",
    direction: "inbound",
    sender: "lead",
    text: "Sim, sorrisoperfeito.com.br",
    ts: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: "m7",
    direction: "outbound",
    sender: "human",
    text: "Ótimo! Estou avaliando agora...",
    ts: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
];

const mockReport: ReportSchema = {
  empresa: "Sorriso Perfeito",
  resultado: "followup",
  temperatura: "morno",
  score: 7,
  abriu_pela_observacao: true,
  gatilho_preview: false,
  agendou: false,
  objecoes: ["já tem agência", "preço"],
  resumo:
    "Lead é o decisor, tem site, engajou bem na abertura. Pausou antes do preview de prévia. Segue em followup.",
  transcript: mockMessages,
  proxima_acao: "Ligar em 48h ou enviar prévia por e-mail",
  onde_travou: "g09 — aguardando resposta",
};

const mockConversations: ConversationDetail[] = [
  {
    id: "conv-001",
    status: "aguardando",
    temperatura: "morno",
    lead: {
      empresa: "Sorriso Perfeito",
      numero: "5545999990001",
      nomeDono: "Dr. Carlos Mendes",
      variaveis: {
        ESPECIALIDADE: "Odontologia",
        CIDADE: "Foz do Iguaçu",
        QTD_AVALIACOES: "187",
        CONTEUDO_RECENTE: "implante de zircônia",
        tipo_clinica: "clinica_media",
      },
    },
    messages: mockMessages,
    report: null,
  },
  {
    id: "conv-002",
    status: "encerrada",
    temperatura: "quente",
    lead: {
      empresa: "OdontoVita Foz",
      numero: "5545999990002",
      nomeDono: "Dra. Ana Lima",
      variaveis: {
        ESPECIALIDADE: "Odontologia",
        CIDADE: "Foz do Iguaçu",
        QTD_AVALIACOES: "312",
        CONTEUDO_RECENTE: "ortodontia invisível",
        tipo_clinica: "premium",
      },
    },
    messages: [
      {
        id: "x1",
        direction: "outbound",
        sender: "bot",
        text: "Olá Dra. Ana! Vi vocês nas avaliações aqui em Foz.",
        ts: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        nodeId: "msg01",
      },
      {
        id: "x2",
        direction: "inbound",
        sender: "lead",
        text: "Oi! Sim, pode falar.",
        ts: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
      },
    ],
    report: {
      empresa: "OdontoVita Foz",
      resultado: "reuniao_marcada",
      temperatura: "quente",
      score: 9,
      abriu_pela_observacao: true,
      gatilho_preview: true,
      agendou: true,
      objecoes: [],
      resumo: "Decisora engajou imediatamente. Prévia aceita, reunião marcada para terça.",
      transcript: [],
      proxima_acao: "Reunião terça-feira 14h",
      onde_travou: "",
    },
  },
  {
    id: "conv-003",
    status: "ativa",
    temperatura: "frio",
    lead: {
      empresa: "SmilePlus",
      numero: "5545999990003",
      nomeDono: "Dr. Roberto Dias",
      variaveis: {
        ESPECIALIDADE: "Odontologia",
        CIDADE: "Cascavel",
        QTD_AVALIACOES: "45",
        CONTEUDO_RECENTE: "promoção de limpeza",
        tipo_clinica: "popular",
      },
    },
    messages: [
      {
        id: "y1",
        direction: "outbound",
        sender: "bot",
        text: "Vi vocês aqui nas avaliações de Odontologia em Cascavel.",
        ts: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        nodeId: "msg01",
      },
    ],
    report: null,
  },
];

let conversationStore = [...mockConversations];
let msgCounter = 100;

async function delay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms));
}

export const mockApi: ApiClient = {
  async getHealth() {
    await delay();
    return { status: "ok", version: "mock-1.0.0" };
  },

  async listFlows() {
    await delay();
    return [
      {
        id: FLOW_ID,
        name: "SDR Odonto v1.1.1",
        version: "1.1.1",
        niche: "odontologia",
        updatedAt: NOW,
      } satisfies FlowSummary,
    ];
  },

  async getFlow(_id) {
    await delay();
    // Dynamically import the flow JSON as passthrough
    const mod = await import("../../docs/flow_odonto_sdr_v1.json", {
      with: { type: "json" },
    });
    return mod.default as Record<string, unknown>;
  },

  async createFlow(_flow) {
    await delay();
    return { id: `flow-${Date.now()}` };
  },

  async updateFlow(id, _flow) {
    await delay();
    return { id, updatedAt: new Date().toISOString() };
  },

  async listConversations(status) {
    await delay();
    const list: ConversationSummary[] = conversationStore.map((c) => ({
      id: c.id,
      empresa: c.lead.empresa,
      numero: c.lead.numero,
      status: c.status,
      temperatura: c.temperatura,
      ondeTravou: c.report?.onde_travou,
      lastMessageAt: c.messages[c.messages.length - 1]?.ts ?? NOW,
    }));
    if (status) return list.filter((c) => c.status === status);
    return list;
  },

  async getConversation(id) {
    await delay();
    const conv = conversationStore.find((c) => c.id === id);
    if (!conv) throw new Error(`Conversa ${id} não encontrada`);
    return conv;
  },

  async sendMessage(id, text) {
    await delay();
    const conv = conversationStore.find((c) => c.id === id);
    if (!conv) throw new Error(`Conversa ${id} não encontrada`);
    const msgId = `msg-${++msgCounter}`;
    conv.messages.push({
      id: msgId,
      direction: "outbound",
      sender: "human",
      text,
      ts: new Date().toISOString(),
    });
    return { id: msgId };
  },

  async takeover(id) {
    await delay();
    const conv = conversationStore.find((c) => c.id === id);
    if (conv) conv.status = "aguardando";
    return { ok: true };
  },

  async resume(id) {
    await delay();
    const conv = conversationStore.find((c) => c.id === id);
    if (conv) conv.status = "ativa";
    return { ok: true };
  },

  async startConversation(payload: StartConversationPayload) {
    await delay(500);
    const convId = `conv-${Date.now()}`;
    const newConv: ConversationDetail = {
      id: convId,
      status: "ativa",
      temperatura: "frio",
      lead: {
        empresa: payload.variables.NOME_EMPRESA,
        numero: payload.target,
        nomeDono: payload.variables.NOME_DONO,
        variaveis: payload.variables,
      },
      messages: [],
      report: null,
    };
    conversationStore.push(newConv);
    return { conversationId: convId };
  },

  async listReports() {
    await delay();
    return conversationStore
      .filter((c) => c.report !== null)
      .map(
        (c) =>
          ({
            conversationId: c.id,
            empresa: c.lead.empresa,
            resultado: c.report!.resultado,
            temperatura: c.report!.temperatura,
            score: c.report!.score,
            agendou: c.report!.agendou,
            criadoEm: c.messages[c.messages.length - 1]?.ts ?? NOW,
          }) satisfies ReportSummary,
      );
  },

  async getReport(conversationId) {
    await delay();
    const conv = conversationStore.find((c) => c.id === conversationId);
    if (!conv?.report) throw new Error(`Relatório de ${conversationId} não encontrado`);
    return conv.report;
  },
};

// Standalone mock report for fallback
export { mockReport };
