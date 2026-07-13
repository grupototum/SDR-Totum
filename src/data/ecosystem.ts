/**
 * ecosystem.ts — fonte ÚNICA da lista de subdomínios/serviços do ecossistema
 * Totum exibidos no dashboard operacional (/).
 *
 * ✏️ PARA EDITAR A LISTA REAL: adicione/remova objetos em SERVICES abaixo.
 *
 * 🔌 PARA CONECTAR HEALTHCHECK/API REAL no futuro:
 *   - troque `check` do serviço para { type: "proxy", path: "/api/..." }
 *     apontando para um endpoint same-origin que o server proxeia, OU
 *   - substitua o consumo em src/routes/index.tsx por uma useQuery para a
 *     sua API de status (ex.: GET /api/engine-v3/health agregado).
 *
 * Tipos de verificação suportados pelo dashboard hoje:
 *   - "proxy": fetch same-origin ao `path` (status HTTP real — mais confiável)
 *   - "ping":  fetch no-cors direto na URL (só detecta alcançável/inalcançável)
 *   - "none":  não verifica (exibe "—")
 */

export type ServiceCategory =
  | "frontend"
  | "api"
  | "automação"
  | "admin"
  | "webhook"
  | "crm"
  | "painel"
  | "banco";

export interface EcosystemService {
  id: string;
  name: string;
  url: string;
  category: ServiceCategory;
  description: string;
  check: { type: "proxy"; path: string } | { type: "ping" } | { type: "none" };
}

export const SERVICES: EcosystemService[] = [
  {
    id: "sdr-front",
    name: "SDR Totum (painel)",
    url: "https://sdr.grupototum.com",
    category: "frontend",
    description: "Este painel — builder, simulador, conversas e relatórios.",
    check: { type: "ping" },
  },
  {
    id: "engine-v3",
    name: "Motor SDR V3",
    url: "https://engine.grupototum.com",
    category: "api",
    description: "Motor de conversas (flows, follow-up, simulação).",
    // Verificação REAL via proxy same-origin — status HTTP do /health do motor.
    check: { type: "proxy", path: "/api/engine-v3/health" },
  },
  {
    id: "n8n",
    name: "n8n Totum",
    url: "https://n8n.grupototum.com",
    category: "automação",
    description: "Workflows de automação (Kommo, webhooks, integrações).",
    check: { type: "ping" },
  },
  {
    id: "mcp",
    name: "Meta MCP",
    url: "https://mcp.grupototum.com",
    category: "webhook",
    description: "Servidor MCP de integrações da Totum.",
    check: { type: "ping" },
  },
  {
    id: "supabase",
    name: "Supabase",
    url: "https://supabase.com/dashboard/project/cgpkfhrqprqptvehatad",
    category: "banco",
    description: "Banco e auth do ecossistema.",
    check: { type: "none" },
  },
  // ➕ Adicione novos serviços aqui:
  // { id: "kommo", name: "Kommo CRM", url: "https://…", category: "crm",
  //   description: "…", check: { type: "ping" } },
];
