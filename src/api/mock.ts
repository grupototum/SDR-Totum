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
  ResearchOrder,
  N8nWorkflow,
  N8nWorkflowSummary,
  SimTurnRequest,
} from "./types";
import { generateResearchPrompt } from "@/lib/research-prompt";
import { mockSimTurn } from "@/lib/sim-turn";
import { runBattery } from "@/lib/sim-harness";

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

const conversationStore = [...mockConversations];
let msgCounter = 100;

async function delay(ms = 300) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Research orders: persistência local (localStorage + fallback memória) ─────
// TODO(http): substituir por GET/POST /api/research-orders quando o endpoint existir.
const RESEARCH_KEY = "totum:research-orders";
let researchMem: ResearchOrder[] = [];

function readOrders(): ResearchOrder[] {
  if (typeof window === "undefined") return researchMem;
  try {
    const raw = window.localStorage.getItem(RESEARCH_KEY);
    return raw ? (JSON.parse(raw) as ResearchOrder[]) : [];
  } catch {
    return researchMem;
  }
}

function writeOrders(orders: ResearchOrder[]) {
  researchMem = orders;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RESEARCH_KEY, JSON.stringify(orders));
  } catch {
    /* quota/privacy — mantém em memória */
  }
}

// ── Flows: store em memória (seed lazy do odonto) ────────────────────────────
// lossless: guarda o envelope inteiro; `active` = flow publicado (roteiro do motor).
interface StoredFlow {
  id: string;
  name: string;
  envelope: Record<string, unknown>;
  active: boolean;
  updatedAt: string;
}
let flowsMem: StoredFlow[] | null = null;

async function ensureFlows(): Promise<StoredFlow[]> {
  if (flowsMem) return flowsMem;
  const mod = await import("../../docs/flow_odonto_sdr_v1.json");
  const env = mod.default as Record<string, unknown>;
  flowsMem = [
    {
      id: (env.flow_id as string) ?? FLOW_ID,
      name: "SDR Odonto v1.1.1",
      envelope: env,
      active: true,
      updatedAt: NOW,
    },
  ];
  return flowsMem;
}

function flowSummary(f: StoredFlow): FlowSummary {
  const e = f.envelope;
  return {
    id: f.id,
    name: f.name,
    version: (e.version as string) ?? "1.0",
    niche: (e.niche as string) ?? "",
    updatedAt: f.updatedAt,
    active: f.active,
  };
}

// ── N8N: workflows mock (sem rede; espelha o formato cru do n8n) ─────────────
const n8nWorkflows: N8nWorkflow[] = [
  {
    id: "wf-001",
    name: "Lead → CRM (Odonto)",
    active: true,
    nodes: [
      { id: "n1", name: "Webhook", type: "n8n-nodes-base.webhook", position: [240, 300] },
      { id: "n2", name: "Set", type: "n8n-nodes-base.set", position: [480, 300] },
    ],
    connections: { Webhook: { main: [[{ node: "Set", type: "main", index: 0 }]] } },
    settings: { executionOrder: "v1" },
  },
  {
    id: "wf-002",
    name: "Followup 48h",
    active: false,
    nodes: [{ id: "n1", name: "Cron", type: "n8n-nodes-base.cron", position: [240, 300] }],
    connections: {},
    settings: { executionOrder: "v1" },
  },
];

export const mockApi: ApiClient = {
  async getHealth() {
    await delay();
    return { status: "ok", version: "mock-1.0.0" };
  },

  async listFlows() {
    await delay();
    const flows = await ensureFlows();
    return flows.map(flowSummary);
  },

  async getFlow(id) {
    await delay();
    const flows = await ensureFlows();
    const f = flows.find((x) => x.id === id) ?? flows[0];
    if (!f) throw new Error(`Flow ${id} não encontrado`);
    return f.envelope;
  },

  async createFlow(flow) {
    await delay();
    const flows = await ensureFlows();
    const env = flow as Record<string, unknown>;
    const id = `flow-${Date.now()}`;
    flows.push({
      id,
      name: (env.flow_id as string) ?? "Novo flow",
      envelope: env,
      active: false,
      updatedAt: new Date().toISOString(),
    });
    return { id };
  },

  async updateFlow(id, flow) {
    await delay();
    const flows = await ensureFlows();
    const env = flow as Record<string, unknown>;
    const updatedAt = new Date().toISOString();
    const existing = flows.find((x) => x.id === id);
    if (existing) {
      existing.envelope = env;
      existing.name = (env.flow_id as string) ?? existing.name;
      existing.updatedAt = updatedAt;
    } else {
      flows.push({
        id,
        name: (env.flow_id as string) ?? id,
        envelope: env,
        active: false,
        updatedAt,
      });
    }
    return { id, updatedAt };
  },

  async publishFlow(id) {
    await delay();
    const flows = await ensureFlows();
    const target = flows.find((x) => x.id === id);
    if (!target) throw new Error(`Flow ${id} não encontrado`);
    const updatedAt = new Date().toISOString();
    // Só um flow ativo por vez: o publicado vira o roteiro do motor.
    for (const f of flows) f.active = f.id === id;
    target.updatedAt = updatedAt;
    return { id, active: true, updatedAt };
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

  async listResearchOrders() {
    await delay();
    return readOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getResearchOrder(id) {
    await delay();
    const order = readOrders().find((o) => o.id === id);
    if (!order) throw new Error(`Ordem ${id} não encontrada`);
    return order;
  },

  async createResearchOrder(input) {
    await delay();
    const order: ResearchOrder = {
      id: `ro-${Date.now()}`,
      name: input.name,
      status: "rascunho",
      createdAt: new Date().toISOString(),
      prompt: generateResearchPrompt(input.data),
      data: input.data,
    };
    writeOrders([order, ...readOrders()]);
    return order;
  },

  async listN8nWorkflows() {
    await delay();
    return n8nWorkflows.map(
      (w) =>
        ({
          id: String(w.id),
          name: String(w.name),
          active: Boolean(w.active),
        }) satisfies N8nWorkflowSummary,
    );
  },

  async getN8nWorkflow(id) {
    await delay();
    const wf = n8nWorkflows.find((w) => String(w.id) === id);
    if (!wf) throw new Error(`Workflow ${id} não encontrado`);
    return wf;
  },

  async updateN8nWorkflow(id, body) {
    await delay();
    const idx = n8nWorkflows.findIndex((w) => String(w.id) === id);
    if (idx === -1) throw new Error(`Workflow ${id} não encontrado`);
    // Round-trip lossless: preserva o resto, aplica o body recebido.
    n8nWorkflows[idx] = { ...n8nWorkflows[idx], ...body, id };
    return n8nWorkflows[idx];
  },

  async setN8nWorkflowActive(id, active) {
    await delay();
    const wf = n8nWorkflows.find((w) => String(w.id) === id);
    if (!wf) throw new Error(`Workflow ${id} não encontrado`);
    wf.active = active;
    return wf;
  },

  async simTurn(payload: SimTurnRequest) {
    await delay(400);
    return mockSimTurn(payload);
  },

  async getSimReport() {
    await delay();
    // Sem engine real: computa a MESMA métrica localmente e marca mock=true
    // (a decisão de GO só vale contra o engine real — o cockpit desqualifica isto).
    const mod = await import("../../docs/flow_odonto_stages_v2.json");
    const flow = mod.default as unknown as Record<string, unknown>;
    const summary = await runBattery(flow, async (req) => mockSimTurn(req));
    return {
      healthRate: summary.healthRate,
      healthy: summary.healthy,
      total: summary.total,
      guardrail_violations: 0,
      generatedAt: new Date().toISOString(),
      mock: true,
    };
  },
};

// Standalone mock report for fallback
export { mockReport };
