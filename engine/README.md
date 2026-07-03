# SDR Totum — WhatsApp (Evolution + Groq)

Um serviço só (Node + Express + SQLite). Sem n8n, sem flow-builder, sem sub-agente.

Fluxo: lista de empresas → disparo da abertura personalizada → webhook recebe resposta →
cérebro (Groq `llama-3.3-70b-versatile`) conduz o script → prévia aceita/reunião marcada = `ganho`.

## Rodar local

```bash
cd sdr && npm install
cp .env.example .env   # preencher GROQ_API_KEY (e Evolution p/ produção)

npm test               # 8 testes (fromMe, dedupe, debounce, persistência, guardrails)
npm run sim            # simulador: 3 personas conversam com o cérebro, sem WhatsApp
```

Sem `GROQ_API_KEY`, sim/testes rodam com `SDR_LLM=mock` (cérebro determinístico que valida o
encanamento). Com a chave, o simulador usa o Groq de verdade: `SDR_LLM=groq npm run sim`.

## Operação

```bash
node src/ingest.js lista.csv        # carrega a lista (status=novo)
node src/dispatch.js --dry-run      # mostra as aberturas SEM enviar (conferir antes!)
node src/dispatch.js --limit 1      # envia de verdade (comece com 1)
npm start                           # serviço do webhook (responde leads em conversa)
```

CSV: `whatsapp,nome_empresa,nome_dono,especialidade,cidade,qtd_avaliacoes,conteudo_recente,concorrentes,nota_seo,tem_site,notas_pesquisa`.
Sem `nome_empresa|especialidade|cidade|qtd_avaliacoes` reais o lead é **abortado** (nunca sai placeholder).

## Estados do lead

`novo → em_conversa → ganho | humano | encerrado | abortado`
- `ganho`: aceitou prévia + reunião (objetivo).
- `humano`: precisa do Rael (gatekeeper topou encaminhar, recusa precoce, guardrail travou).
- Bot **nunca** responde lead fora de `em_conversa`.

## Modo fila (sem VPS) — como está rodando no teste

A Evolution não persiste mensagens novas e o sandbox não alcança a VPS por SSH, então o
inbound vem por **fila no Supabase**: o webhook da instância posta cada evento em
`sdr_webhook_events` (projeto `totum-system`) e `node src/poller.js` consome e responde.
Precisa no `.env`: `SUPABASE_URL` + `SUPABASE_ANON_KEY`. Eventos persistem: o lead pode
responder a qualquer hora, o poller processa quando estiver de pé.

## Plugar a Evolution (produção na VPS)

1. Copiar `sdr/` para `/opt/sdr-totum`, preencher `.env` (instância de TESTE primeiro).
2. `bash deploy.sh` — instala, sobe via pm2 e aponta o webhook `MESSAGES_UPSERT` da instância
   para `http://127.0.0.1:3010/webhook/evolution` (mesma VPS, sem expor porta).
3. Smoke test: `curl localhost:3010/health` → ingest → `dispatch --dry-run` → `dispatch --limit 1`.

## Guardrails ativos (bugs reais de antes, agora travados por código)

- `fromMe=true` e grupos ignorados (anti-loop) + dedupe por `key.id`.
- Debounce por telefone (`DEBOUNCE_MS`, padrão 4s) agrupa rajadas em uma resposta.
- Placeholder/colchete/"Clínica Exemplo" ⇒ mensagem NUNCA enviada (lead vira `humano`).
- Sem `nome_dono` ⇒ proibido "Dr. Fulano" (nome inventado bloqueia o envio).
- Frase repetida ⇒ 1 retry pedindo reformulação; persistiu ⇒ `humano`.
- Restart no meio da conversa ⇒ `resumePending()` retoma leads com resposta pendente.
