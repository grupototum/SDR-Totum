/**
 * API gateway — switch via VITE_API_BASE_URL.
 * Vazio → mock local. Preenchido → http real na VPS.
 *
 * Trocar para http real = setar a env var. Nenhuma reescrita de tela.
 */

import { mockApi } from "./mock";
import { httpApi } from "./http";

export type { ApiClient } from "./types";
export type {
  FlowSummary,
  ConversationSummary,
  ConversationDetail,
  Message,
  ReportSchema,
  ReportSummary,
  StartConversationPayload,
  OrderData,
  ResearchGeography,
  ResearchOrder,
  N8nWorkflow,
  N8nWorkflowSummary,
  SimFlags,
  SimMessage,
  SimTurnRequest,
  SimTurnResponse,
  SimReport,
} from "./types";

const isMock = !import.meta.env.VITE_API_BASE_URL;

export const api = isMock ? mockApi : httpApi;
