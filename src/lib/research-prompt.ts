/**
 * research-prompt.ts
 * generateResearchPrompt(order) — renderiza uma ORDEM DE PESQUISA DE LOTE no formato
 * do docs/MESTRE_DE_PESQUISA_v2.md, pronta pra colar em qualquer LLM/agente.
 * Não inventa campos fora do mestre: o OUTPUT é montado SÓ com os campos marcados.
 */

import type { OrderData } from "@/api";
import { OUTPUT_BLOCKS, OPPORTUNITY_TYPES } from "./research-schema";

function geoBlock(data: OrderData): string {
  const lines = data.geography
    .filter((g) => g.cities.length > 0)
    .map((g) => `- ${g.uf}: ${g.cities.join(", ")}`);
  return lines.length > 0 ? lines.join("\n") : "- (nenhuma cidade selecionada)";
}

function typesBlock(data: OrderData): string {
  const labels = OPPORTUNITY_TYPES.filter((t) => data.opportunityTypes.includes(t.id)).map(
    (t) => t.label,
  );
  return labels.length > 0 ? labels.join(" · ") : "(nenhum tipo selecionado)";
}

function outputBlock(data: OrderData): string {
  const selected = new Set(data.outputFields);
  const parts: string[] = [];
  for (const block of OUTPUT_BLOCKS) {
    const fields = block.fields.filter((f) => selected.has(f.key));
    if (fields.length === 0) continue;
    parts.push(`### ${block.title}`);
    for (const f of fields) {
      const tags = [f.blocking ? "bloqueante" : "", f.ammo ? "munição" : ""]
        .filter(Boolean)
        .join(", ");
      parts.push(`- **${f.key}**: {${f.key}} — ${f.label}${tags ? `  _(${tags})_` : ""}`);
    }
    parts.push("");
  }
  return parts.join("\n").trimEnd();
}

export function generateResearchPrompt(data: OrderData): string {
  const nota = data.minRating.toLocaleString("pt-BR");

  return `# ORDEM DE PESQUISA DE LOTE — TOTUM PROSPECTING OS
> Gerada pela página Pesquisa. Fonte da verdade: MESTRE_DE_PESQUISA_v2.md.

## MISSÃO
Para cada prospect do lote, revelar a OPORTUNIDADE real — nunca apenas coletar dados soltos.
Regra de ouro de cada achado:

> **Dado → Problema → Impacto → Oportunidade**

Regras inegociáveis:
- Nunca inventar dado; nunca entregar dado isolado.
- DIFERENCIAL_REAL sempre com evidência (nada de "atendimento humanizado" sem fonte).
- CAUSA e CONSEQUENCIA em 1 frase, sem jargão (leia em voz alta).
- ARGUMENTO_AUDIO com ângulo VARIADO (não começar sempre por nº de avaliações).
- Se SEO 9–10: não citar a nota; pivotar para percepção/UX.
- E-mail vindo de CNPJ = "a verificar (CNPJ)".

## FASE 0 — PARÂMETROS DO LOTE
- **Nicho / ICP:** ${data.niche}
- **Descrição do ICP:** ${data.icpDescription}
- **Encaixe natural:** ${data.naturalFit}
- **Upsell futuro (não entra na abordagem):** ${data.upsellContext}
- **Tipos de oportunidade:** ${typesBlock(data)}
- **Ângulos de munição:** ${data.angles.join(" · ") || "(nenhum)"}
- **Exclusões:** ${data.exclusions.join(", ") || "(nenhuma)"}

**Geografia da campanha:**
${geoBlock(data)}

## FASE 1 — GATE ICP (verificar ANTES de pesquisar; falhou → DESCARTAR)
- Avaliações Google: **${data.minReviews}+** (número exato no Maps)
- Nota Google: **${nota}+**
- Nicho: Odontologia${data.nonIndividualOnly ? " (**não** consultório individual)" : ""}
- Região: dentro da geografia do lote
- WhatsApp: ${data.requireWhatsapp ? "visível no perfil ou site" : "não obrigatório"}
- Instagram ativo: perfil existe + postou nos últimos **${data.instagramActiveDays}** dias
- Exclusão: ${data.exclusions.join(", ") || "(nenhuma)"}

## FASE 2 — PESQUISA POR PROSPECT (ordem das fontes)
1) Google Maps (perfil) · 2) Site · 3) Instagram · 4) Maps (especialidade+cidade → concorrentes) ·
5) Google Search (nome) · 6) CNPJ/Receita.

## FASE 6 — OUTPUT POR PROSPECT (entregar exatamente estes campos)
${outputBlock(data)}

## RESUMO DO LOTE (preencher ao final)
- Total avaliados / aprovados / descartados (com motivo).
- Distribuição por tipo de oportunidade e por categoria principal.
- Dono identificado vs. não identificado.
- Top 5 por volume de avaliações.`;
}
