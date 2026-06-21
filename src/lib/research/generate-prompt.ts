/**
 * generateResearchPrompt — o "cérebro".
 *
 * Renderiza uma ORDEM DE PESQUISA DE LOTE no formato do
 * docs/MESTRE_DE_PESQUISA_v2.md (FASE 0 → 1 → 2 → 6 + resumo do lote).
 * A FASE 6 é montada SÓ com os campos marcados, mantendo os placeholders
 * ({NOME_EMPRESA} etc.). Não inventar campos fora do mestre.
 */
import { ANGULOS, FONTES_FASE2, OUTPUT_BLOCKS, OUTPUT_FIELDS, TIPOS } from "./content";
import type { OrderData } from "./types";

const nf = new Intl.NumberFormat("pt-BR");

function angleLabel(id: string): string {
  return ANGULOS.find((a) => a.id === id)?.label ?? id;
}

function tipoLabel(id: string): string {
  const t = TIPOS.find((x) => x.id === id);
  if (!t) return id;
  const d = t.descricao.replace(/\.$/, "");
  return `${t.id} (${d.charAt(0).toLowerCase()}${d.slice(1)})`;
}

export function generateResearchPrompt(order: OrderData): string {
  const checked = new Set(order.camposSaida);
  const lines: string[] = [];
  const p = (s = "") => lines.push(s);

  // ── Cabeçalho + MISSÃO ─────────────────────────────────────────
  p("# ORDEM DE PESQUISA DE LOTE — TOTUM PROSPECTING OS");
  p();
  p("## MISSÃO");
  p(
    "Para cada prospect do lote, revelar a OPORTUNIDADE real — nunca apenas " +
      "coletar dados soltos. Siga a REGRA DE OURO:",
  );
  p();
  p("> **Dado → Problema → Impacto → Oportunidade**");
  p();
  p("Regras inegociáveis:");
  p("- Nunca inventar dado; nunca entregar dado isolado.");
  p("- DIFERENCIAL_REAL sempre com evidência (nada de “atendimento humanizado”).");
  p("- CAUSA e CONSEQUENCIA em 1 frase, sem jargão (leia em voz alta).");
  p("- ARGUMENTO_AUDIO com ângulo VARIADO (não começar sempre por nº de avaliações).");
  p("- Se SEO 9–10: não citar a nota; pivotar para percepção/UX.");
  p("- E-mail vindo de CNPJ = “a verificar (CNPJ)”.");
  p();

  // ── FASE 0 — Parâmetros do lote ────────────────────────────────
  p("## FASE 0 — PARÂMETROS DO LOTE");
  p(`- **Nicho / ICP:** ${order.nicho || "—"}`);
  if (order.descricaoIcp) p(`- **Descrição do ICP:** ${order.descricaoIcp}`);
  p(`- **Encaixe natural:** ${order.encaixeNatural || "—"}`);
  if (order.upsellFuturo) p(`- **Upsell futuro (não entra na abordagem):** ${order.upsellFuturo}`);
  p(`- **Exclusões:** ${order.exclusoes.length ? order.exclusoes.join(", ") : "—"}`);
  p(
    `- **Tipos de oportunidade:** ${
      order.tipos.length ? order.tipos.map(tipoLabel).join(" · ") : "—"
    }`,
  );
  p(
    `- **Ângulos de munição:** ${
      order.angulos.length ? order.angulos.map(angleLabel).join(" · ") : "—"
    }`,
  );
  p();
  p("**Geografia da campanha:**");
  p(`- Estados: ${order.estados.join(", ") || "—"}`);
  p(`- Cidades: ${order.cidades.join(", ") || "—"}`);
  p();

  // ── FASE 1 — Gate ICP ──────────────────────────────────────────
  p("## FASE 1 — GATE ICP (verificar ANTES de pesquisar; falhou → DESCARTAR)");
  p(`- Avaliações Google: **${nf.format(order.gate.minAvaliacoes)}+** (número exato no Maps)`);
  p(`- Nota Google: **${order.gate.notaMinima.toLocaleString("pt-BR")}+**`);
  if (order.gate.somenteNaoIndividual) p("- Nicho: Odontologia (**não** consultório individual)");
  p("- Região: dentro da geografia do lote");
  if (order.gate.exigeWhatsapp) p("- WhatsApp: visível no perfil ou site");
  p(
    `- Instagram ativo: perfil existe + postou nos últimos **${order.gate.instagramAtivoDias}** dias`,
  );
  p("- Exclusão: não é franquia/rede/corporativa");
  p();

  // ── FASE 2 — Fontes ────────────────────────────────────────────
  p("## FASE 2 — PESQUISA POR PROSPECT (ordem das fontes)");
  FONTES_FASE2.forEach((f, i) => p(`${i + 1}. ${f}`));
  p();

  // ── FASE 6 — Output por prospect (só campos marcados) ──────────
  p("## FASE 6 — OUTPUT POR PROSPECT");
  p(
    "Para CADA prospect aprovado, retorne os campos abaixo (mantenha as chaves; " +
      "preencha os valores):",
  );
  p();
  for (const block of OUTPUT_BLOCKS) {
    const fields = OUTPUT_FIELDS.filter((f) => f.block === block.id && checked.has(f.key));
    if (!fields.length) continue;
    p(`### BLOCO ${block.id} — ${block.label.toUpperCase()}`);
    for (const f of fields) {
      const tags: string[] = [];
      if (f.blocking) tags.push("bloqueante");
      if (f.munition) tags.push("munição");
      const suffix = tags.length ? `  _(${tags.join(", ")})_` : "";
      p(`- **${f.key}**: {${f.key}} — ${f.label}${suffix}`);
    }
    p();
  }

  // ── Resumo do lote ─────────────────────────────────────────────
  p("## RESUMO DO LOTE (entregar ao final)");
  p("- Total avaliados / aprovados / descartados (com motivo)");
  p("- Distribuição por tipo de oportunidade (A/B/C) e por categoria principal");
  p("- Dono identificado vs. não identificado");
  p("- Top 5 por volume de avaliações");

  return lines.join("\n");
}
