---
tema: Formato do Flow JSON (contrato compartilhado SDR Totum)
resumo: Especificação do JSON de flow que o engine executa, o Flow Builder (Lovable) edita e a tradução do script gera. Estende o esboço de 9 nodes do chat externo para carregar fielmente o SCRIPT_SDR_v2.5 (gates multi-saída, pausa de sistema, variantes A/B, interrupção de objeção com ponto de retorno, efeitos colaterais).
ultima-atualizacao: 2026-06-19
---

# FLOW FORMAT SPEC — contrato do flow JSON

> **3 consumidores compartilham este formato:** o **engine** (OpenClaw, executa) · o **Flow Builder** (Lovable, edita visual) · a **tradução script→flow** (esta fase manual; Script-to-Flow automatiza na Fase 2).
> O esboço de 9 nodes do chat externo é a base; aqui ele ganha o que falta pra carregar o script real.

## 1. Envelope do flow

```json
{
  "flow_id": "odonto_sdr_v1",
  "version": "1.0",
  "source_script": "SCRIPT_SDR_v2.5",
  "niche": "odontologia",
  "required_variables": ["NOME_EMPRESA","NOME_DONO","ESPECIALIDADE","CIDADE","QTD_AVALIACOES","CONTEUDO_RECENTE","CONCORRENTE_1","CONCORRENTE_2","CONCORRENTE_3"],
  "globals": { "humanization": {...}, "interrupts": [...] },
  "entry": "n01A",
  "nodes": [ ... ]
}
```

- **`required_variables`** — checadas no Start. Faltou uma → mensagem NÃO sai (regra dura, VARIAVEIS_SISTEMA). O engine sinaliza humano; não inventa.
- **`entry`** — id do primeiro nó.

## 2. Globals

```json
"globals": {
  "humanization": {
    "typing_indicator": "always",
    "typing_speed_wpm": 40,
    "typing_duration_formula": "min((word_count/40)*60, 8) + random(0.5,1.5)",
    "reading_speed_wpm": 225,
    "read_gap_formula": "(word_count/225)*60 + random(1,3)",
    "max_consecutive_messages": 3,
    "quiet_hours": ["22:00","08:00"],
    "timezone": "America/Sao_Paulo"
  },
  "interrupts": [
    {
      "id": "objecao_precoce",
      "trigger": "lead levanta objeção REAL (interesse|agência|preço) antes de G-09/G-12",
      "goto": "bloco_objecoes",
      "return": "{PONTO_RETORNO}",
      "note": "regra 16 — marca o nó atual como PONTO_RETORNO, resolve no bloco_objecoes, retorna pra cá. Objeção TARDIA (em G-09/G-12) retorna pra prévia, não pra cá."
    }
  ]
}
```

Interrupts são **handlers globais** — valem em qualquer nó, fora do fluxo linear. É o que o esboço plano não conseguia expressar.

## 3. Tipos de nó

Todo nó: `{ "id", "ref", "type", "block", ...campos do tipo, "effects"? }`.
- **`ref`** = id rastreável do script (`MSG-01A`, `G-09`) — liga flow ↔ script ↔ relatório.
- **`block`** = bloco lógico (`abertura`, `qualificacao`, `bloco_3b`, `objecoes`…) — agrupa no Builder.
- **`effects`** (opcional) = efeitos colaterais: `["crm:AGUARDANDO_ENVIO_PREVIA","notify_human"]`.

### 3.1 `send_message`
```json
{ "id":"n01", "ref":"MSG-01", "type":"send_message", "block":"abertura",
  "variants": [
    { "id":"01A", "when":"decisor_unico",  "text":"Vi vocês nas avaliações de {{ESPECIALIDADE}}... Aí é a {{NOME_EMPRESA}}, do {{NOME_DONO}}?" },
    { "id":"01B", "when":"dois_decisores", "text":"... falar com {{NOME_DONO}} ou {{NOME_DECISOR_2}}?" }
  ],
  "delay":"auto", "next":"g01" }
```
`variants` cobre o A/B do script (engine escolhe por `when`; sem variantes = `text` direto). `delay:"auto"` = **dois relógios** (globals.humanization): mostra "digitando" por `typing_duration` (velocidade de DIGITAÇÃO ~40 ppm, teto 8s) antes de enviar, e aplica `read_gap` (velocidade de LEITURA 225 ppm) antes da próxima mensagem. Número fixo sobrescreve.

### 3.2 `ai_message`
```json
{ "id":"ai24", "ref":"MSG-24/G-08", "type":"ai_message", "block":"bloco_3b",
  "mode":"strict", "model":"gemini-2.5-flash", "proactive":true,
  "instruction":"Confirmar se fez sentido a lógica. Se questiona, responder em 1 msg curta e seguir.",
  "limits":"Não inventa rota nem promete preço. Só reformula fraseado dentro do script.",
  "next":"n25" }
```
- `mode`: **`strict` default** (não sai da rota) · `flexible` (latitude de fraseado) · **sem `creative` no v1** (C1).
- `proactive:true` (C1): sempre avança pro próximo objetivo, fecha com pergunta/próximo passo, reengaja no silêncio. Nunca passivo.
- `model` default `gemini-2.5-flash` (C2).

### 3.3 `wait`
```json
{ "id":"g09", "ref":"G-09", "type":"wait", "block":"bloco_3b",
  "timeout":"20min",
  "on_reply":"classify_g09",
  "on_timeout":"bloco_objecoes" }
```
Espera o lead. `on_reply` aponta pro próximo (em geral um `conditional`/classificador). `on_timeout` roteia (cadência de follow-up em horas/dias respeitando GUIA §4B — nunca minutos no reengajamento).

### 3.4 `conditional` (gate multi-saída — classificador)
```json
{ "id":"classify_g09", "ref":"G-09", "type":"conditional", "block":"bloco_3b",
  "classifier":"groq-llama-3.3-70b",
  "branches":[
    { "when":"SIM / aceita prévia",        "goto":"n29" },
    { "when":"objeção (interesse|agência|preço)", "goto":"bloco_objecoes" },
    { "when":"questiona / dúvida",          "goto":"ai_resolver_duvida" }
  ],
  "default":"bloco_objecoes" }
```
Resolve o "Context-Aware Routing" do chat externo: a IA classifica a resposta numa das saídas semânticas. Suporta 3+ ramos (o esboço só tinha yes/no).

### 3.5 `action`
```json
{ "id":"sys_audit", "ref":"[SISTEMA RK-01]", "type":"action", "block":"rk01",
  "action":"site_audit",
  "outputs":["CAUSA","CONSEQUENCIA","NOTA_SEO","CATEGORIA_PRINCIPAL"],
  "next":"n18" }
```
Pausa o fluxo, roda um processo externo (auditoria do site), grava as saídas como variáveis e só então avança. É o `[SISTEMA — PAUSAR FLUXO]` do script.

### 3.6 `set_variable`
```json
{ "id":"set_followup", "type":"set_variable", "set":{"status":"followup"}, "next":"end_frio" }
```

### 3.7 `end`
```json
{ "id":"end_ok", "ref":"End", "type":"end", "block":"fecho",
  "report":"hermes_report",
  "set":{ "resultado":"reuniao_marcada" },
  "effects":["crm:AGENDADO"] }
```
Gera o relatório no schema reconciliado (PLANO §2): `empresa, resultado, temperatura, score, abriu_pela_observacao, gatilho_preview, agendou, objecoes, resumo, transcript, proxima_acao, onde_travou`.

---

## 4. PROVA — trecho real traduzido (abertura + gate de site + interrupção)

```json
{
  "flow_id":"odonto_sdr_v1","version":"1.0","source_script":"SCRIPT_SDR_v2.5","niche":"odontologia","entry":"n01",
  "globals":{ "interrupts":[{ "id":"objecao_precoce","trigger":"objeção real antes de G-09/G-12","goto":"ob01","return":"{PONTO_RETORNO}" }] },
  "nodes":[
    { "id":"n01","ref":"MSG-01","type":"send_message","block":"abertura",
      "variants":[
        {"id":"01A","when":"decisor_unico","text":"Vi vocês aqui nas avaliações de {{ESPECIALIDADE}} na região. {{QTD_AVALIACOES}} avaliações. Aí é a {{NOME_EMPRESA}}, do {{NOME_DONO}}?"},
        {"id":"01B","when":"dois_decisores","text":"Vi vocês aqui nas avaliações de {{ESPECIALIDADE}} na região. {{QTD_AVALIACOES}} avaliações. Aí é a {{NOME_EMPRESA}}? Poderia falar com {{NOME_DONO}} ou {{NOME_DECISOR_2}}?"}
      ],"delay":"auto","next":"g01" },
    { "id":"g01","ref":"G-01","type":"wait","timeout":"20min","on_reply":"n02","on_timeout":"n02" },
    { "id":"n02","ref":"MSG-02","type":"send_message","text":"Estava pesquisando clínicas de {{ESPECIALIDADE}} aqui em {{CIDADE}} e a de vocês me chamou atenção.","delay":"auto","next":"n03" },
    { "id":"n03","ref":"MSG-03","type":"send_message","text":"Vi um conteúdo recente de vocês sobre {{CONTEUDO_RECENTE}}. Bem diferente do que outras clínicas costumam postar.","delay":"auto","next":"pk01" },
    { "id":"pk01","ref":"PK-01","type":"send_message","text":"Vocês têm algum site ou página própria hoje?","delay":"auto","next":"g_site" },
    { "id":"g_site","ref":"PK-01","type":"conditional","classifier":"groq-llama-3.3-70b",
      "branches":[
        {"when":"tem site / manda link","goto":"sys_audit"},
        {"when":"não tem site","goto":"n09"}
      ],"default":"n09" },
    { "id":"sys_audit","ref":"[SISTEMA RK-01]","type":"action","action":"site_audit","outputs":["CAUSA","CONSEQUENCIA","NOTA_SEO","CATEGORIA_PRINCIPAL"],"next":"qualificacao_in" },
    { "id":"n09","ref":"MSG-09/10","type":"send_message","text":"Ah, entendi. Bom saber.","delay":"auto","next":"qualificacao_in" },
    { "id":"ob01","ref":"OB-01","type":"ai_message","mode":"flexible","model":"gemini-2.5-flash","proactive":true,
      "instruction":"Acolher a objeção sem rebater, reposicionar como oportunidade, reduzir fricção. Ao destravar, retornar a {{PONTO_RETORNO}}.","limits":"Nunca rebate. Nunca promete preço.","next":"{PONTO_RETORNO}" }
  ]
}
```

Repara no que o formato plano não fazia e este faz: **variantes A/B** (n01), **gate de 2+ saídas com classificador** (g_site), **pausa de sistema** (sys_audit), e a **interrupção `objecao_precoce` com retorno a `{PONTO_RETORNO}`** (regra 16) — sem isso, objeção no meio quebrava o fluxo.

---

## 5. O CASAMENTO DOS TRÊS (contrato compartilhado)

> O chat externo admitiu (2026-06-19) que a integração OpenClaw↔Lovable↔Upixel **nunca foi especificada**. Esta seção é esse contrato. **Fonte da verdade = este arquivo no repo, NÃO a memória de nenhum chat** (que degrada em conversa longa).

São **dois contratos**, e os três sistemas tocam neles em pontos diferentes:

| Sistema | Papel | Toca em |
|---|---|---|
| **Lovable** | EDITA o flow (visual) | produz **flow JSON** (§1–4) |
| **OpenClaw** | EXECUTA o flow + escreve o relatório | lê **flow JSON** · escreve **report** |
| **Upixel** | CONSOME o relatório | lê **report** (schema reconciliado, PLANO §2) |

Se os três não falarem **o mesmo flow JSON e o mesmo report**, parecem casar e quebram na integração.

### 5.1 Divergências plano-Lovable × spec (e quem vence)

| # | Lovable propôs | Spec exige | Vence | Por quê |
|---|---|---|---|---|
| D1 | AiMessage com 3 modos **Strict/Flexible/Creative** | sem `creative` no v1 | **spec** | C1 — `creative` reintroduz o defeito de improviso. Remover/desabilitar a pill. |
| D2 | delay = `Math.ceil(text.length/15)` (1 número) | **dois relógios** (digitação 40ppm + leitura 225ppm) | **spec** | 3 fórmulas diferentes circulando. Frontend sugere o delay pela fórmula da spec e mostra os dois tempos. |
| D3 | Conditional com **2 saídas** (SIM/NÃO) | gate **N-way** com classificador | **spec** | Gates do script têm 3-4 saídas (SIM/objeção/dúvida). 2 handles não expressam G-09. |
| D4 | **não tem** nó de pausa/integração | `action` (auditoria do site) + nó de ação externa (calendário) | **spec** | Sem isso o BLOCO RK-01 (análise do site) e o agendamento não têm onde rodar. |
| D5 | SendMessage só textarea | **variants A/B** por mensagem | **spec** | O script tem MSG-01A/01B etc. Sem variantes, perde o A/B. |
| D6 | só nós lineares + edges | **interrupts globais** (objeção precoce, regra 16) | **spec** | Edge de React Flow não carrega "volte ao ponto de origem". Precisa de convenção: config global de interrupt + engine resolve o retorno; frontend só exibe o bloco de objeção. |

Convergem sem briga: Start (pesquisa/nicho/público), Wait (resposta/timeout — os 2 handles cobrem o timeout dos gates), SetVariable, End/Log → relatório, humanização global no Properties Panel, design system Totum Red.

### 5.2 Encaminhamento
O plano do Lovable está **só frontend, estado local, sem backend** — momento perfeito pra corrigir o I/O dos nós ANTES dele construir os forms. Re-promptar o Lovable com: D1 (tira creative), D2 (fórmula de delay da spec), D3 (Conditional N-way), D4 (nó de ação/integração + action), D5 (variants), D6 (config de interrupt). Os outros nós seguem como ele desenhou.
