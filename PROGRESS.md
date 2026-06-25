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
- T3 ✓ — Toolbar: Salvar (create/update), Publicar (persist→publishFlow→setPublished), badge Publicado/Rascunho, invalida ["flows"], erros→toast. build+lint verdes.
- T4 ✓ — Sidebar: lista via api.listFlows() (react-query), clique=getFlow+loadFlow(id,active), Novo Flow=resetFlow, ponto verde=ativo, erro→toast+estado vazio. build+lint verdes.
- T5 ✓ — integrada: sem fetch direto em telas (só src/server.ts SSR); build+lint+round-trip 181+SSR 200 nas 6 rotas; smoke funcional de flows OK (create/list/publish single-active/get/update lossless).
- T6 [BLOCKED] — ver seção DoD-2/N8N abaixo.

## DoD-2 / N8N — gap documentado (T6 BLOCKED)

**Motivo do bloqueio:** `N8N_API_KEY` ausente no ambiente (`env | grep N8N` vazio) e sem URL pública confirmada do motor. Sem credencial não dá pra listar/abrir/PUT workflows no n8n.grupototum.com/api/v1.
**Gap de formato (por que não gerar do zero agora):** nosso flow JSON (FLOW_FORMAT_SPEC: nodes com `next/branches/on_reply/on_timeout/effects`, interrupts globais com retorno a `{PONTO_RETORNO}`) ≠ schema do N8N (nodes com `parameters/credentials/typeVersion/position` + `connections` por porta/índice). A transpilação fiel exige mapear cada tipo nosso para nós N8N (HTTP Request/IF/Switch/Wait/Code/Webhook) e remontar `connections` — não validável sem uma instância real pra testar o PUT. Gerar às cegas produziria workflow quebrado (proibido pela instrução).
**Caminho recomendado quando houver chave:** começar pelo round-trip seguro (GET /workflows/:id → editar só campos escalares → PUT de volta) antes de transpilar do nosso formato. Alinhar com CAMINHO_A_N8N_HANDOFF.md (cérebro no motor; N8N orquestra START/INBOUND, não é o cérebro).
