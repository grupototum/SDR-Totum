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
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
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
};
