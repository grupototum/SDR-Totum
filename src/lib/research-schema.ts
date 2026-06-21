/**
 * research-schema.ts
 * Conteúdo da página Pesquisa — derivado de docs/MESTRE_DE_PESQUISA_v2.md (fonte da verdade).
 * Só dados/constantes; nenhum componente. O wizard e o gerador de prompt consomem daqui.
 */

import type { OrderData, ResearchGeography } from "@/api";

// ── FASE 0 — Geografia da campanha (pré-popular) ─────────────────────────────
export const GEOGRAPHY_DEFAULT: ResearchGeography[] = [
  {
    uf: "SP",
    cities: [
      "São José do Rio Preto",
      "Ribeirão Preto",
      "Araraquara",
      "São Carlos",
      "Jundiaí",
      "Sorocaba",
      "Limeira",
      "Piracicaba",
      "Americana",
      "Indaiatuba",
    ],
  },
  {
    uf: "MG",
    cities: [
      "Varginha",
      "Poços de Caldas",
      "Pouso Alegre",
      "Lavras",
      "Divinópolis",
      "Patos de Minas",
      "Uberaba",
      "Uberlândia",
      "Nova Lima",
      "Sete Lagoas",
    ],
  },
  {
    uf: "ES",
    cities: [
      "Vitória",
      "Vila Velha",
      "Serra",
      "Cariacica",
      "Linhares",
      "Colatina",
      "Cachoeiro de Itapemirim",
      "Aracruz",
    ],
  },
];

// ── FASE 0 — Exclusões / Tipos / Ângulos ─────────────────────────────────────
export const EXCLUSIONS_DEFAULT = [
  "Franquias",
  "Grandes redes",
  "Marcas nacionais",
  "Clínicas corporativas",
];

export const OPPORTUNITY_TYPES = [
  { id: "A", label: "A — sem site" },
  { id: "B", label: "B — site antigo" },
  { id: "C", label: "C — link da bio só leva a Insta/WhatsApp" },
];

export const ANGLES = [
  "Diferencial escondido",
  "Comparação com concorrente",
  "Perda de momento",
  "Reputação desperdiçada",
  "Urgência de decisão",
];

// ── FASE 6 — Schema de saída POR PROSPECT, agrupado por bloco A–G ─────────────
// blocking = bloqueante (FASE 5); ammo = munição (default marcado mesmo sem ser bloqueante).
export interface OutputField {
  key: string;
  label: string;
  blocking?: boolean;
  ammo?: boolean;
}

export interface OutputBlock {
  id: string;
  title: string;
  fields: OutputField[];
}

export const OUTPUT_BLOCKS: OutputBlock[] = [
  {
    id: "A",
    title: "Bloco A — Identificação",
    fields: [
      { key: "NOME_EMPRESA", label: "Nome da empresa", blocking: true },
      { key: "CIDADE", label: "Cidade", blocking: true },
      { key: "ESPECIALIDADE", label: "Especialidade", blocking: true },
      { key: "TIPO_CLINICA", label: "Tipo de clínica" },
      { key: "TIPO_OPORTUNIDADE", label: "Tipo de oportunidade (A/B/C)", blocking: true },
      { key: "NOME_DONO", label: "Nome do dono", blocking: true },
      { key: "NOME_DECISOR_2", label: "2º decisor" },
      { key: "WHATSAPP", label: "WhatsApp", blocking: true },
      { key: "INSTAGRAM", label: "Instagram (@handle)", blocking: true },
      { key: "TEM_SITE", label: "Tem site?", blocking: true },
      { key: "URL_SITE", label: "URL do site" },
    ],
  },
  {
    id: "B",
    title: "Bloco B — GMB (Google Meu Negócio)",
    fields: [
      { key: "QTD_AVALIACOES", label: "Qtd. avaliações", blocking: true },
      { key: "NOTA_GMB", label: "Nota Google" },
      { key: "RESPONDE_AVALIACOES", label: "Responde avaliações?" },
      { key: "DIFERENCIAL_REAL", label: "Diferencial real (munição)", ammo: true },
    ],
  },
  {
    id: "C",
    title: "Bloco C — Instagram",
    fields: [
      { key: "SEGUIDORES", label: "Seguidores" },
      { key: "FREQUENCIA_POSTS", label: "Frequência de posts" },
      { key: "CONTEUDO_RECENTE", label: "Conteúdo recente (MSG-03)", blocking: true },
      { key: "LINK_BIO", label: "Link da bio" },
    ],
  },
  {
    id: "D",
    title: "Bloco D — Site (se tiver)",
    fields: [
      { key: "NOTA_SEO", label: "Nota SEO (PageSpeed)", blocking: true },
      { key: "TEM_HTTPS", label: "Tem HTTPS?" },
      { key: "TEM_CTA", label: "Tem CTA?" },
      { key: "VELOCIDADE_MOBILE", label: "Velocidade mobile" },
    ],
  },
  {
    id: "E",
    title: "Bloco E — Concorrentes (até 3)",
    fields: [
      { key: "CONCORRENTE_1", label: "Concorrente 1", blocking: true },
      { key: "CONCORRENTE_2", label: "Concorrente 2", blocking: true },
      { key: "CONCORRENTE_3", label: "Concorrente 3", blocking: true },
    ],
  },
  {
    id: "F",
    title: "Bloco F — CNPJ / Receita",
    fields: [
      { key: "CNPJ_RAZAO_SOCIAL", label: "Razão social" },
      { key: "CNPJ_ABERTURA", label: "Data de abertura" },
      { key: "CNPJ_PORTE", label: "Porte" },
      { key: "EMAIL_OFICIAL", label: 'E-mail oficial ("a verificar")' },
    ],
  },
  {
    id: "G",
    title: "Bloco G — Enriquecimento & Munição (análise)",
    fields: [
      { key: "GANCHO_ABERTURA", label: "Gancho de abertura (MSG-01)", ammo: true },
      { key: "CATEGORIA_PRINCIPAL", label: "Categoria principal (maior perda)", ammo: true },
      { key: "CAUSA", label: "Causa", blocking: true, ammo: true },
      { key: "CONSEQUENCIA", label: "Consequência", blocking: true, ammo: true },
      { key: "ARGUMENTO_AUDIO", label: "Argumento de áudio", ammo: true },
      { key: "ACHADOS_SECUNDARIOS", label: "Achados secundários" },
      { key: "FAZ_GOOGLE_ADS", label: "Faz Google Ads?" },
      { key: "VELOCIDADE_AVALIACOES", label: "Velocidade das avaliações" },
      { key: "TECNOLOGIAS", label: "Tecnologias/serviços (scanner, CEREC…)" },
      { key: "CONVENIOS", label: "Convênios" },
    ],
  },
];

export const ALL_OUTPUT_FIELDS: OutputField[] = OUTPUT_BLOCKS.flatMap((b) => b.fields);

/** Default marcado no passo 5: todos os bloqueantes + munição. */
export const DEFAULT_OUTPUT_FIELDS: string[] = ALL_OUTPUT_FIELDS.filter(
  (f) => f.blocking || f.ammo,
).map((f) => f.key);

// ── Ordem default (estado inicial do wizard) ─────────────────────────────────
export function defaultOrderData(): OrderData {
  return {
    niche: "Clínicas odontológicas",
    icpDescription:
      "Ticket justifica marketing; dependem de WhatsApp; Instagram ativo mas conversão fraca; boas avaliações / site fraco.",
    naturalFit: "Landing Page Express",
    upsellContext:
      "Google Ads, CRM, automação, site completo, SEO local (não entram na abordagem).",
    geography: GEOGRAPHY_DEFAULT.map((g) => ({ uf: g.uf, cities: [...g.cities] })),
    minReviews: 50,
    minRating: 4.5,
    requireWhatsapp: true,
    instagramActiveDays: 60,
    nonIndividualOnly: true,
    exclusions: [...EXCLUSIONS_DEFAULT],
    opportunityTypes: OPPORTUNITY_TYPES.map((t) => t.id),
    angles: [...ANGLES],
    outputFields: [...DEFAULT_OUTPUT_FIELDS],
  };
}

/** Nome automático: "[nicho] — [estado(s)] — [data]". */
export function autoOrderName(data: OrderData, date = new Date()): string {
  const ufs = data.geography
    .filter((g) => g.cities.length > 0)
    .map((g) => g.uf)
    .join("/");
  const d = date.toLocaleDateString("pt-BR");
  return `${data.niche} — ${ufs || "—"} — ${d}`;
}
