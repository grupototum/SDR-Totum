/**
 * generateResearchPrompt — o "cérebro".
 *
 * Renderiza uma ORDEM DE PESQUISA DE LOTE pronta pra colar em qualquer LLM,
 * no formato do MESTRE_DE_PESQUISA_v2.md. Monta a FASE 6 SÓ com os campos
 * marcados, mantendo os placeholders ({NOME_EMPRESA} etc.).
 *
 * TODO(mestre): alinhar o texto fixo (MISSÃO, FASE 2) ao mestre quando existir.
 */
import { ANGULOS, FONTES_FASE2, OUTPUT_BLOCKS, OUTPUT_FIELDS, TIPOS } from "./content";
import type { OrderData } from "./types";

function angleLabel(id: string): string {
  return ANGULOS.find((a) => a.id === id)?.label ?? id;
}

function tipoLabel(id: string): string {
  const t = TIPOS.find((x) => x.id === id);
  return t ? `${t.label} — ${t.descricao}` : id;
}

export function generateResearchPrompt(order: OrderData): string {
  const checked = new Set(order.camposSaida);
  const lines: string[] = [];
  const p = (s = "") => lines.push(s);

  // ── MISSÃO (fixa) ──────────────────────────────────────────────
  p("# ORDEM DE PESQUISA DE LOTE — SDR TOTUM");
  p();
  p("## MISSÃO");
  p(
    "Revelar a OPORTUNIDADE real em cada prospect deste lote — não apenas " +
      "coletar dados. Para cada empresa, siga a REGRA DE OURO:",
  );
  p();
  p("> **Dado → Problema → Impacto → Oportunidade**");
  p();
  p(
    "Cada campo coletado só importa se levar a um problema concreto, ao impacto " +
      "que ele causa no negócio e à oportunidade que a Totum pode abrir.",
  );
  p();

  // ── FASE 0 — ICP / Geografia / Exclusões / Tipos / Ângulos ─────
  p("## FASE 0 — DEFINIÇÃO DO LOTE");
  p();
  p(`**Nicho:** ${order.nicho || "—"}`);
  if (order.descricaoIcp) p(`**ICP:** ${order.descricaoIcp}`);
  p(`**Encaixe natural:** ${order.encaixeNatural || "—"}`);
  if (order.upsellFuturo) p(`**Upsell futuro:** ${order.upsellFuturo}`);
  p();
  p(`**Estados:** ${order.estados.join(", ") || "—"}`);
  p(`**Cidades:** ${order.cidades.join(", ") || "—"}`);
  p();
  p("**Exclusões (NÃO prospectar):**");
  if (order.exclusoes.length) order.exclusoes.forEach((e) => p(`- ${e}`));
  else p("- (nenhuma)");
  p();
  p("**Tipos de prospecção alvo:**");
  if (order.tipos.length) order.tipos.forEach((t) => p(`- ${tipoLabel(t)}`));
  else p("- (todos)");
  p();
  p("**Ângulos de munição priorizados:**");
  if (order.angulos.length) order.angulos.forEach((a) => p(`- ${angleLabel(a)}`));
  else p("- (livres)");
  p();

  // ── FASE 1 — GATE de qualificação ──────────────────────────────
  p("## FASE 1 — GATE DE QUALIFICAÇÃO");
  p("Descarte qualquer prospect que NÃO atenda a TODOS os critérios abaixo:");
  p();
  p(`- Mínimo de avaliações no Google: **${order.gate.minAvaliacoes}**`);
  p(`- Nota mínima no Google: **${order.gate.notaMinima.toLocaleString("pt-BR")}**`);
  p(`- Possui WhatsApp: **${order.gate.exigeWhatsapp ? "obrigatório" : "opcional"}**`);
  p(`- Instagram ativo nos últimos **${order.gate.instagramAtivoDias}** dias`);
  if (order.gate.somenteNaoIndividual)
    p("- Nicho odonto **não-individual** (excluir consultório de profissional único)");
  p();

  // ── FASE 2 — Fontes ────────────────────────────────────────────
  p("## FASE 2 — FONTES DE PESQUISA");
  FONTES_FASE2.forEach((f) => p(`- ${f}`));
  p();

  // ── FASE 6 — Output por prospect (só campos marcados) ──────────
  p("## FASE 6 — OUTPUT POR PROSPECT");
  p(
    "Para CADA prospect aprovado, retorne os campos abaixo (mantenha os nomes " +
      "como chaves; preencha os valores):",
  );
  p();
  for (const block of OUTPUT_BLOCKS) {
    const fields = OUTPUT_FIELDS.filter((f) => f.block === block.id && checked.has(f.key));
    if (!fields.length) continue;
    p(`### Bloco ${block.id} — ${block.label}`);
    for (const f of fields) {
      const tags: string[] = [];
      if (f.blocking) tags.push("bloqueante");
      if (f.munition) tags.push("munição");
      const suffix = tags.length ? `  _(${tags.join(", ")})_` : "";
      p(`- **${f.key}**: {${f.key}} — ${f.label}${suffix}`);
    }
    p();
  }

  // ── RESUMO DO LOTE ─────────────────────────────────────────────
  p("## RESUMO DO LOTE (entregar ao final)");
  p("- Total de prospects analisados");
  p("- Total aprovados no GATE (FASE 1) e total descartados (com motivo)");
  p("- Distribuição por estado/cidade e por tipo (A/B/C)");
  p("- Top oportunidades do lote (ranqueadas por fit + munição)");

  return lines.join("\n");
}
