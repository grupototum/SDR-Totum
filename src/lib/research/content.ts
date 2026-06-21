/**
 * Conteúdo da Ordem de Pesquisa — derivado do prompt de especificação.
 *
 * TODO(mestre): reconciliar TODO este arquivo com docs/MESTRE_DE_PESQUISA_v2.md
 * quando ele for adicionado ao repo. As cidades da FASE 0, os campos da FASE 6
 * (blocos A–G) e a lista de fontes da FASE 2 são aproximações sensatas baseadas
 * no domínio SDR + nos campos nomeados explicitamente no prompt
 * (DIFERENCIAL_REAL, GANCHO_ABERTURA, CATEGORIA_PRINCIPAL, CAUSA, CONSEQUENCIA,
 * ARGUMENTO_AUDIO). Não inventar campos novos sem checar o mestre.
 */
import type { AngleId, IcpGate, OrderData, OutputBlock, OutputField, ProspectType } from "./types";

/** Estados pré-populados (FASE 0). */
export const ESTADOS = ["SP", "MG", "ES"] as const;

/** Cidades por estado (FASE 0). TODO(mestre): substituir pela lista oficial. */
export const CIDADES_POR_ESTADO: Record<string, string[]> = {
  SP: ["São Paulo", "Campinas", "Ribeirão Preto", "Sorocaba", "São José dos Campos", "Santos"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim"],
  ES: ["Vitória", "Vila Velha", "Serra", "Cariacica", "Linhares"],
};

/** Tipos de prospecção (FASE 0). */
export const TIPOS: { id: ProspectType; label: string; descricao: string }[] = [
  { id: "A", label: "Tipo A", descricao: "Encaixe direto e óbvio no ICP." },
  { id: "B", label: "Tipo B", descricao: "Encaixe parcial, exige adaptação." },
  { id: "C", label: "Tipo C", descricao: "Encaixe lateral / upsell futuro." },
];

/** Ângulos de munição (FASE 0). */
export const ANGULOS: { id: AngleId; label: string; descricao: string }[] = [
  {
    id: "diferencial_escondido",
    label: "Diferencial escondido",
    descricao: "Algo forte que a empresa tem mas não comunica.",
  },
  {
    id: "comparacao_concorrente",
    label: "Comparação com concorrente",
    descricao: "Concorrente próximo está à frente em algo visível.",
  },
  {
    id: "perda_momento",
    label: "Perda de momento",
    descricao: "Sinal de queda de ritmo (posts, avaliações, atualizações).",
  },
  {
    id: "reputacao_desperdicada",
    label: "Reputação desperdiçada",
    descricao: "Boa reputação sem conversão / sem presença digital à altura.",
  },
  {
    id: "urgencia_decisao",
    label: "Urgência de decisão",
    descricao: "Janela ou gatilho temporal que pressiona a decisão.",
  },
];

/** Exclusões padrão (FASE 0). */
export const EXCLUSOES_PADRAO = ["Franquias", "Grandes redes", "Marcas nacionais", "Corporativas"];

/** Gate ICP default (FASE 1) — editável. */
export const GATE_DEFAULT: IcpGate = {
  minAvaliacoes: 50,
  notaMinima: 4.5,
  exigeWhatsapp: true,
  instagramAtivoDias: 60,
  somenteNaoIndividual: true,
};

/** Fontes de pesquisa (FASE 2). TODO(mestre): conferir com o mestre. */
export const FONTES_FASE2 = [
  "Google Maps / Google Meu Negócio (GMB)",
  "Instagram (perfil, frequência, engajamento)",
  "Site oficial / landing page",
  "Busca Google (nome + cidade + categoria)",
  "Receita Federal / consulta CNPJ",
  "Reclamações públicas e avaliações recentes",
];

/**
 * Schema de saída POR PROSPECT (FASE 6), agrupado por bloco A–G.
 * TODO(mestre): validar nomes/placeholders e flags `blocking`/`munition`.
 */
export const OUTPUT_BLOCKS: { id: OutputBlock; label: string }[] = [
  { id: "A", label: "Identificação" },
  { id: "B", label: "GMB (Google Meu Negócio)" },
  { id: "C", label: "Instagram" },
  { id: "D", label: "Site" },
  { id: "E", label: "Concorrentes" },
  { id: "F", label: "CNPJ" },
  { id: "G", label: "Enriquecimento / Munição" },
];

/** Os 6 campos de munição marcados por padrão (nomeados no prompt). */
const MUNICAO_DEFAULT = new Set([
  "DIFERENCIAL_REAL",
  "GANCHO_ABERTURA",
  "CATEGORIA_PRINCIPAL",
  "CAUSA",
  "CONSEQUENCIA",
  "ARGUMENTO_AUDIO",
]);

const rawFields: Omit<OutputField, "defaultOn">[] = [
  // Bloco A — Identificação
  { key: "NOME_EMPRESA", label: "Nome da empresa", block: "A", blocking: true },
  { key: "CATEGORIA_PRINCIPAL", label: "Categoria principal", block: "A", munition: true },
  { key: "CIDADE_UF", label: "Cidade / UF", block: "A", blocking: true },
  { key: "ENDERECO", label: "Endereço", block: "A" },
  { key: "TELEFONE", label: "Telefone", block: "A" },
  { key: "WHATSAPP", label: "WhatsApp", block: "A", blocking: true },
  { key: "SITE_URL", label: "URL do site", block: "A" },
  { key: "RESPONSAVEL_DECISOR", label: "Responsável / decisor", block: "A" },

  // Bloco B — GMB
  { key: "GMB_NOTA", label: "Nota no Google", block: "B", blocking: true },
  { key: "GMB_TOTAL_AVALIACOES", label: "Total de avaliações", block: "B", blocking: true },
  { key: "GMB_CATEGORIA", label: "Categoria GMB", block: "B" },
  { key: "GMB_RECLAMACOES_RECENTES", label: "Reclamações recentes", block: "B", munition: true },
  { key: "GMB_FOTOS_QTD", label: "Quantidade de fotos", block: "B" },
  { key: "GMB_HORARIO_ATUALIZADO", label: "Horário atualizado", block: "B" },
  { key: "GMB_LINK", label: "Link do perfil GMB", block: "B" },

  // Bloco C — Instagram
  { key: "INSTAGRAM_HANDLE", label: "@ do Instagram", block: "C", blocking: true },
  { key: "INSTAGRAM_SEGUIDORES", label: "Seguidores", block: "C" },
  {
    key: "INSTAGRAM_ULTIMO_POST_DIAS",
    label: "Dias desde o último post",
    block: "C",
    blocking: true,
  },
  { key: "INSTAGRAM_FREQUENCIA_POSTS", label: "Frequência de posts", block: "C" },
  { key: "INSTAGRAM_ENGAJAMENTO", label: "Engajamento médio", block: "C" },
  { key: "INSTAGRAM_BIO", label: "Bio / proposta", block: "C" },

  // Bloco D — Site
  { key: "SITE_TIPO", label: "Tipo de site (institucional/landing/nenhum)", block: "D" },
  { key: "SITE_TEM_AGENDAMENTO", label: "Tem agendamento online", block: "D" },
  { key: "SITE_VELOCIDADE", label: "Velocidade / performance", block: "D" },
  { key: "SITE_MOBILE_OK", label: "Responsivo (mobile)", block: "D" },
  {
    key: "SITE_PROBLEMA_PRINCIPAL",
    label: "Problema principal do site",
    block: "D",
    munition: true,
  },

  // Bloco E — Concorrentes
  { key: "CONCORRENTE_PROXIMO", label: "Concorrente próximo", block: "E", munition: true },
  { key: "CONCORRENTE_NOTA", label: "Nota do concorrente", block: "E" },
  { key: "CONCORRENTE_DIFERENCIAL", label: "Diferencial do concorrente", block: "E" },
  { key: "COMPARACAO_RESUMO", label: "Resumo comparativo", block: "E", munition: true },

  // Bloco F — CNPJ
  { key: "CNPJ", label: "CNPJ", block: "F" },
  { key: "RAZAO_SOCIAL", label: "Razão social", block: "F" },
  { key: "PORTE", label: "Porte", block: "F" },
  { key: "DATA_ABERTURA", label: "Data de abertura", block: "F" },
  { key: "SOCIOS", label: "Sócios", block: "F" },
  { key: "SITUACAO_CADASTRAL", label: "Situação cadastral", block: "F" },

  // Bloco G — Enriquecimento / Munição
  { key: "DIFERENCIAL_REAL", label: "Diferencial real", block: "G", munition: true },
  { key: "GANCHO_ABERTURA", label: "Gancho de abertura", block: "G", munition: true },
  { key: "CAUSA", label: "Causa (o porquê do problema)", block: "G", munition: true },
  { key: "CONSEQUENCIA", label: "Consequência (impacto)", block: "G", munition: true },
  { key: "ARGUMENTO_AUDIO", label: "Argumento para áudio", block: "G", munition: true },
  { key: "TEMPERATURA_LEAD", label: "Temperatura do lead", block: "G" },
  { key: "SCORE_FIT", label: "Score de fit", block: "G" },
  { key: "OBSERVACAO_PERSONALIZADA", label: "Observação personalizada", block: "G" },
];

/** Schema FASE 6 com `defaultOn` calculado (bloqueantes + 6 munição). */
export const OUTPUT_FIELDS: OutputField[] = rawFields.map((f) => ({
  ...f,
  defaultOn: Boolean(f.blocking) || MUNICAO_DEFAULT.has(f.key),
}));

/** Keys marcadas por padrão no passo 5. */
export const DEFAULT_OUTPUT_KEYS = OUTPUT_FIELDS.filter((f) => f.defaultOn).map((f) => f.key);

/** OrderData inicial para um novo wizard. */
export function createDefaultOrder(): OrderData {
  return {
    nicho: "Clínicas odontológicas",
    descricaoIcp: "",
    encaixeNatural: "Landing Page Express",
    upsellFuturo: "",
    estados: ["SP", "MG", "ES"],
    cidades: [...CIDADES_POR_ESTADO.SP, ...CIDADES_POR_ESTADO.MG, ...CIDADES_POR_ESTADO.ES],
    gate: { ...GATE_DEFAULT },
    exclusoes: [...EXCLUSOES_PADRAO],
    tipos: ["A", "B", "C"],
    angulos: ANGULOS.map((a) => a.id),
    camposSaida: [...DEFAULT_OUTPUT_KEYS],
  };
}
