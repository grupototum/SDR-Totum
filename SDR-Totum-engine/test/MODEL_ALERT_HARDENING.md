# Hardening do alerta de modelo — entregue pelo Arquiteto VPS (2026-06-25)
Caso 5 da Fase 2.

## Arquivos alterados/criados nesta sessão
| Arquivo | Tipo | O que mudou |
|---------|------|-------------|
| `src/llm_provider.js` | editado | buffer `_llmLogs` + `_pushLog()` + `flushLogs()`; warn sem-chave antes do `continue`; export `flushLogs` |
| `src/model_alert.js` | editado (mínimo) | `RE_NOKEY` regex + handler no loop (gap sem-chave fechado); era ADITIVO, zero reescrita |
| `src/alert_sink.js` | novo | sink arquivo-de-sinal com throttle 10min por nível (ALERT sobrescreve, WARN append) |
| `src/server.js` | editado | imports + `checkLlmHealth()` + wiring em 3 pontos do webhook evolution/sdr |
| `test/fixtures-model-alert/10-nokey-all-providers.log` | novo | fixture cadeia toda sem chave → ALERT |
| `test/fixtures-model-alert/expectations.json` | editado | adicionado caso 10 → ALERT |

## Regra (inalterada)
- **ALERT** = cadeia esgotada (nenhum sucesso) → falha REAL, paginar.
- **WARN** = recuperou via failover MAS bateu erro persistente (401/auth, 413/payload, sem-chave) → não esconder.
- **OK** = recuperou só com transitório (429/timeout/5xx/vazia) ou sucesso direto.

## Testes: **10/10 passou** (node test/model_alert.test.cjs)
Sintaxe OK em todos os arquivos (node --check).

## Sink de alerta
- **ALERT** → sobrescreve `/tmp/sdr-llm-alert.json` + `console.error [SDR→OPS]`
- **WARN** → append em `/tmp/sdr-llm-digest.jsonl` + `console.warn [SDR→OPS]`
- Throttle: 10 min por nível (configurável via `SDR_ALERT_THROTTLE_MS`)
- Caminhos configuráveis: `SDR_ALERT_FILE`, `SDR_DIGEST_FILE`

## Wiring em server.js
`checkLlmHealth()` chamado após `receiveHumanMessage` em 3 pontos:
1. `onFlush` do debounce (path assíncrono)
2. Nova conversa, path síncrono (retorna 201)
3. Conversa existente, path síncrono (retorna 200)

Não bloqueia resposta ao lead. Não toca Supabase, não toca Evolution.

## ⚠️ AGUARDANDO GO: pm2 reload (escalar para Arquiteto/Rael)
O motor está com `ALLOW_AUTOSEND=true`. O reload em produção é decisão conjunta.

**Para aplicar:**
```bash
PM2_HOME=/root/.pm2 /root/.nvm/versions/node/v22.22.3/bin/pm2 reload 7
```

**Para verificar depois:**
```bash
# Conferir que o processo subiu
PM2_HOME=/root/.pm2 /root/.nvm/versions/node/v22.22.3/bin/pm2 list

# Confirmar que flushLogs está exportado no processo vivo
curl -s http://127.0.0.1:3001/health

# Após um inbound real, verificar sinal:
cat /tmp/sdr-llm-alert.json   # se houve ALERT
cat /tmp/sdr-llm-digest.jsonl # se houve WARN
```

## Gap resolvido nesta sessão
~~Em `llm_provider.js`, provider SEM chave era pulado **silenciosamente**~~ — CORRIGIDO: emite `[llm] ${name} sem chave; pulando` + RE_NOKEY classifica como no_key/persistent/ALERT se cadeia toda cair.
