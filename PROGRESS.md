# PROGRESS — Flow Builder Overnight

## PASSO 0 — Levantamento (concluído)

### Stack
- TypeScript + React 19 + Vite + TanStack Start/Router
- @xyflow/react ^12 (React Flow)
- Zustand ^5
- Tailwind v4 (@theme inline)
- Sonner (toasts)
- TanStack Query

### O que já existe
- Flow Builder em `/builder` com 9 tipos de nó: start, send, ai, wait, conditional, variable, action, end, log
- Zustand store em `src/stores/flow-store.ts`
- Node components em `src/components/flow/nodes.tsx`
- Property forms em `src/components/flow/property-forms.tsx`
- PropertiesPanel com Global Settings (Humanização + Interrupções)
- Design system Totum Red em `src/styles.css` (todos os tokens corretos)
- AiMessage: só Strict/Flexible, sem Creative ✓
- SendMessage com variações A/B ✓
- Conditional N ramos ✓
- DELAY com dois relógios (digitando + leitura) ✓

### O que falta (para DoD)
1. **Import/Export JSON** — nenhum botão existe no toolbar
2. **Serializer** — sem `flowToJSON` / `flowFromJSON` / passthrough lossless
3. **API layer** — sem `src/api/` com mock/http dual
4. **Console de Conversas** — rota não existe
5. **Relatórios** — rota não existe
6. **Disparo** — sem gatilho de iniciar conversa
7. **End node values** — store usa "meeting" em vez de "reuniao_marcada"

### Mapeamento de tipos (store → spec)
- start → start (builder-only)
- send → send_message
- ai → ai_message
- wait → wait
- conditional → conditional
- variable → set_variable
- action → action
- end → end
- log → log (builder-only, não existe no flow_odonto_sdr_v1)

### Campos extra no flow_odonto_sdr_v1.json
- Top-level: channel, runtime_variables, changelog, opening_variations
- Todos devem ser preservados no round-trip via envelope._extra

### Estratégia de round-trip (CRÍTICA)
- Cada nó importado recebe `data._raw` = spec node completo (sem routing: next/on_reply/on_timeout/branches.goto/default)
- Routing vive nos React Flow edges (derivado de next, on_reply, etc. no import)
- No export: parte de `_raw` (passthrough), sobrepõe campos de UI, injeta routing dos edges
- Para nós novos (sem `_raw`): build from scratch dos campos de UI

---
