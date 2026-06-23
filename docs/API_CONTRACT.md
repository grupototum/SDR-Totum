# API_CONTRACT.md — Plataforma SDR Totum ↔ Motor (VPS)

Contrato único entre o FRONTEND (grupototum/SDR-Totum) e o MOTOR (SDR-Totum-engine), na VPS.
Backend = Express + Postgres + Redis na VPS (187.127.4.140). ZERO Supabase.
Escopo: demo. Auth = NENHUMA por ora (adicionar depois). Realtime = polling (sem WS no demo).

Base URL (config no frontend via VITE_API_BASE_URL):

- Dev/mock: mock local (sem rede)
- VPS: http://127.0.0.1:3000 (ou domínio que faça proxy de /api → :3000)
  Todas as rotas abaixo são prefixadas por /api, exceto /health.

═══════════════════════════════════════════
HEALTH
═══════════════════════════════════════════
GET /health → 200 { "status": "ok", "version": "x.y.z" }

═══════════════════════════════════════════
FLOWS (persistência do Flow Builder no Postgres)
═══════════════════════════════════════════
GET /api/flows → 200 [ { id, name, version, niche, updatedAt } ]
GET /api/flows/:id → 200 { ...envelope completo do flow JSON (FLOW_FORMAT_SPEC) }
POST /api/flows → body: { ...envelope flow JSON } → 201 { id }
PUT /api/flows/:id → body: { ...envelope flow JSON } → 200 { id, updatedAt }
Regra: o backend persiste o flow JSON inteiro (lossless, incl. changelog/opening_variations/loop_guards). O frontend NÃO perde campos que não tem UI.

═══════════════════════════════════════════
CONVERSATIONS (console human-in-the-loop)
═══════════════════════════════════════════
GET /api/conversations?status= → 200 [ {
id, empresa, numero, status, // status: ativa|aguardando|encerrada
temperatura, // frio|morno|quente|fora_de_perfil
ondeTravou, lastMessageAt
} ]
GET /api/conversations/:id → 200 {
id, status, temperatura,
lead: { empresa, numero, nomeDono, variaveis:{...} },
messages: [ { id, direction, sender, text, ts, nodeId } ],
// direction: inbound|outbound ; sender: bot|human|lead
report: { ...REPORT SCHEMA } | null
}
POST /api/conversations/:id/messages → body: { text } → 201 { id } // enviar COMO HUMANO (human-in-the-loop)
POST /api/conversations/:id/takeover → 200 { ok } // pausa o bot, humano assume
POST /api/conversations/:id/resume → 200 { ok } // devolve pro bot

═══════════════════════════════════════════
TRIGGER (gatilho de saída — o SDR é prospector, ELE inicia)
═══════════════════════════════════════════
POST /api/conversations/start → body: {
flowId,
target, // número E.164, ex: 5545999999999
variables: { // variáveis de pesquisa exigidas pelo flow
NOME_EMPRESA, NOME_DONO, ESPECIALIDADE, CIDADE,
QTD_AVALIACOES, CONTEUDO_RECENTE,
CONCORRENTE_1, CONCORRENTE_2, CONCORRENTE_3, tipo_clinica
}
} → 201 { conversationId }
Efeito: o motor injeta as variáveis, executa o nó entry (msg01) e dispara a 1ª mensagem via Evolution.

═══════════════════════════════════════════
REPORTS
═══════════════════════════════════════════
GET /api/reports → 200 [ { conversationId, empresa, resultado, temperatura, score, agendou, criadoEm } ]
GET /api/reports/:conversationId → 200 { ...REPORT SCHEMA }

REPORT SCHEMA: empresa, resultado (reuniao_marcada|rejeitado|followup), temperatura (frio|morno|quente|fora_de_perfil),
score (1-10), abriu_pela_observacao (bool), gatilho_preview (bool), agendou (bool), objecoes (array),
resumo (string), transcript (array), proxima_acao (string), onde_travou (string).

═══════════════════════════════════════════
ERROS (padrão)
═══════════════════════════════════════════
Erro → { error: { code, message } } com HTTP status apropriado (400/404/409/500).

═══════════════════════════════════════════
COMO "CONECTAR" (a promessa do plug-and-play)
═══════════════════════════════════════════
Frontend tem UMA camada de acesso a dados (ex: src/api/\*) com duas implementações:

- mock (default em dev): devolve dados fixos, incl. flow_odonto_sdr_v1.json e conversas/relatórios fake.
- http: bate nas rotas acima.
  Trocar via VITE_API_BASE_URL: vazio = mock; preenchido = http real na VPS.
  Conectar de verdade = setar a env var. Nenhuma reescrita de tela.
