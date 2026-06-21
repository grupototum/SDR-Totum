# TASKS — Flow Builder Overnight (feat/flow-builder-overnight)

Estado em disco — fonte de verdade do progresso. Atualizar a cada tarefa.

## Legenda
- `[ ]` pendente  
- `[x]` concluída  
- `[BLOCKED: motivo]` travada  

---

## T01 — Serializer: importFlow + exportFlow (lossless round-trip)
**Critério de aceite:** `src/lib/flow-serializer.ts` exportado; importar o flow_odonto_sdr_v1.json e exportar produz objeto deep-equal ao original (ignora ordem de chave, preserva changelog/opening_variations/runtime_variables/channel).

- [ ]

## T02 — Store: envelope + loadFlow + exportJSON
**Critério de aceite:** `useFlowStore` tem `envelope`, `loadFlow(json)` e `exportToJSON()`. Build passa.

- [ ]

## T03 — Toolbar: botões Importar JSON e Exportar JSON
**Critério de aceite:** Botão "Importar JSON" abre file-picker; "Exportar JSON" baixa arquivo. Toast de sucesso/erro.

- [ ]

## T04 — Round-trip test headless (lint + build)
**Critério de aceite:** `npm run build` e `npm run lint` passam sem erro. Comentário no serializer descreve o teste manual.

- [ ]

## T05 — API layer: src/api/ (mock + http, dual implementation)
**Critério de aceite:** `src/api/index.ts` (interface), `src/api/mock.ts` (dados fixos inc. flow_odonto_sdr_v1), `src/api/http.ts` (fetch contra VITE_API_BASE_URL). Switch via env var.

- [ ]

## T06 — Console de Conversas: rota /conversations
**Critério de aceite:** `/conversations` renderiza lista + detalhe de conversa com timeline bot/human/lead. Dados do mock. Botão takeover/resume funciona via mock.

- [ ]

## T07 — Relatórios: rota /reports
**Critério de aceite:** `/reports` renderiza lista e detalhe com REPORT SCHEMA. Dados do mock.

- [ ]

## T08 — Disparo: modal/rota de iniciar conversa
**Critério de aceite:** Botão "Iniciar Conversa" (na nav ou /conversations) abre modal com flowId + número + variáveis. POST /api/conversations/start via mock.

- [ ]

## T09 — App Nav: menu lateral com links para Builder, Conversas, Relatórios
**Critério de aceite:** Layout com sidebar de navegação. `/` redireciona para `/builder`.

- [ ]

## T10 — End node: alinhar result values com spec (reuniao_marcada / rejeitado / followup)
**Critério de aceite:** EndForm usa "reuniao_marcada" | "rejeitado" | "followup". Serializer mapeia corretamente.

- [ ]
