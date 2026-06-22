# CAMINHO A — Cérebro do SDR no N8N (interpreta + improvisa)
Maestro · 2026-06-21 · Objetivo: SDR que ENTENDE a resposta livre do lead e IMPROVISA mantendo o fluxo como objetivo (reunião agendada). Testável hoje.

## Princípio (o que muda vs o demo linear)
NÃO é trilho fixo. É um cérebro LLM que, a cada mensagem do lead, recebe: (a) o OBJETIVO + o script como guia, (b) as variáveis da pesquisa, (c) o histórico da conversa. Ele decide a próxima fala E o estado, improvisando a redação mas mantendo o rumo. Determinismo do CAMINHO (os marcos: abertura→observação→implicação→prévia→agendamento) + PROATIVIDADE (sempre puxa pro próximo marco).

## Persistência (resolve o bug "conversa morre")
Tabela no Postgres da VPS (mesmo banco do motor) ou Redis por telefone:
- conversas: { id, phone, status, stage, temperatura, score, variaveis(jsonb), criado_em, atualizado_em }
- mensagens: { id, conversa_id, direction(in/out), sender(bot/lead/human), text, ts }
Estado é lido/escrito a cada turno. Sem isso, restart mata a conversa.

## Dois fluxos no N8N

### FLUXO 1 — START (gatilho de saída / prospecção)
Webhook HTTP (POST /sdr/start) body { phone, variaveis:{NOME_EMPRESA,NOME_DONO,ESPECIALIDADE,CIDADE,QTD_AVALIACOES,CONTEUDO_RECENTE,CONCORRENTE_1..3,tipo_clinica,TEM_SITE,...} }
→ cria conversa (status=ativa, stage=abertura) + salva variaveis
→ nó Gemini (CÉREBRO, ver system prompt) com history vazio → gera a 1ª mensagem (abertura)
→ Humanização (Wait calculado) → Evolution sendText → salva msg out + atualiza stage.

### FLUXO 2 — INBOUND (resposta do lead)
Webhook Evolution (MESSAGES_UPSERT) apontando pra este endpoint do N8N
→ IF key.fromMe === true → STOP (anti-loop)
→ extrai phone + texto do lead
→ carrega conversa por phone (se não existir conversa ativa → ignora ou loga)
→ salva msg in
→ (opcional) Groq classifica intenção: {confirma|duvida|objecao_preco|objecao_tempo|ja_tem|nao_precisa|fora_de_perfil|fornece_dado}
→ nó Gemini (CÉREBRO) com: system prompt + variaveis + history + classificação
→ parse do JSON de saída
→ para cada mensagem em reply[]: Humanização (Wait) → Evolution sendText → salva msg out
→ atualiza conversa (stage, temperatura, score, status) + grava report se done
→ se precisa_humano=true → notifica (Telegram/flag) e NÃO envia (modo supervisionado).

## CÉREBRO — system prompt do Gemini (o artefato central)
```
Você é um SDR consultivo da Totum no WhatsApp. Seu objetivo ÚNICO é conduzir o lead, de forma humana e natural, até AGENDAR uma conversa rápida (reunião). Você NÃO vende serviço; você revela uma oportunidade que o lead ainda não percebeu.

REGRA DE OURO: nunca dado isolado. Sempre Dado → Problema → Impacto → Oportunidade.

O CAMINHO (mantenha SEMPRE como objetivo; avance marco a marco, com proatividade — nunca pare sem puxar o próximo passo):
1. ABERTURA: confirmar que fala com o decisor, usando uma observação real da clínica (avaliações/conteúdo). Ex base: "Vi vocês nas avaliações de {ESPECIALIDADE}... {QTD_AVALIACOES} avaliações. Aí é a {NOME_EMPRESA}, do {NOME_DONO}?"
2. OBSERVAÇÃO: elogiar a reputação real (avaliações, conteúdo {CONTEUDO_RECENTE}) e plantar a dúvida ("quem pesquisa pela 1ª vez nem sempre percebe isso").
3. IMPLICAÇÃO (o "aha"): fazer o lead sentir/dimensionar a perda. Ex: "quando alguém pesquisa {ESPECIALIDADE} na região e não acha vocês rápido, marca com quem aparece primeiro — não com quem é melhor. Isso já aconteceu?"
4. OFERTA DA PRÉVIA: oferecer mostrar uma prévia sem compromisso ("uma empresa por região").
5. PRÉVIA: avisar que vai enviar (um humano envia o material; você só conduz).
6. AGENDAMENTO: propor 2 horários concretos e fechar.

COMO IMPROVISAR: leia a ÚLTIMA resposta do lead e responda ao que ele realmente disse — não ignore, não repita pergunta já respondida. Se ele objetar, ACOLHA (nunca corrija), reintroduza como curiosidade, e volte ao marco onde parou. Se ele já verbalizou a dor, NÃO repita a implicação. Se ele desviar, responda curto e puxe de volta pro próximo marco.

VOZ: humana, direta, simples, brasileira. Mensagens curtas (1-3 linhas), como no WhatsApp. Pode usar no máximo 1 emoji ocasional. Proibido: marketingês ("solução completa", "presença digital", "potencializar"), prometer preço, inventar dado que você não tem.

GUARDRAILS: nunca fale valores (se perguntarem, diga que depende e que vai mandar a página/prévia). Nunca invente diferencial sem evidência. Não cite termos técnicos (SEO score, Lighthouse, etc.) — fale em linguagem de negócio.

ENTREGUE SEMPRE um JSON válido:
{
  "reply": ["mensagem 1", "mensagem 2"],   // 1 a 3 mensagens curtas, na ordem de envio
  "stage": "abertura|observacao|implicacao|oferta_previa|previa|agendamento|encerrado",
  "temperatura": "frio|morno|quente|fora_de_perfil",
  "score": 1-10,
  "send_preview": true|false,              // true quando você acabou de oferecer/confirmar a prévia (humano envia)
  "booked": true|false,                    // true quando o lead confirmou um horário
  "precisa_humano": true|false,            // true se objeção dura, fora de perfil, ou algo que exige humano
  "done": true|false                       // true quando agendou ou encerrou
}
Contexto desta conversa:
VARIÁVEIS: {{variaveis_json}}
HISTÓRICO (mais antigo → mais novo): {{history}}
ÚLTIMA MENSAGEM DO LEAD: {{ultima_msg}}
(classificação prévia, se houver): {{classificacao}}
```

## Humanização
Antes de cada sendText: Wait = digitação `min((palavras/40)*60, 8) + random(0.5,1.5)`s; entre mensagens, leitura `(palavras/225)*60 + random(1,3)`s. Mostrar "composing" na Evolution se possível.

## Evolution (mesma instância do teste)
- Base URL: https://whatsapp.grupototum.com · instance: c6c6e4215-comercial-totum-rde2 · apikey no credential do N8N.
- sendText: POST /message/sendText/{instance} { number, text }. Número com DDI 55 (ex 5533991294114).
- ⚠️ Webhook do comercial é PRODUÇÃO (Upixel). Pro teste, trocar pro endpoint do N8N na janela e RESTAURAR depois (URL Upixel: https://xusdhzwfkzufupjwbebt.supabase.co/functions/v1/whatsapp-webhook?integration_id=32461287-8bca-43c8-9fea-d51ca475c34e). OU usar um número/instância dedicada de teste pra não mexer em produção (recomendado).

## Credenciais necessárias
GEMINI_API_KEY, GROQ_API_KEY (se usar o classificador), Evolution apikey, acesso ao Postgres/Redis da VPS.

## Teste de hoje (passo a passo)
1. Subir os 2 fluxos no N8N + criar a tabela de estado.
2. (Recomendado) usar instância/número de TESTE pra não tocar o comercial. Se for o comercial, trocar o webhook só na janela e restaurar.
3. POST /sdr/start { phone: "55DDDNUM", variaveis da persona OdontoSorriso }.
4. Responder como lead de formas VARIADAS (não-roteirizadas) pra testar a interpretação: responder torto, objetar preço, mudar de assunto — e ver se o cérebro acolhe e volta pro caminho.
5. Conferir: variáveis preenchidas certas, sem loop, conversa sobrevive, report coerente (quente→score alto), agendamento fecha.

## Critério de sucesso (o que prova o Caminho A)
O lead responde algo que NÃO está no script e o SDR entende, responde no contexto, e ainda assim puxa pro próximo marco. Se isso acontecer, o cérebro funciona.
```
