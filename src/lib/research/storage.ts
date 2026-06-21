/**
 * Camada de dados das Ordens de Pesquisa.
 *
 * Esta é a implementação "mock" no padrão do API_CONTRACT.md: uma única camada
 * de acesso a dados, trocável entre mock e http via VITE_API_BASE_URL (vazio =
 * mock; preenchido = http real na VPS). Os componentes consomem só este módulo
 * + o hook `useResearchOrders` — NÃO usar fetch direto nas telas.
 *
 * Nota: o API_CONTRACT.md (escopo demo) NÃO define endpoint de research-orders
 * — a ordem de pesquisa é um artefato do frontend (gera o prompt e persiste
 * localmente). As variáveis produzidas aqui alimentam o POST
 * /api/conversations/start (NOME_EMPRESA, NOME_DONO, ESPECIALIDADE, CIDADE,
 * QTD_AVALIACOES, CONTEUDO_RECENTE, CONCORRENTE_1/2/3, tipo_clinica).
 * TODO(http): se um endpoint de orders for adicionado ao contrato, trocar só a
 * implementação destes métodos (mesma assinatura) — nenhuma reescrita de tela.
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
