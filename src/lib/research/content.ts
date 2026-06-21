/**
 * Conteúdo da Ordem de Pesquisa — fonte da verdade: docs/MESTRE_DE_PESQUISA_v2.md (v2.0).
 *
 * Geografia (FASE 0), gate (FASE 1), fontes (FASE 2) e schema por prospect
 * (FASE 6 + blocos da FASE 2, bloqueantes da FASE 5) reconciliados 1:1 com o
 * mestre. Não inventar campos fora do mestre.
 */
import type { AngleId, IcpGate, OrderData, OutputBlock, OutputField, ProspectType } from "./types";

/** Estados pré-populados (FASE 0). */
export const ESTADOS = ["SP", "MG", "ES"] as const;

/** Cidades por estado (FASE 0 — geografia da campanha do mestre). */
export const CIDADES_POR_ESTADO: Record<string, string[]> = {
  SP: [
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
  MG: [
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
  ES: [
    "Vitória",
    "Vila Velha",
    "Serra",
    "Cariacica",
    "Linhares",
    "Colatina",
    "Cachoeiro de Itapemirim",
    "Aracruz",
  ],
};

/** Tipos de oportunidade (FASE 0). */
export const TIPOS: { id: ProspectType; label: string; descricao: string }[] = [
  { id: "A", label: "Tipo A", descricao: "Sem site." },
  { id: "B", label: "Tipo B", descricao: "Site antigo." },
  {
    id: "C",
    label: "Tipo C",
    descricao: "Link da bio só leva a Instagram/WhatsApp.",
  },
];

/** Ângulos de munição (FASE 0). */
export const ANGULOS: { id: AngleId; label: string; descricao: string }[] = [
  {
    id: "diferencial_escondido",
    label: "Diferencial escondido",
    descricao: "Algo forte que a clínica tem mas não comunica.",
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
export const EXCLUSOES_PADRAO = [
  "Franquias",
  "Grandes redes",
  "Marcas nacionais",
  "Clínicas corporativas",
];

/** Gate ICP default (FASE 1) — 50+ avaliações e 4,5+ (mais restritivo). */
export const GATE_DEFAULT: IcpGate = {
  minAvaliacoes: 50,
  notaMinima: 4.5,
  exigeWhatsapp: true,
  instagramAtivoDias: 60,
  somenteNaoIndividual: true,
};

/** Fontes de pesquisa por prospect (FASE 2 — ordem das fontes). */
export const FONTES_FASE2 = [
  "Google Maps (perfil)",
  "Site",
  "Instagram",
  "Maps (especialidade + cidade → concorrentes)",
  "Google Search (nome)",
  "CNPJ / Receita",
];

/** Blocos do schema POR PROSPECT (FASE 2 / FASE 6). */
export const OUTPUT_BLOCKS: { id: OutputBlock; label: string }[] = [
  { id: "A", label: "Identificação" },
  { id: "B", label: "GMB (Google Meu Negócio)" },
  { id: "C", label: "Instagram" },
  { id: "D", label: "Site" },
  { id: "E", label: "Concorrentes" },
  { id: "F", label: "CNPJ" },
  { id: "G", label: "Enriquecimento" },
];

/**
 * Bloqueantes — FASE 5 (checklist pré-disparo) é a lista canônica.
 * NOTA_SEO é bloqueante apenas se TEM_SITE = sim.
 */
const BLOQUEANTES = new Set([
  "NOME_EMPRESA",
  "CIDADE",
  "ESPECIALIDADE",
  "TIPO_OPORTUNIDADE",
  "NOME_DONO",
  "INSTAGRAM",
  "QTD_AVALIACOES",
  "CONTEUDO_RECENTE",
  "TEM_SITE",
  "NOTA_SEO",
  "CONCORRENTE_1",
  "CONCORRENTE_2",
  "CONCORRENTE_3",
  "CAUSA",
  "CONSEQUENCIA",
]);

/** Munição (FASE 3) marcada por padrão — campos nomeados no prompt/mestre. */
const MUNICAO = new Set([
  "DIFERENCIAL_REAL",
  "GANCHO_ABERTURA",
  "CATEGORIA_PRINCIPAL",
  "CAUSA",
  "CONSEQUENCIA",
  "ARGUMENTO_AUDIO",
]);

/**
 * Catálogo de campos POR PROSPECT (FASE 6 — formato de entrega), agrupado
 * pelos blocos A–G da FASE 2. Cada `label` traz a dica do mestre quando útil.
 */
const rawFields: { key: string; label: string; block: OutputBlock }[] = [
  // Bloco A — Identificação
  { key: "NOME_EMPRESA", label: "Nome da empresa", block: "A" },
  { key: "CIDADE", label: "Cidade", block: "A" },
  { key: "ESPECIALIDADE", label: "Especialidade", block: "A" },
  { key: "TIPO_CLINICA", label: "Tipo de clínica (especializada/geral/solo)", block: "A" },
  { key: "TIPO_OPORTUNIDADE", label: "Tipo de oportunidade (A/B/C)", block: "A" },
  { key: "NOME_DONO", label: "Nome do dono (+ fonte)", block: "A" },
  { key: "NOME_DECISOR_2", label: "2º decisor", block: "A" },
  { key: "WHATSAPP", label: "WhatsApp", block: "A" },
  { key: "INSTAGRAM", label: "Instagram (@handle — gate)", block: "A" },

  // Bloco B — GMB
  { key: "QTD_AVALIACOES", label: "Qtd. de avaliações (≥50)", block: "B" },
  { key: "NOTA_GMB", label: "Nota no Google", block: "B" },
  { key: "RESPONDE_AVALIACOES", label: "Responde avaliações", block: "B" },

  // Bloco C — Instagram
  { key: "SEGUIDORES", label: "Seguidores", block: "C" },
  { key: "FREQUENCIA_POSTS", label: "Frequência de posts", block: "C" },
  { key: "CONTEUDO_RECENTE", label: "Conteúdo recente (último post)", block: "C" },
  { key: "LINK_BIO", label: "Link da bio", block: "C" },

  // Bloco D — Site (só se TEM_SITE = sim)
  { key: "TEM_SITE", label: "Tem site", block: "D" },
  { key: "URL_SITE", label: "URL do site", block: "D" },
  { key: "NOTA_SEO", label: "Nota SEO (PageSpeed)", block: "D" },
  { key: "TEM_HTTPS", label: "Tem HTTPS", block: "D" },
  { key: "TEM_CTA", label: "Tem CTA", block: "D" },
  { key: "VELOCIDADE_MOBILE", label: "Velocidade mobile", block: "D" },

  // Bloco E — Concorrentes (nome | aval | nota | site? | insta? | ads?)
  { key: "CONCORRENTE_1", label: "Concorrente 1 (nome|aval|nota|site?|insta?|ads?)", block: "E" },
  { key: "CONCORRENTE_2", label: "Concorrente 2 (nome|aval|nota|site?|insta?|ads?)", block: "E" },
  { key: "CONCORRENTE_3", label: "Concorrente 3 (nome|aval|nota|site?|insta?|ads?)", block: "E" },

  // Bloco F — CNPJ
  { key: "EMAIL_OFICIAL", label: "E-mail oficial (+ fonte / 'a verificar (CNPJ)')", block: "F" },
  { key: "CNPJ_RAZAO_SOCIAL", label: "Razão social", block: "F" },
  { key: "CNPJ_ABERTURA", label: "Data de abertura", block: "F" },
  { key: "CNPJ_PORTE", label: "Porte", block: "F" },

  // Bloco G — Enriquecimento / Análise (Dado→Problema→Impacto→Oportunidade)
  { key: "DIFERENCIAL_REAL", label: "Diferencial real (com evidência)", block: "G" },
  { key: "GANCHO_ABERTURA", label: "Gancho de abertura", block: "G" },
  { key: "CATEGORIA_PRINCIPAL", label: "Categoria principal (maior perda)", block: "G" },
  { key: "CAUSA", label: "Causa (1 frase, sem jargão)", block: "G" },
  { key: "CONSEQUENCIA", label: "Consequência (foco na perda)", block: "G" },
  { key: "ARGUMENTO_AUDIO", label: "Argumento para áudio (ângulo variado)", block: "G" },
  { key: "ACHADOS_SECUNDARIOS", label: "Achados secundários", block: "G" },
  {
    key: "ENRIQUECIMENTO",
    label: "Enriquecimento (ads/velocidade/tecnologias/convênios/obs)",
    block: "G",
  },
];

/** Schema FASE 6 com flags e `defaultOn` (bloqueantes + 6 de munição). */
export const OUTPUT_FIELDS: OutputField[] = rawFields.map((f) => {
  const blocking = BLOQUEANTES.has(f.key);
  const munition = MUNICAO.has(f.key);
  return { ...f, blocking, munition, defaultOn: blocking || munition };
});

/** Keys marcadas por padrão no passo 5. */
export const DEFAULT_OUTPUT_KEYS = OUTPUT_FIELDS.filter((f) => f.defaultOn).map((f) => f.key);

/** OrderData inicial para um novo wizard. */
export function createDefaultOrder(): OrderData {
  return {
    nicho: "Clínicas odontológicas",
    descricaoIcp:
      "Ticket justifica marketing; dependem de WhatsApp; Instagram ativo mas conversão fraca; boas avaliações / site fraco.",
    encaixeNatural: "Landing Page Express",
    upsellFuturo: "Google Ads, CRM, automação, site completo, SEO local.",
    estados: ["SP", "MG", "ES"],
    cidades: [...CIDADES_POR_ESTADO.SP, ...CIDADES_POR_ESTADO.MG, ...CIDADES_POR_ESTADO.ES],
    gate: { ...GATE_DEFAULT },
    exclusoes: [...EXCLUSOES_PADRAO],
    tipos: ["A", "B", "C"],
    angulos: ANGULOS.map((a) => a.id),
    camposSaida: [...DEFAULT_OUTPUT_KEYS],
  };
}
