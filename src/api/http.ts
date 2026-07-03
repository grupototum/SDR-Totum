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
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? res.statusText);
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

  listFlows: () => req<FlowSummary[]>("/api/flows"),
  getFlow: (id) => req<Record<string, unknown>>(`/api/flows/${id}`),
  createFlow: (flow) =>
    req<{ id: string }>("/api/flows", { method: "POST", body: JSON.stringify(flow) }),
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
  simTurn: (payload: SimTurnRequest) =>
    call<SimTurnResponse>("/api/engine/api/sim/turn", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Report de GO — via proxy (não via BASE). Métrica oficial de decisão.
  getSimReport: () => call<SimReport>("/api/engine/api/sim/report"),

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
