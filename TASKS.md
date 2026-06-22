# TASKS — Build noturno: Flow Builder como CONTROL SURFACE do motor

Branch: `feat/control-surface-overnight` (a partir de `main`)
Protocolo: 1 commit por tarefa · auto-verificação (build+lint+round-trip 181) antes de `[x]` · 3 falhas → `[BLOCKED]`.
(Histórico do build anterior: ver RELATORIO_FINAL.md.)

## Legenda
`[ ]` pendente · `[x]` concluída · `[BLOCKED: motivo]` travada

## DoD-1 (prioridade máxima)
- [x] T1 — Data layer flows: `active` no FlowSummary; flow store em memória no mock (seed odonto = ativo) com list/get/create/update/publish lossless; `publishFlow` no ApiClient + http stub. Verify: build+lint ✓.
- [x] T2 — Store wiring: `currentFlowId`, `published` + ações `setCurrentFlow`/`setPublished`/`resetFlow`; `loadFlow(json, meta)` seta id/active. Verify: build+lint+round-trip ✓.
- [x] T3 — Toolbar: Salvar (create/update via api), Publicar (persist+publishFlow), badge Publicado/Rascunho no header; Import/Export mantidos; erros→toast; invalida ["flows"]. Verify: build+lint ✓.
- [x] T4 — Sidebar: lista flows de `api.listFlows()` (react-query), clicar carrega (getFlow→loadFlow com id/active), Novo Flow=resetFlow; ponto verde=ativo; erro→toast + estado vazio (nunca tela branca). Verify: build+lint ✓.
- [x] T5 — Verificação integrada: nenhuma tela usa fetch direto (só src/server.ts SSR); build+lint+round-trip 181+SSR 200 (6 rotas) + smoke funcional de flows (create/list/publish single-active/get/update). ✓

## DoD-2 (secundário — tentar; BLOCKED se não sair limpo)
- [BLOCKED: sem N8N_API_KEY no ambiente + sem URL pública do motor] T6 — Ponte N8N. Gap documentado em PROGRESS.md. Não foi gerado workflow N8N (formato ≠; risco de quebrar). Conforme instrução, DoD-1 entregue mesmo assim.

## DoD
DoD-1 = T1..T5 verdes. Parar no DoD-1 completo ou 3 iterações sem progresso.
