# SDR TOTUM — Flow Builder Frontend (v2)

Construir o frontend completo do Flow Builder visual para automação WhatsApp, seguindo à risca o design system Totum Red (dark-first, vermelho como âncora, Geomanist 300, bordas via inset shadow). Escopo: **apenas frontend/UI** com estado local (sem backend, sem persistência). Lovable Cloud não será ativado nesta fase.

> Esta versão substitui o plano anterior. Mudou só o formato dos nós e dos forms (para o frontend casar com o motor de execução). A fundação visual, rotas, estado e toasts seguem iguais.

---

## 1. Fundação do Design System

`src/styles.css` — substituir tokens shadcn padrão pelos tokens Totum:

- Cores em `@theme inline` (oklch convertido dos hex): `surface #0e0918`, `card #1b1728`, `elevated #1f192a`, `hover-surface #272333`, `warm-rust #432d33`, `primary #da2128`, `brand-red-bright #e3433e`, `secondary #077ac7`, `tertiary #6b21ef`, `brand-purple-bright #a06ff6`, `success #35a670`, `error #d91616`, `text #d1cece`, `text-muted #9ca3af`, `white #ffffff`.
- Gradientes como tokens: `--gradient-primary`, `--gradient-secondary`, `--gradient-brand-card`, `--gradient-nav-active`.
- Shadows como tokens: `--shadow-inset-border`, `--shadow-inset-top-highlight`, `--shadow-card`, `--shadow-btn-primary`, `--shadow-halo-red`.
- Radius tokens: `--radius-card: 24px`, `--radius-node: 16px`, `--radius-input: 6px`, `--radius-pill: 9999px`, `--radius-nav: 8px`.
- Forçar `.dark` no `<html>` no root route. Remover tema claro.
- Carregar Geomanist via `<link>` no `__root.tsx` head (Fontshare CDN — fonte pública). Fallback `ui-sans-serif, system-ui`.
- `body { font-family: var(--font-geomanist); font-weight: 400; }`
- Utility `@utility inset-border` para a sombra inset padrão.

`src/components/ui/button.tsx` — adicionar variantes: `primary-pill`, `secondary-pill`, `ghost-pill` (todas radius 9999px). Substituir uso shadcn padrão em telas Totum.

---

## 2. Rotas

- `src/routes/index.tsx` → **Tela Inicial** (hero + flows recentes).
- `src/routes/builder.tsx` → **Flow Builder** (3 áreas: sidebar / canvas / properties).
- `src/routes/__root.tsx` → atualizar metadata (título "SDR Totum"), forçar dark class, carregar fonte.

---

## 3. Tela Inicial (`/`)

Hero centralizado:

- H1 "SDR Totum" — 72px weight 300, letter-spacing -0.02em, branco.
- Subtítulo "Automação de conversas que parecem humanas" — 20px weight 300, `text` color.
- CTAs lado a lado: "Novo Flow" (primary pill → navega para `/builder`) + "Importar Script" (secondary pill gradient).

Seção "Flows recentes":

- Grid 3 colunas (responsivo). Cards mock (3-4 exemplos hardcoded em memória).
- Card: bg `#1b1728`, radius 24px, padding 32px, inset border. Conteúdo: nome, data, status badge (rascunho/publicado/teste), botão "Abrir" ghost pill.

---

## 4. Flow Builder (`/builder`)

Layout: `grid-cols-[280px_1fr_320px]`, altura `100vh`, sem scroll global.

### 4a. Sidebar esquerda (`<BuilderSidebar />`)

- Logo "SDR TOTUM" topo.
- Seção "Pesquisas" — lista mock com ícone + nome.
- Seção "Flows" — lista mock, item ativo destacado (bg `hover-surface`).
- 2 CTAs no rodapé: "+ Nova Pesquisa" (primary pill), "+ Novo Flow" (secondary pill).
- Bg `#1b1728`, border-right via inset shadow.

### 4b. Toolbar superior (`<BuilderToolbar />`)

- Sticky top, height 56px, bg `#1b1728/80` com backdrop-blur 24px.
- Esquerda: breadcrumb "Flows > " + input inline editável para nome do flow (estado local).
- Centro: "Salvar" (ghost), "Testar Flow" (secondary pill), "Publicar" (primary pill).
- Direita: badge versão "v1.0" + avatar (Avatar shadcn).

### 4c. Canvas (`<FlowCanvas />`)

- Usar `@xyflow/react` (React Flow) — drag, zoom, minimap, conexões customizadas.
- Bg `#0e0918`, background pattern dots/grid `#1b1728` espaçado 32px (via `<Background>`).
- `<Controls>` bottom-right, `<MiniMap>` bottom-right acima dos controls.
- Estado inicial: 1 Start node no canvas.
- Edges customizadas: cor `#6b21ef` com gradiente, hover `#da2128`, selecionada `#da2128` com drop-shadow (glow). Botão "X" no meio ao hover.

### 4d. Node Tray (`<NodeTray />`)

- Painel flutuante absolute left-4 top-20, dentro do canvas. Toggle por botão "+" flutuante.
- Lista **9 node types arrastáveis** (excluindo Humanization e Interrupções, que são globais): ícone Lucide + nome + descrição curta.
- Bg `#1b1728`, radius 16px, padding 16px, inset border. `onDragStart` seta `dataTransfer` com tipo do node.

### 4e. Properties Panel direito (`<PropertiesPanel />`)

- Bg `#1b1728`, border-left inset shadow, scroll interno.
- **Quando nada selecionado**: mostra duas seções globais, em abas ou empilhadas:
  **(A) Configurações Globais de Humanização** — sliders/inputs:
  - Velocidade de leitura: Slider 150–300, default **225** ppm (usada para a pausa antes da próxima mensagem).
  - Velocidade de digitação: Slider 20–80, default **40** ppm (usada para a duração do "digitando").
  - "Digitando" antes de cada mensagem: toggle, **default ligado e travado** (sempre aparece digitando).
  - Máx mensagens consecutivas: Input numérico default 3.
  - Horário de envio: 2 time inputs (início/fim), default 08:00 / 22:00.
  - Timezone: Select (America/Sao_Paulo default, UTC, etc).
  **(B) Interrupções Globais** — gatilhos que pausam o fluxo, vão a um bloco e **voltam ao ponto de origem** (não são edges; o motor cuida do retorno). Lista editável de interrupções:
  - Cada item: Nome (ex: "Objeção precoce"), Gatilho (texto livre, ex: "lead objeta interesse, agência ou preço"), Ir para (select de um node/bloco do flow), Ao resolver (radio: "voltar ao ponto de origem" | "ir para nó fixo").
  - Botão "+ Nova Interrupção". Uma interrupção pré-criada de exemplo: "Objeção precoce → bloco de objeções → voltar ao ponto de origem".
- **Quando node selecionado**: renderiza o form correspondente ao tipo (seção 5).

---

## 5. Nodes (`src/components/flow/nodes/`)

Wrapper base `<NodeShell />`:

- Width 240px, bg `#1b1728`, radius 16px, padding 16px, inset border.
- Selecionado: `inset 0 0 0 2px #da2128`. Erro: `inset 0 0 0 2px #d91616` + badge "!".
- Header: pill badge (cor por tipo) + ícone Lucide + título.
- Handles React Flow (`<Handle>`) customizados — bolinhas, posições conforme tipo.

Implementar **10 tipos** de nó — cada um em arquivo próprio:


| #   | Arquivo               | Badge                                       | Handles                                         |
| --- | --------------------- | ------------------------------------------- | ----------------------------------------------- |
| 1   | `StartNode.tsx`       | gradiente azul→roxo, PlayCircle             | só saída                                        |
| 2   | `SendMessageNode.tsx` | `#1f192a` "Mensagem", MessageCircle         | in + out                                        |
| 3   | `AiMessageNode.tsx`   | gradiente vermelho "IA", Sparkles           | in + out                                        |
| 4   | `WaitNode.tsx`        | `#432d33` "Aguardar" texto `#ef9a9a`, Clock | in + 2 out (resposta / timeout)                 |
| 5   | `ConditionalNode.tsx` | `#1f192a` borda roxa, GitBranch             | in + **N out** (uma saída por ramo + "default") |
| 6   | `SetVariableNode.tsx` | `#1f192a` "Variável", Tag                   | in + out                                        |
| 7   | `ActionNode.tsx`      | `#077ac7` "Ação", Zap                       | in + 2 out (ok / falha)                         |
| 8   | `EndNode.tsx`         | gradiente brand card, Flag                  | só entrada                                      |
| 9   | `LogNode.tsx`         | borda `#35a670` "Relatório", ClipboardList  | in + out                                        |


Cada node renderiza um preview compacto dos campos principais; edição completa no Properties Panel.

### Forms do Properties Panel (`src/components/flow/property-forms/`) — um por tipo:

- **Start**: nome da pesquisa, nicho, público; lista editável de "variáveis obrigatórias" (chips). Nota fixa no form: "Se uma variável obrigatória estiver vazia, a mensagem não é enviada."
- **SendMessage**:
  - Textarea da mensagem (suporta `{{variavel}}`).
  - **Variações (A/B)**: botão "+ Adicionar variação" → cada variação tem um textarea + um campo "quando" (label da condição, ex: "decisor único"). Default: 1 mensagem, sem variação.
  - **Dois tempos calculados** (read-only, com botão "Recalcular"):
    - "Digitando": `min((numPalavras/40)*60, 8) + 1` s (aprox.) — duração do indicador de digitação.
    - "Pausa para leitura": `(numPalavras/225)*60 + 2` s (aprox.) — espera antes da próxima mensagem.
  - **NÃO** usar `text.length/15`.
- **AiMessage**:
  - Modelo: select (Gemini, Claude, Groq, OpenAI), **default Gemini**.
  - Modo: **2 pills toggle — Strict (default) / Flexible.** (Sem "Creative".)
  - Indicador fixo "Sempre proativo" (chip travado, não editável): a IA sempre avança a conversa, fecha com pergunta e reengaja no silêncio.
  - Instrução (textarea). Limites (textarea, ex: "não promete preço, não inventa rota").
  - Modelo de fallback (select, opcional).
- **Wait**: timeout (número + unidade minutos/horas/dias), ação de timeout (dropdown: follow-up / encerrar / ir para nó). 2 saídas: "resposta" e "timeout".
- **Conditional** (roteamento por IA, N saídas):
  - Modelo classificador: select, default Gemini.
  - Lista editável de **ramos**: cada ramo = label ("quando", ex: "aceita prévia", "objeção", "tem dúvida") + handle de saída próprio.
  - Botão "+ Adicionar ramo". Sempre existe um ramo "default" no fim.
- **SetVariable**: key / value.
- **Action** (pausa o fluxo e roda algo externo):
  - Tipo de ação: dropdown — "Auditar site", "Oferecer horário (calendário)", "Webhook externo".
  - Campos conforme o tipo (ex: auditar site → nada; calendário → link/agenda; webhook → URL).
  - 2 saídas: "ok" e "falha".
- **End**: resultado (dropdown: reunião marcada / rejeitado / followup), nota.
- **Log/Relatório**: destino PostgreSQL fixo + toggle Google Sheets + spreadsheet ID + aba. Lista (read-only) dos campos do relatório: empresa, resultado, temperatura, score, abriu_pela_observacao, gatilho_preview, agendou, objeções, resumo, transcript, próxima_ação, onde_travou.

---

## 6. Estado

Store leve com Zustand (`src/stores/flow-store.ts`): nodes, edges, selectedNodeId, flowName, humanizationConfig, **interruptsConfig**, helpers (addNode, updateNodeData, deleteNode, setSelected). React Flow gerencia mudanças via `onNodesChange`/`onEdgesChange` aplicadas ao store. Sem persistência nesta fase (próximo passo seria localStorage ou Cloud).

---

## 7. Feedback / Toasts

- Sonner já incluso. Wrapper de toasts com cores Totum: success `#35a670`, error `#d91616`, info `#077ac7`, radius 16px, padding 16px 24px.
- Disparar toasts em Salvar / Publicar / Testar (apenas visual, sem lógica).

---

## Detalhes Técnicos

**Dependências a adicionar**: `@xyflow/react`, `zustand`. **Conversão de cores**: hex → oklch para os tokens em `@theme inline`. Hex literais mantidos em gradientes/shadows. **Tailwind v4**: tokens em `src/styles.css` sob `@theme inline`. Sem `tailwind.config.js`. Utilitários via `@utility`. **Forçar dark**: `className="dark"` no `<html>` no `RootShell`; remover tokens light, substituir pelos Totum. **Fonte Geomanist**: Fontshare (`https://api.fontshare.com/v2/css?f[]=geomanist@300,400&display=swap`) via `<link>` no head. **Acessibilidade**: focus ring vermelho `#da2128` 1px offset 2px em todos os inputs/botões. **Fora de escopo desta fase**: persistência, execução real do flow, integração WhatsApp, autenticação, import de script real (botão existe mas só dispara toast "em breve").

---

## Resumo do que mudou em relação ao plano anterior

1. **AiMessage**: removido o modo "Creative". Só Strict (default) e Flexible. Adicionado chip travado "Sempre proativo".
2. **Delay**: substituída a fórmula `length/15` por **dois tempos** — "digitando" (velocidade de digitação ~40 ppm, teto 8s) e "pausa para leitura" (225 ppm). "Digitando" sempre ligado.
3. **Conditional**: de 2 saídas (SIM/NÃO) para **N saídas** com ramos editáveis + default (roteamento por IA).
4. **Novo nó "Ação"**: pausa o fluxo para rodar algo externo (auditar site, calendário, webhook).
5. **SendMessage**: ganhou **variações A/B**.
6. **Nova seção global "Interrupções"**: gatilhos (ex: objeção precoce) que pausam, vão a um bloco e voltam ao ponto de origem.