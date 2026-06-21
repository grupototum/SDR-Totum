/**
 * Tipos da página PESQUISA (wizard de Ordem de Pesquisa de Lote).
 *
 * FONTE DA VERDADE pretendida: docs/MESTRE_DE_PESQUISA_v2.md.
 * Esse arquivo ainda NÃO existe no repositório no momento da implementação,
 * então o conteúdo (campos, gate, schema FASE 6) foi derivado do prompt de
 * especificação. Pontos marcados com `TODO(mestre)` em content.ts devem ser
 * reconciliados quando o mestre for adicionado.
 */

/** Tipos de prospecção (FASE 0 do mestre). */
export type ProspectType = "A" | "B" | "C";

/** Ângulos de munição (FASE 0 do mestre). */
export type AngleId =
  | "diferencial_escondido"
  | "comparacao_concorrente"
  | "perda_momento"
  | "reputacao_desperdicada"
  | "urgencia_decisao";

/** Bloco do schema de saída POR PROSPECT (FASE 6 do mestre). */
export type OutputBlock = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** Um campo do schema de saída por prospect. */
export interface OutputField {
  /** Placeholder usado no prompt gerado, ex: NOME_EMPRESA -> {NOME_EMPRESA}. */
  key: string;
  /** Rótulo legível na checklist. */
  label: string;
  /** Bloco a que pertence (A–G). */
  block: OutputBlock;
  /** Campo bloqueante do GATE / qualificação. */
  blocking?: boolean;
  /** Campo de munição (gancho de abordagem). */
  munition?: boolean;
  /** Marcado por padrão no passo 5. */
  defaultOn?: boolean;
}

/** Gate ICP (FASE 1) — defaults editáveis. */
export interface IcpGate {
  minAvaliacoes: number;
  notaMinima: number;
  exigeWhatsapp: boolean;
  instagramAtivoDias: number;
  /** Nicho odonto não-individual (exclui consultórios de dentista único). */
  somenteNaoIndividual: boolean;
}

/** Dados completos de uma Ordem de Pesquisa de Lote. */
export interface OrderData {
  // Passo 1 — Nicho & ICP
  nicho: string;
  descricaoIcp: string;
  encaixeNatural: string;
  upsellFuturo: string;

  // Passo 2 — Geografia
  estados: string[];
  cidades: string[];

  // Passo 3 — Gate ICP + Exclusões
  gate: IcpGate;
  exclusoes: string[];

  // Passo 4 — Tipos & Ângulos
  tipos: ProspectType[];
  angulos: AngleId[];

  // Passo 5 — Campos de saída desejados (keys de OutputField marcadas)
  camposSaida: string[];
}

/** Status de uma ordem persistida no histórico. */
export type OrderStatus = "rascunho" | "salva" | "concluida";

/** Registro persistido de uma ordem (histórico). */
export interface ResearchOrder {
  id: string;
  /** Nome auto: "[nicho] — [estado(s)] — [data]". */
  name: string;
  data: OrderData;
  /** Prompt gerado no momento do salvamento. */
  prompt: string;
  status: OrderStatus;
  /** ISO timestamp. */
  createdAt: string;
}
