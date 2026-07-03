#!/usr/bin/env bash
# Deploy do SDR Totum na VPS. Rodar NA VPS (ou via ssh root@187.127.4.140 'bash -s' < deploy.sh)
# Pré-requisitos na VPS: Node >= 22.13, pm2. Preencher /opt/sdr-totum/.env antes de iniciar.
set -euo pipefail

DEST=/opt/sdr-totum
mkdir -p "$DEST"

# 1) Código (a pasta sdr/ do repo vps-totum é a fonte; ajuste a origem se necessário)
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" pull
else
  echo ">> Copie a pasta sdr/ para $DEST (scp -r sdr/* root@VPS:$DEST/) e rode de novo, ou clone o repo."
  [ -f "$DEST/package.json" ] || exit 1
fi

cd "$DEST"
npm install --omit=dev --no-audit --no-fund

# 2) Ambiente
if [ ! -f .env ]; then
  cp .env.example .env
  echo ">> PREENCHA $DEST/.env (GROQ_API_KEY, EVOLUTION_URL/KEY/INSTANCE) e rode de novo."
  exit 1
fi
set -a; source .env; set +a
: "${GROQ_API_KEY:?GROQ_API_KEY vazia no .env}"
: "${EVOLUTION_URL:?}"; : "${EVOLUTION_KEY:?}"; : "${EVOLUTION_INSTANCE:?}"

# 3) Serviço (bind 127.0.0.1; Evolution na mesma VPS alcança direto)
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save

# 4) Apontar o webhook da instância de TESTE da Evolution para o serviço
curl -sS -X POST "${EVOLUTION_URL%/}/webhook/set/${EVOLUTION_INSTANCE}" \
  -H "Content-Type: application/json" -H "apikey: ${EVOLUTION_KEY}" \
  -d "{\"webhook\":{\"enabled\":true,\"url\":\"http://127.0.0.1:${PORT:-3010}/webhook/evolution\",\"webhook_by_events\":false,\"events\":[\"MESSAGES_UPSERT\"]}}" \
  && echo && echo ">> webhook apontado"

# 5) Smoke test
sleep 1
curl -sf "http://127.0.0.1:${PORT:-3010}/health" && echo && echo ">> SDR no ar"
echo ">> Próximo: node src/ingest.js lista.csv && node src/dispatch.js --limit 1"
