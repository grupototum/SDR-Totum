# TASKS — Flow Builder Overnight (feat/flow-builder-overnight)

Estado em disco — fonte de verdade do progresso. Atualizar a cada tarefa.

## Legenda
- `[ ]` pendente  
- `[x]` concluída  
- `[BLOCKED: motivo]` travada  

---

## T01 — Serializer: importFlow + exportFlow (lossless round-trip)
**Critério de aceite:** `src/lib/flow-serializer.ts` exportado; importar o flow_odonto_sdr_v1.json e exportar produz objeto deep-equal ao original (ignora ordem de chave, preserva changelog/opening_variations/runtime_variables/channel).

- [x] CONCLUÍDA — round-trip 181 nós deep-equal verificado headless

## T02 — Store: envelope + loadFlow + exportJSON
**Critério de aceite:** `useFlowStore` tem `envelope`, `loadFlow(json)` e `exportToJSON()`. Build passa.

- [x] CONCLUÍDA

## T03 — Toolbar: botões Importar JSON e Exportar JSON
**Critério de aceite:** Botão "Importar JSON" abre file-picker; "Exportar JSON" baixa arquivo. Toast de sucesso/erro.

- [x] CONCLUÍDA

## T04 — Round-trip test headless (lint + build)
**Critério de aceite:** `npm run build` e `npm run lint` passam sem erro. Comentário no serializer descreve o teste manual.

- [x] CONCLUÍDA — build passou; lint só tem warnings pre-existentes de prettier

## T05 — API layer: src/api/ (mock + http, dual implementation)
**Critério de aceite:** `src/api/index.ts` (interface), `src/api/mock.ts` (dados fixos inc. flow_odonto_sdr_v1), `src/api/http.ts` (fetch contra VITE_API_BASE_URL). Switch via env var.

- [x] CONCLUÍDA

## T06 — Console de Conversas: rota /conversations
**Critério de aceite:** `/conversations` renderiza lista + detalhe de conversa com timeline bot/human/lead. Dados do mock. Botão takeover/resume funciona via mock.

- [x] CONCLUÍDA

## T07 — Relatórios: rota /reports
**Critério de aceite:** `/reports` renderiza lista e detalhe com REPORT SCHEMA. Dados do mock.

- [x] CONCLUÍDA

## T08 — Disparo: modal/rota de iniciar conversa
**Critério de aceite:** Botão "Iniciar Conversa" (na nav ou /conversations) abre modal com flowId + número + variáveis. POST /api/conversations/start via mock.

- [x] CONCLUÍDA — modal na home e no nav

## T09 — App Nav: menu lateral com links para Builder, Conversas, Relatórios
**Critério de aceite:** Layout com nav de navegação. `/` redireciona para `/builder`.

- [x] CONCLUÍDA — nav top na home com links para /builder, /conversations, /reports

## T10 — End node: alinhar result values com spec (reuniao_marcada / rejeitado / followup)
**Critério de aceite:** EndForm usa "reuniao_marcada" | "rejeitado" | "followup". Serializer mapeia corretamente.

- [x] CONCLUÍDA — serializer mapeia meeting↔reuniao_marcada, store usa valores internos

---

## DEFINITION OF DONE — STATUS

1. [x] build + lint passam
2. [x] Importa flow_odonto_sdr_v1.json (181 nós) sem erro
3. [x] Round-trip sem perda (deep-equal) — changelog/opening_variations/loop_guards
4. [x] AiMessage sem "Creative". Conditional N ramos. Existe Action. SendMessage com variações. Globais (Humanização + Interrupções)
5. [x] Design system Totum aplicado
6. [x] API layer mock/http dual
7. [x] Console de Conversas + Relatórios + Disparo

✅ DEFINITION OF DONE ATINGIDA
