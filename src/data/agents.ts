/**
 * agents.ts — fonte ÚNICA da lista de agentes SDR exibida em /agentes.
 *
 * ✏️ PARA EDITAR A LISTA REAL: adicione/remova objetos em AGENTS abaixo.
 *    A página /agentes só exibe agentes com `validated: true` — agentes em
 *    desenvolvimento ficam na lista com validated: false e NÃO aparecem.
 *
 * 🔌 PARA CONECTAR COM DADOS REAIS no futuro: substitua o consumo em
 *    src/routes/agentes.tsx por uma useQuery (ex.: GET /api/engine-v3/api/flows
 *    para agentes de flow, ou /api/n8n/workflows para automações n8n) e mapeie
 *    para esta mesma interface.
 */

export type AgentStatus = "ativo" | "validado" | "funcionando";

export interface SdrAgent {
  id: string;
  name: string;
  /** Função principal dentro da operação SDR. */
  role: string;
  /** Canal ou etapa do funil em que atua. */
  channel: string;
  status: AgentStatus;
  /** Só aparece em /agentes quando true. */
  validated: boolean;
  /** Faz parte de um flow visual no builder? */
  partOfFlow: boolean;
  /** Rota interna (Link) ou URL externa para abrir/configurar. */
  href: string;
  external?: boolean;
}

export const AGENTS: SdrAgent[] = [
  {
    id: "sdr-odonto",
    name: "SDR Odonto v2.6",
    role: "Prospecção e agendamento de prévia para clínicas odontológicas",
    channel: "WhatsApp · abertura → agendamento",
    status: "ativo",
    validated: true,
    partOfFlow: true,
    href: "/builder",
  },
  {
    id: "followup-abertura",
    name: "Follow-up de abertura",
    role: "Fila escalonada de abertura — bloco 1 imediato + blocos com intervalo",
    channel: "WhatsApp · pós-abertura",
    status: "funcionando",
    validated: true,
    partOfFlow: true,
    href: "/builder",
  },
  {
    id: "pesquisa",
    name: "Agente de Pesquisa",
    role: "Enriquecimento de leads — gera variáveis reais para o flow",
    channel: "Pré-conversa · pesquisa",
    status: "validado",
    validated: true,
    partOfFlow: false,
    href: "/pesquisa",
  },
  {
    id: "simulador",
    name: "Simulador V3",
    role: "Valida o roteiro contra um lead simulado antes de publicar",
    channel: "Interno · QA de flow",
    status: "funcionando",
    validated: true,
    partOfFlow: false,
    href: "/simulator",
  },
  // Agentes ainda NÃO validados — não aparecem na página:
  // { id: "gatekeeper-audio", name: "Gatekeeper de áudio", role: "…",
  //   channel: "WhatsApp · áudio", status: "validado", validated: false,
  //   partOfFlow: true, href: "/builder" },
];
