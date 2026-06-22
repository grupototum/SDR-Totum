# TASKS — Build noturno: Flow Builder como CONTROL SURFACE do motor

Branch: `feat/control-surface-overnight` (a partir de `main`)
Protocolo: 1 commit por tarefa · auto-verificação (build+lint+round-trip 181) antes de `[x]` · 3 falhas → `[BLOCKED]`.
(Histórico do build anterior: ver RELATORIO_FINAL.md.)

## Legenda
`[ ]` pendente · `[x]` concluída · `[BLOCKED: motivo]` travada

## DoD-1 (prioridade máxima)
- [x] T1 — Data layer flows: `active` no FlowSummary; flow store em memória no mock (seed odonto = ativo) com list/get/create/update/publish lossless; `publishFlow` no ApiClient + http stub. Verify: build+lint ✓.
- [x] T2 — Store wiring: `currentFlowId`, `published` + ações `setCurrentFlow`/`setPublished`/`resetFlow`; `loadFlow(json, meta)` seta id/active. Verify: build+lint+round-trip ✓.
- [ ] T3 — Toolbar: Salvar (create/update via api), Publicar (publishFlow), badge Publicado/Rascunho no header; Import/Export JSON mantidos; erros→toast. Verify: build+lint.
- [ ] T4 — Sidebar: lista flows de `api.listFlows()` (react-query, fallback mock), clicar carrega no canvas (getFlow→import→setCurrentFlow), Novo Flow reseta; ponto de ativo; erros→toast nunca tela branca. Verify: build+lint.
- [ ] T5 — Verificação integrada: nenhuma tela usa fetch direto; build+lint+round-trip 181+SSR 200. Verify.

## DoD-2 (secundário — tentar; BLOCKED se não sair limpo)
- [ ] T6 — Ponte N8N (REST n8n.grupototum.com/api/v1, precisa N8N_API_KEY): listar workflows + abrir JSON; round-trip ler→editar→PUT. Push só se transpilação fiel/validável.

## DoD
DoD-1 = T1..T5 verdes. Parar no DoD-1 completo ou 3 iterações sem progresso.
