# Comparativo — Motor novo (`sdr/`) × Sistema atual (repo SDR-Totum)

Data: 2026-07-03. Base: clone do repo público + código do engine na íntegra + memórias de incidentes.

## Descoberta importante sobre o builder

O `/builder-legacy` (que você linkou) é **só visualização** do formato v1 (grafo de 181 nós) —
está escrito no próprio código: *"Mantido para importar/visualizar o formato antigo. O formato
de trabalho primário é o v2 (estágios) em `/builder`"*. O builder v2 edita o JSON de estágios
(`flow_odonto_v2.6.json` — o script oficial v2.6) com round-trip lossless. **É esse JSON que o
motor novo passa a consumir** — editou no builder, o bot muda. Sem código.

## Lado a lado

| Dimensão | Engine antigo (SDR-Totum-engine) | Motor novo (sdr/) | Veredito |
|---|---|---|---|
| Fonte do roteiro | Flow JSON v2 (builder) ✅ | Hardcoded no prompt ❌ | **Adotar flow JSON no novo** |
| Máquina de estados | Autoritativa: clampa pulo ilegal, objeção c/ ponto de retorno, ações por estágio ✅ | LLM decide sozinho ❌ | **Portar pro novo** |
| LLM | Cadeia groq,nvidia,anthropic ✅ mas resíduo Gemini hardcoded no brain (quota estourou em jun = incidente) | groq→nvidia, sem Gemini ✅ | Novo (mais limpo) |
| Placeholder | `renderTemplate` DEIXA `{{var}}` no texto se variável falta (bug real "Clínica Exemplo") ❌ | Bloqueado por código antes do envio ✅ | Novo |
| Repetição de frase | Só instrução no prompt ❌ | Detectada + retry + trava ✅ | Novo |
| LLM falhou | Envia "Já te respondo em instantes 😊" pro lead (promessa falsa) ❌ | Não envia nada; lead vira `humano` ✅ | Novo |
| Nono dígito BR | Bug recorrente (há `CORRECAO-5533991294114.md` no repo!) ❌ | `phoneVariants()` ✅ | Novo |
| Dedupe por key.id | Não achei ❌ | ✅ | Novo |
| Pergunta obrigatória no fim | ❌ | Guardrail c/ retry (regra sua de hoje) ✅ | Novo |
| Disparo em lote c/ validação | Só start unitário via API | ingest + dispatch c/ abort por variável vazia ✅ | Novo |
| Debounce/fromMe | ✅ (1.5s) | ✅ (4s) | Empate |
| Persistência | Postgres | SQLite zero-infra | Empate (SQLite basta p/ 50-500 leads) |
| Harness de teste | Bom (baseline/diff GO-no-GO), mas baseline = **0% booked** (avanço travado) | Sim 3 personas passou + teste REAL fechou `ganho` hoje | Novo (validado em produção) |
| Higiene | 15+ arquivos `.bak` no src; roda no território OpenClaw; **repo PÚBLICO** c/ relatórios internos | 10 arquivos limpos | Novo |

## O que FUNCIONA no sistema atual (aproveitar)

Builder v2 lossless (`/builder`), formato flow v2 (estágios), API `/api/flows` (Postgres),
`validateTransition`/`authorizeActions` (motor autoritativo — a melhor peça do engine),
interrupt de objeção com `PONTO_RETORNO` e `max_iterations`, llm_provider multi-cadeia com
cota separada pro simulador.

## O que NÃO funciona / riscos (evidência)

1. **0% booked no baseline** — motor conservador demais no avanço; nem lead ideal saía de `implicacao`.
2. Placeholder vaza pro lead quando variável falta (origem do bug "Clínica Exemplo").
3. Fallback de erro manda mensagem falsa ao lead.
4. Resíduo Gemini no brain (fora da cadeia declarada) — quota mensal já derrubou prod.
5. Evolution não persiste mensagens novas; webhook apontava :3002 (desativado ontem à noite).
6. Nono dígito BR (mesmo bug que peguei hoje no teste real).
7. Repo público com PROGRESS/RELATORIO internos.

## Plano de correção (fusão)

1. Motor novo lê `flows/*.json` v2 do builder (`FLOW_PATH`); prompt gerado do flow (objective,
   guardrails globais, estágio: goal/instruction/reference_copy/advance_when, objeção).
2. Portar `validateTransition` + `authorizeActions` + interrupt de objeção — com avanço de 1
   passo LIBERADO quando `advance_when` é satisfeito (fix do 0%).
3. Manter todos os guardrails novos (tabela acima).
4. `variables` do flow mapeadas do lead (NOME_EMPRESA←nome_empresa etc.); NOME_SDR/LINK_AGENDA do env.
5. Versionar `sdr/` no repo como motor oficial; `SDR-Totum-engine` arquivado; **tornar o repo privado**.
