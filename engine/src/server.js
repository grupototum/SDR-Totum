// Serviço único: webhook Evolution + debounce + retomada pós-restart.
import express from 'express';
import { openDb, STATUS, getLeadByPhone, addMessage, markProcessed, normPhone, getLeadsAwaitingReply } from './db.js';
import { respondToLead } from './pipeline.js';
import { makeEvolutionTransport } from './evolution.js';
import { runPersona, personas } from '../sim/run.js';
import { flowPath, resetFlowCache } from './flow.js';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function extractInbound(body) {
  // Evolution v2 messages.upsert. Retorna null p/ tudo que deve ser ignorado (anti-loop).
  const data = body?.data ?? body;
  const key = data?.key;
  if (!key) return null;
  if (key.fromMe === true) return null; // ANTI-LOOP: nunca reagir à própria mensagem
  const remoteJid = key.remoteJid || '';
  if (remoteJid.endsWith('@g.us')) return null; // grupos: fora de escopo
  const text = data?.message?.conversation
    || data?.message?.extendedTextMessage?.text
    || data?.message?.imageMessage?.caption
    || '';
  if (!String(text).trim()) return null;
  return { phone: normPhone(remoteJid.split('@')[0]), text: String(text).trim(), waMsgId: key.id || null };
}

export function createApp({ db, transport, debounceMs = Number(process.env.DEBOUNCE_MS || 4000), log = console }) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const timers = new Map(); // phone -> timeout (debounce)

  function scheduleReply(phone) {
    clearTimeout(timers.get(phone));
    timers.set(phone, setTimeout(async () => {
      timers.delete(phone);
      const lead = getLeadByPhone(db, phone);
      if (!lead) return;
      try {
        const r = await respondToLead(db, transport, lead, log);
        log.info?.(`[reply] ${phone} sent=${r.sent} status=${r.status ?? r.reason}`);
      } catch (e) {
        log.error?.(`[reply] ERRO ${phone}: ${e.message}`);
      }
    }, debounceMs));
  }

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'sdr-totum' }));

  // Auth (Opção A): ENGINE_V3_KEY protege todo /api/*. Sem a env → liberado
  // (dev/local/testes). ⚠️ Em PRODUÇÃO a env TEM que estar setada, senão /api/*
  // fica aberto. /health (inócuo) e /webhook/evolution ficam fora do prefixo de
  // propósito — o webhook é protegido por NÃO ser exposto no Traefik, não por esta chave.
  app.use('/api', (req, res, next) => {
    const key = process.env.ENGINE_V3_KEY;
    if (!key) return next();
    const auth = req.get('authorization') || '';
    const given = auth.startsWith('Bearer ') ? auth.slice(7) : req.get('x-engine-key');
    if (given === key) return next();
    res.status(401).json({ error: { message: 'unauthorized' } });
  });

  // ── Flows do builder: o "banco" é o arquivo em FLOW_PATH (flow único, sempre ativo).
  // GET lista / GET :id / POST / PUT :id — shape que a página /flows do frontend espera.
  const apiError = (res, status, message) => res.status(status).json({ error: { message } });

  function readFlowFile() {
    const p = flowPath();
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    return { def: raw.definition || raw, mtime: statSync(p).mtime };
  }

  function flowSummary(def, mtime) {
    return {
      id: def.id || 'flow',
      name: def.nome || def.name || def.id || 'Flow',
      version: String(def.version || ''),
      niche: def.nicho || def.niche || '',
      updatedAt: mtime.toISOString(),
      active: true, // arquivo único = flow ativo
      definition: def,
    };
  }

  // Valida flow v2 do builder; retorna a definition ou null.
  function extractFlowDef(body) {
    const def = body?.definition || body?.flow || body;
    if (!def || !Array.isArray(def.stages) || !def.stages.length || !def.entry_stage) return null;
    return def;
  }

  app.get('/api/flows', (_req, res) => {
    try {
      const { def, mtime } = readFlowFile();
      res.json([flowSummary(def, mtime)]);
    } catch (e) {
      log.error?.(`[flows] ERRO: ${e.message}`);
      apiError(res, 500, 'falha ao ler o flow');
    }
  });

  app.get('/api/flows/:id', (req, res) => {
    try {
      const { def } = readFlowFile();
      if (req.params.id !== (def.id || 'flow')) return apiError(res, 404, 'flow not found');
      res.json(def); // definition pura: builder.edit exige stages/entry_stage no topo
    } catch (e) {
      log.error?.(`[flows] ERRO: ${e.message}`);
      apiError(res, 500, 'falha ao ler o flow');
    }
  });

  // Publicar do builder: grava o arquivo e derruba o cache — o bot usa na hora.
  app.post('/api/flows', (req, res) => {
    const def = extractFlowDef(req.body);
    if (!def) return apiError(res, 400, 'flow inválido: precisa de stages[] e entry_stage');
    try {
      writeFileSync(flowPath(), JSON.stringify(def, null, 2));
      resetFlowCache();
      log.info?.(`[flows] publicado: ${def.id || 'flow'}`);
      res.status(201).json({ id: def.id || 'flow' });
    } catch (e) {
      log.error?.(`[flows] ERRO: ${e.message}`);
      apiError(res, 500, 'falha ao gravar o flow');
    }
  });

  // PUT: update com definition grava; {active:true} puro (publishFlow) é no-op — arquivo já é o ativo.
  app.put('/api/flows/:id', (req, res) => {
    const hasDef = Boolean(req.body?.definition || req.body?.flow || req.body?.stages);
    if (hasDef) {
      const def = extractFlowDef(req.body);
      if (!def) return apiError(res, 400, 'flow inválido: precisa de stages[] e entry_stage');
      try {
        writeFileSync(flowPath(), JSON.stringify(def, null, 2));
        resetFlowCache();
        log.info?.(`[flows] atualizado: ${def.id || 'flow'}`);
      } catch (e) {
        log.error?.(`[flows] ERRO: ${e.message}`);
        return apiError(res, 500, 'falha ao gravar o flow');
      }
    }
    res.json({ id: req.params.id, active: true, updatedAt: new Date().toISOString() });
  });

  // Simulador do builder: roda 1+ personas contra o flow do canvas (não o arquivo em disco).
  app.get('/api/sim/status', (_req, res) => {
    res.json({ ok: true, realLlmConfigured: Boolean(process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY) });
  });

  app.post('/api/sim/run', async (req, res) => {
    try {
      const { flow: rawFlow, personaId, llm } = req.body || {};
      const flow = rawFlow ? (rawFlow.definition || rawFlow) : undefined;
      const selected = personaId ? personas.filter((p) => p.id === personaId) : personas;
      if (!selected.length) {
        return res.status(400).json({ ok: false, error: `persona desconhecida: ${personaId}` });
      }
      // Sequencial (não paralelo): runPersona usa override de flow/LLM em memória, global ao processo.
      const results = [];
      for (const p of selected) {
        const r = await runPersona(p, { flow, llm });
        results.push({
          id: r.id,
          label: r.label,
          status: r.status,
          stage: r.stage,
          temperatura: r.temperatura,
          trocas: r.trocas,
          transcript: r.log,
          violations: r.violations,
          passed: r.violations.length === 0,
        });
      }
      res.json({ ok: true, results });
    } catch (e) {
      log.error?.(`[sim] ERRO: ${e.message}`);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/webhook/evolution', (req, res) => {
    res.json({ ok: true }); // responde já; processamento é assíncrono
    try {
      const inbound = extractInbound(req.body);
      if (!inbound) return;
      if (!markProcessed(db, inbound.waMsgId)) return; // dedupe
      const lead = getLeadByPhone(db, inbound.phone);
      if (!lead) { log.info?.(`[webhook] ignorado: ${inbound.phone} não é lead`); return; }
      if (![STATUS.EM_CONVERSA].includes(lead.status)) {
        addMessage(db, lead.id, 'in', inbound.text); // registra, mas não responde (ganho/humano/encerrado)
        log.info?.(`[webhook] ${inbound.phone} status=${lead.status}: registrado sem resposta`);
        return;
      }
      addMessage(db, lead.id, 'in', inbound.text);
      scheduleReply(inbound.phone); // debounce: agrupa mensagens rápidas
    } catch (e) {
      log.error?.(`[webhook] ERRO: ${e.message}`);
    }
  });

  // Retomada pós-restart: leads em conversa com inbound sem resposta voltam pra fila.
  app.resumePending = () => {
    for (const lead of getLeadsAwaitingReply(db)) {
      log.info?.(`[resume] retomando conversa com ${lead.whatsapp}`);
      scheduleReply(lead.whatsapp);
    }
  };

  return app;
}

// Execução direta (produção). PM2 em fork pode trocar process.argv[1];
// pm_exec_path aponta para o script real configurado no app.
const entrypoint = process.env.pm_exec_path || process.argv[1];
const runningAsEntrypoint = entrypoint && fileURLToPath(import.meta.url) === resolve(entrypoint);
const runningUnderPm2 = process.env.pm_id !== undefined;
if (runningUnderPm2 || runningAsEntrypoint) {
  const db = openDb();
  const transport = makeEvolutionTransport();
  const app = createApp({ db, transport });
  const port = Number(process.env.PORT || 3010);
  const host = process.env.HOST || '127.0.0.1';
  app.listen(port, host, () => {
    console.log(`SDR Totum ouvindo em ${host}:${port}`);
    app.resumePending();
  });
}
