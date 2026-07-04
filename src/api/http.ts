/**
 * http.ts — implementação real via fetch.
 * Ativa quando VITE_API_BASE_URL está preenchida (use `/api/engine` = same-origin).
 *
 * SEGURANÇA: o cliente fala SÓ same-origin (`/api/engine/*`). O Bearer com a
 * SDR_API_KEY é injetado no servidor (src/server.ts, proxyEngine), nunca aqui.
 * NÃO referenciar SDR_API_KEY/Authorization/URL do motor neste arquivo (client).
 */

import type {
  ApiClient,
  ConversationDetail,
  ConversationSummary,
  FlowSummary,
  ReportSchema,
  ReportSummary,
  StartConversationPayload,
  ResearchOrder,
  OrderData,
  N8nWorkflow,
  N8nWorkflowSummary,
  SimTurnRequest,
  SimTurnResponse,
  SimReport,
  ValidateFlowResult,
  SimV3RunRequest,
  SimV3RunResponse,
  SimV3Status,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    // O motor responde {error: "msg"} (string); o proxy também. Alguns handlers
    // usam {error: {message}}. Aceitar ambos e carregar o status HTTP no erro,
    // pra diagnóstico visível (nada de cair no mock em silêncio).
    const bodyText = await res.text().catch(() => "");
    let message = res.statusText;
    try {
      const err = (JSON.parse(bodyText) as { error?: string | { message?: string } }).error;
      message = (typeof err === "string" ? err : err?.message) ?? message;
    } catch {
      /* corpo não-JSON: mantém statusText */
    }
    console.error(`[api] ${init?.method ?? "GET"} ${url} → ${res.status}`, bodyText.slice(0, 300));
    throw new Error(`HTTP ${res.status}: ${message}`);
  }
  return res.json() as Promise<T>;
}

/** Rotas do motor: prefixadas pela base (proxy /api/engine). */
function req<T>(path: string, init?: RequestInit): Promise<T> {
  return call<T>(`${BASE}${path}`, init);
}

/**
 * Rotas do N8N: SEMPRE same-origin em `/api/n8n` (proxy próprio), independentes
 * da base do motor. Não prefixar com BASE — senão cairiam no proxy da engine.
 */
function n8nReq<T>(path: string, init?: RequestInit): Promise<T> {
  return call<T>(`/api/n8n${path}`, init);
}

export const httpApi: ApiClient = {
  getHealth: () => req("/health"),

  // O motor embrulha as respostas ({flows}, {flow:{definition}}); o front (e o
  // mock) trabalham com o array/envelope puro — desembrulhar aqui, aceitando
  // os dois shapes.
  listFlows: async () => {
    const res = await req<FlowSummary[] | { flows?: FlowSummary[] }>("/api/flows");
    return Array.isArray(res) ? res : (res.flows ?? []);
  },
  getFlow: async (id) => {
    const res = await req<Record<string, unknown>>(`/api/flows/${id}`);
    const rec = (res.flow ?? res) as Record<string, unknown>;
    return (rec.definition ?? rec) as Record<string, unknown>;
  },
  // O motor exige {id, definition}; o front manda o envelope (flow_id, stages…).
  createFlow: (flow) =>
    req<{ id: string }>("/api/flows", {
      method: "POST",
      body: JSON.stringify({
        id: flow.flow_id ?? flow.id,
        name: flow.name,
        niche: flow.niche,
        version: flow.version,
        definition: flow,
      }),
    }),
  updateFlow: (id, flow) =>
    req<{ id: string; updatedAt: string }>(`/api/flows/${id}`, {
      method: "PUT",
      body: JSON.stringify(flow),
    }),
  publishFlow: (id) =>
    req<{ id: string; active: boolean; updatedAt: string }>(`/api/flows/${id}`, {
      method: "PUT",
      body: JSON.stringify({ active: true }),
    }),

  listConversations: (status) =>
    req<ConversationSummary[]>(`/api/conversations${status ? `?status=${status}` : ""}`),
  getConversation: (id) => req<ConversationDetail>(`/api/conversations/${id}`),
  sendMessage: (id, text) =>
    req<{ id: string }>(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  takeover: (id) => req<{ ok: boolean }>(`/api/conversations/${id}/takeover`, { method: "POST" }),
  resume: (id) => req<{ ok: boolean }>(`/api/conversations/${id}/resume`, { method: "POST" }),
  startConversation: (payload: StartConversationPayload) =>
    req<{ conversationId: string }>("/api/conversations/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listReports: () => req<ReportSummary[]>("/api/reports"),
  getReport: (id) => req<ReportSchema>(`/api/reports/${id}`),

  listResearchOrders: () => req<ResearchOrder[]>("/api/research-orders"),
  getResearchOrder: (id) => req<ResearchOrder>(`/api/research-orders/${id}`),
  createResearchOrder: (input: { name: string; data: OrderData }) =>
    req<ResearchOrder>("/api/research-orders", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // N8N bridge — same-origin /api/n8n/*; o X-N8N-API-KEY é injetado no servidor.
  listN8nWorkflows: async () => {
    // n8n v1: GET /workflows → { data: [...], nextCursor }
    const res = await n8nReq<{ data?: N8nWorkflowSummary[] } | N8nWorkflowSummary[]>("/workflows");
    const data = Array.isArray(res) ? res : (res.data ?? []);
    return data.map((w) => ({ id: String(w.id), name: w.name, active: Boolean(w.active) }));
  },
  getN8nWorkflow: (id) => n8nReq<N8nWorkflow>(`/workflows/${id}`),
  updateN8nWorkflow: (id, body) =>
    n8nReq<N8nWorkflow>(`/workflows/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  setN8nWorkflowActive: (id, active) =>
    n8nReq<N8nWorkflow>(`/workflows/${id}/${active ? "activate" : "deactivate"}`, {
      method: "POST",
    }),

  // Simulator — SEMPRE via proxy same-origin /api/engine (SDR_API_KEY nunca vai ao bundle).
  // Independente de VITE_API_BASE_URL: o proxy existe em server.ts e injeta o Bearer.
  // Adaptador: o motor fala {stage, lastMessage, variables} e devolve
  // {stage_anterior, stage_novo, …, variables}; o front fala
  // {currentStage, sessionState} e espera {stage_from, stage_to, flags, sessionState}.
  simTurn: async (payload: SimTurnRequest) => {
    const lastLead = [...payload.history].reverse().find((m) => m.role === "lead")?.text ?? "";
    const j = await call<Record<string, unknown>>("/api/engine/api/sim/turn", {
      method: "POST",
      body: JSON.stringify({
        flow: payload.flow,
        // sessionState = "variables" devolvidas pelo turno anterior (statelessness
        // do motor: __stage/__score/__objecao_count). Valores digitados vencem.
        variables: { ...(payload.sessionState ?? {}), ...payload.variables },
        history: payload.history,
        stage: payload.currentStage || undefined,
        lastMessage: lastLead,
      }),
    });
    const stageFrom = String(j.stage_anterior ?? payload.currentStage ?? "");
    return {
      reply: String(j.reply ?? ""),
      stage_from: stageFrom,
      stage_to: String(j.stage_novo ?? stageFrom),
      temperatura: String(j.temperatura ?? "morno"),
      score: Number(j.score) || 0,
      flags: {
        send_preview: Boolean(j.send_preview),
        booked: Boolean(j.booked),
        precisa_humano: Boolean(j.precisa_humano),
        done: Boolean(j.done),
      },
      objecao_count: Number(j.objecao_count) || 0,
      // clamped = o cérebro propôs transição ilegal e o motor travou → violação.
      guardrail_violation: Boolean(j.clamped),
      sessionState: (j.variables ?? {}) as Record<string, unknown>,
      raw: j,
    } satisfies SimTurnResponse;
  },
  // Report de GO — via proxy (não via BASE). Métrica oficial de decisão.
  // O motor devolve {flowId, ts, runs, health(0..1), personas[]} — adaptar.
  getSimReport: async () => {
    const j = await call<Record<string, unknown>>("/api/engine/api/sim/report");
    if (typeof j.healthRate === "number") return j as SimReport;
    const personas = Array.isArray(j.personas) ? j.personas : [];
    const health = Number(j.health) || 0;
    const healthRate = health > 1 ? health / 100 : health;
    return {
      ...j,
      healthRate,
      total: personas.length,
      healthy: Math.round(healthRate * personas.length),
      generatedAt: typeof j.ts === "string" ? j.ts : undefined,
    } satisfies SimReport;
  },

  // Script↔Flow — via proxy same-origin /api/engine (SDR_API_KEY nunca vai ao bundle).
  importScript: (scriptMd) =>
    call<{ flow: Record<string, unknown> }>("/api/engine/api/script/import", {
      method: "POST",
      body: JSON.stringify({ script_md: scriptMd }),
    }),

  validateFlow: (flow) =>
    call<ValidateFlowResult>("/api/engine/api/script/validate", {
      method: "POST",
      body: JSON.stringify({ flow }),
    }),

  // Simulador do builder — motor v3, proxy same-origin /api/engine-v3.
  runSimulationV3: (payload: SimV3RunRequest) =>
    call<SimV3RunResponse>("/api/engine-v3/api/sim/run", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSimV3Status: () => call<SimV3Status>("/api/engine-v3/api/sim/status"),
};
