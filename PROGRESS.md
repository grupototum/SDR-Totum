# PROGRESS — Build noturno (control surface)

Branch: `feat/control-surface-overnight`. Estado em disco, atualizado a cada tarefa.
(Levantamento do build anterior: ver RELATORIO_FINAL.md.)

## Levantamento inicial (estado antes do build)
- Camada `api` (gateway mock/http) já existe com `listFlows/getFlow/createFlow/updateFlow` — mas mock é estático (getFlow sempre devolve o JSON do docs; create/update são no-op).
- `BuilderToolbar`: Importar/Exportar JSON funcionam; **Salvar/Testar/Publicar são toast falso** (não chamam api).
- `BuilderSidebar`: listas `pesquisas`/`flows` **hardcoded**; não chama api.
- Store `flow-store`: tem `envelope`, `loadFlow(jsonStr)`, `exportToJSON()`, serializer lossless (round-trip 181 OK). **Não rastreia** id do flow nem estado publicado.
- Contrato (API_CONTRACT.md): GET/POST/PUT /api/flows com envelope lossless. **Não define campo `active`/publish** → decisão: `active` viaja no summary + persiste no envelope (lossless), publish = PUT.

## Gaps para DoD-1
1. mock precisa de flow store em memória (create/update/list/get reais) + flag `active`.
2. store precisa de `currentFlowId` + `published` para Salvar (create vs update) e badge.
3. Toolbar: Salvar/Publicar reais; badge Publicado/Rascunho.
4. Sidebar: lista via api (fallback mock), clique carrega flow, erros→toast.

## DoD-2 (N8N)
- **[BLOCKED: sem N8N_API_KEY no ambiente]** — `env | grep N8N` vazio; sem a URL pública do motor. Conforme instrução, tarefas N8N ficam BLOCKED; DoD-1 entregue mesmo assim.

## Log de execução
- T1 ✓ — `active` em FlowSummary; mock flow store em memória (seed odonto ativo) com list/get/create/update/publish lossless; `publishFlow` no ApiClient + http (PUT active=true). build+lint verdes.
- T2 ✓ — store: `currentFlowId`/`published` + `setCurrentFlow`/`setPublished`/`resetFlow`; `loadFlow(json, {id,active})` propaga id/publicado. build+lint+round-trip verdes.
