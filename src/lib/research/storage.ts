/**
 * Camada de dados das Ordens de Pesquisa.
 *
 * AGORA: persistência via localStorage (mock).
 * TODO(http): trocar a implementação destes métodos por chamadas ao endpoint
 *   `/api/research-orders` (GET/POST/DELETE) usando a camada http do projeto
 *   (ver API_CONTRACT.md quando existir). Os componentes consomem só este
 *   módulo + o hook `useResearchOrders` — NÃO usar fetch direto nas telas.
 */
import { generateResearchPrompt } from "./generate-prompt";
import type { OrderData, ResearchOrder, OrderStatus } from "./types";

const STORAGE_KEY = "totum.research-orders.v1";
const EVENT = "totum:research-orders-changed";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function read(): ResearchOrder[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ResearchOrder[]) : [];
  } catch {
    return [];
  }
}

function write(orders: ResearchOrder[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event(EVENT));
}

function uid(): string {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID();
  return `ord_${read().length + 1}_${Date.now().toString(36)}`;
}

/** Nome auto: "[nicho] — [estado(s)] — [data]". */
export function buildOrderName(data: OrderData, createdAt: string): string {
  const estados = data.estados.length ? data.estados.join("/") : "—";
  const date = new Date(createdAt).toLocaleDateString("pt-BR");
  return `${data.nicho || "Pesquisa"} — ${estados} — ${date}`;
}

export function listOrders(): ResearchOrder[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrder(id: string): ResearchOrder | undefined {
  return read().find((o) => o.id === id);
}

export function saveOrder(data: OrderData, status: OrderStatus = "salva"): ResearchOrder {
  const createdAt = new Date().toISOString();
  const order: ResearchOrder = {
    id: uid(),
    name: buildOrderName(data, createdAt),
    data,
    prompt: generateResearchPrompt(data),
    status,
    createdAt,
  };
  write([order, ...read()]);
  return order;
}

export function deleteOrder(id: string): void {
  write(read().filter((o) => o.id !== id));
}

export const RESEARCH_ORDERS_EVENT = EVENT;
