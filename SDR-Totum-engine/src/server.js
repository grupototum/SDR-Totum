const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  addMessage,
  createConversation,
  ensureSchema,
  getConversation,
  getConversationByPhone,
  listConversations,
  listWaitingConversationIds,
  touch,
  listFlows,
  getFlow,
  createFlow,
  updateFlow,
  storeEvents,
} = require('./store');
const { receiveHumanMessage, startConversation, defaultDemoVariables, processNoResponseTimeout } = require('./engine');
const { callBrain } = require('./brain');
const evolution = require('./evolution');
const senderState = require('./sender_state');
const { enqueue: debounceEnqueue, cancel: debounceCancel, DEBOUNCE_ENABLED, pendingCount: debouncePendingCount } = require('./debounce');
const llmProvider         = require('./llm_provider');
const { classifyLlmLogs } = require('./model_alert');
const alertSink            = require('./alert_sink');
const { importScript, exportScript, validateFlow } = require('./script_translator');

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const apiKey = process.env.SDR_API_KEY || '';
const maestroKey = process.env.MAESTRO_API_KEY || '';
const defaultFlowId = process.env.DEFAULT_FLOW_ID || 'sdr-demo';
const sseClients = [];

function now() {
  return new Date().toISOString();
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body, null, 2));
}

function sendHtmlFile(res, filePath, notFoundMessage) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(html);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end(notFoundMessage);
  }
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

storeEvents.on('new_message', (message) => {
  for (const client of sseClients) {
    sendSse(client, 'new_message', message);
  }
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function authRole(req) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const { searchParams } = route(req);
  const queryKey = searchParams.get('api_key') || searchParams.get('token') || '';
  const provided = bearer || req.headers['x-api-key'] || queryKey || '';
  if (!apiKey && !maestroKey) return 'full';
  if (apiKey && provided === apiKey) return 'full';
  if (maestroKey && provided === maestroKey) return 'maestro';
  return null;
}

function route(req) {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  return { pathname: url.pathname, searchParams: url.searchParams };
}

function publicConversation(conversation) {
  return conversation;
}

function stateHistoryToMessages(history = []) {
  return history.map((item, index) => ({
    id: item.msgId || `state-${index}`,
    direction: item.direction === 'in' ? 'in' : 'out',
    role: item.direction === 'in' ? 'lead' : 'bot',
    text: item.text || '',
    transport: null,
    metadata: item.msgId ? { msgId: item.msgId } : {},
    createdAt: item.ts || item.createdAt || null,
  })).filter((item) => item.text);
}

async function createConversationFromSenderState(phone, snapshot) {
  const conversation = await createConversation({
    flowId: snapshot.flow || defaultFlowId,
    target: { phone, name: snapshot.name || '' },
    variables: snapshot.vars || {},
  });
  if (snapshot.stage) conversation.currentNodeId = snapshot.stage;
  conversation.messages = stateHistoryToMessages(snapshot.history);
  await touch(conversation);
  return conversation;
}

async function getOrCreateWebhookConversation(phone, snapshot) {
  const conversation = await getConversationByPhone(phone);
  if (conversation) return conversation;
  if (snapshot) return createConversationFromSenderState(phone, snapshot);
  return createConversation({
    flowId: defaultFlowId,
    target: { phone },
    variables: {},
  });
}

function checkLlmHealth() {
  const logs = llmProvider.flushLogs();
  if (!logs.length) return;
  const health = classifyLlmLogs(logs);
  if (health.level !== 'OK') alertSink.emit(health);
}

async function getWebhookInboxSnapshot(phone, remoteJid, snapshot = null) {
  if (snapshot && typeof snapshot.awaitUser === 'boolean') {
    if (!snapshot.remoteJid && remoteJid) {
      return senderState.updateInbox(phone, { remoteJid }, { remoteJid }) || snapshot;
    }
    return snapshot;
  }

  const conversation = await getConversationByPhone(phone);
  const awaitUser = conversation?.status === 'waiting_input';
  return senderState.updateInbox(phone, {
    awaitUser,
    remoteJid,
    stage: conversation?.currentNodeId || snapshot?.stage || null,
    flow: conversation?.flowId || snapshot?.flow || defaultFlowId,
    vars: conversation?.variables || snapshot?.vars || {},
    status: ['completed', 'done'].includes(conversation?.status)
      ? 'closed'
      : conversation?.status === 'handed_off' ? 'paused' : snapshot?.status || 'opened',
  }, {
    remoteJid,
    stage: snapshot?.stage || null,
    flow: snapshot?.flow || defaultFlowId,
    vars: snapshot?.vars || {},
  });
}

function claimWebhookReply(phone, snapshot = null) {
  return senderState.updateInbox(phone, {
    awaitUser: false,
    status: snapshot?.status || 'opened',
    stage: snapshot?.stage || null,
    flow: snapshot?.flow || defaultFlowId,
    vars: snapshot?.vars || {},
  }, {
    name: snapshot?.name || '',
    remoteJid: snapshot?.remoteJid || `${phone}@s.whatsapp.net`,
    stage: snapshot?.stage || null,
    flow: snapshot?.flow || defaultFlowId,
    vars: snapshot?.vars || {},
  });
}

let noResponseTickRunning = false;

async function runNoResponseTimeoutTick() {
  if (noResponseTickRunning) return { skipped: true, reason: 'tick_already_running' };
  noResponseTickRunning = true;
  const summary = { checked: 0, advanced: 0, closed: 0, skipped: 0, errors: 0 };
  try {
    const ids = await listWaitingConversationIds();
    for (const id of ids) {
      summary.checked += 1;
      try {
        const conversation = await getConversation(id);
        if (!conversation) {
          summary.skipped += 1;
          continue;
        }
        const result = await processNoResponseTimeout({
          conversation,
          sendText: evolution.sendText,
        });
        if (result?.skipped) summary.skipped += 1;
        else if (result?.brain?.no_response_closed) summary.closed += 1;
        else if (result?.outbound?.length) summary.advanced += 1;
      } catch (error) {
        summary.errors += 1;
        console.error('[no-response-tick] failed for session', id, error);
      }
    }
    return summary;
  } finally {
    noResponseTickRunning = false;
  }
}

async function handler(req, res) {
  try {
    const { pathname } = route(req);

    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, { status: 'ok', timestamp: now() });
    }

    if (req.method === 'GET' && pathname === '/conversations') {
      return sendHtmlFile(
        res,
        path.join(__dirname, '..', 'tools', 'conversations.html'),
        'conversations.html nao encontrado',
      );
    }

    if (req.method === 'GET' && pathname === '/api/debug/status') {
      return sendJson(res, 200, {
        debounce_enabled: DEBOUNCE_ENABLED,
        debounce_pending: debouncePendingCount(),
        no_response_tick_running: noResponseTickRunning,
        timestamp: now(),
      });
    }

    if (req.method === 'POST' && pathname === '/api/debug/no-response-tick') {
      const summary = await runNoResponseTimeoutTick();
      return sendJson(res, 200, { ...summary, timestamp: now() });
    }

    // --- /simulator: pagina publica read-only (metricas agregadas, sem segredos) ---
    if (req.method === 'GET' && pathname === '/simulator') {
      return sendHtmlFile(
        res,
        path.join(__dirname, '..', 'tools', 'simulator.html'),
        'simulator.html nao encontrado — rode o harness primeiro',
      );
    }
    // --- /api/sim/report: resumo da ultima bateria (publico, sem reply texts) ---
    if (req.method === 'GET' && pathname === '/api/sim/report') {
      const { searchParams } = route(req);
      const fid = (searchParams.get('flowId') || 'sdr-odonto-stages-v2').replace(/[^a-zA-Z0-9._-]/g, '');
      const f = path.join(__dirname, '..', 'baselines', `${fid}.latest.json`);
      try { return sendJson(res, 200, JSON.parse(fs.readFileSync(f, 'utf8'))); }
      catch { return sendJson(res, 404, { error: 'sem relatorio para este flowId', flowId: fid }); }
    }

    const role = authRole(req);
    if (!role && !pathname.startsWith('/webhooks/')) {
      return sendJson(res, 401, { error: 'unauthorized' });
    }
    if (role === 'maestro' && !(req.method === 'GET' || pathname.startsWith('/api/flows') || pathname.startsWith('/api/sim'))) {
      return sendJson(res, 403, { error: 'forbidden for maestro scope (read + flows only)' });
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      sseClients.push(res);
      req.on('close', () => {
        const index = sseClients.indexOf(res);
        if (index !== -1) sseClients.splice(index, 1);
      });
      return undefined;
    }

    if (req.method === 'POST' && pathname === '/api/conversations/start') {
      const body = await readJson(req);
      if (!body.flowId) return sendJson(res, 400, { error: 'flowId is required' });
      const target = body.target || body.phone || body.number;
      if (!target) return sendJson(res, 400, { error: 'target or phone is required' });

      const conversation = await createConversation({
        flowId: body.flowId,
        target,
        variables: body.variables || {},
      });

      const result = await startConversation({
        conversation,
        sendText: evolution.sendText,
      });

      return sendJson(res, 201, {
        conversationId: conversation.id,
        status: conversation.status,
        brain: result.brain,
        evolution: {
          readyForRealSend: evolution.canSend(),
          mode: process.env.BRIDGE_MODE || 'shadow',
        },
        outbound: result.outbound,
      });
    }

    if (req.method === 'GET' && pathname === '/api/conversations') {
      return sendJson(res, 200, { conversations: await listConversations() });
    }

    const sessionByPhoneMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (req.method === 'GET' && sessionByPhoneMatch) {
      const conversation = await getConversationByPhone(sessionByPhoneMatch[1]);
      if (!conversation) return sendJson(res, 404, { error: 'session not found' });
      return sendJson(res, 200, { session: publicConversation(conversation) });
    }

    if (req.method === 'POST' && pathname === '/api/sessions') {
      const body = await readJson(req);
      const phone = body.phone || body.target?.phone || body.target || body.number;
      if (!phone) return sendJson(res, 400, { error: 'phone is required' });

      const conversation = await createConversation({
        flowId: body.flowId || defaultFlowId,
        target: body.target || { phone, name: body.name || body.variables?.lead_name || '' },
        variables: body.variables || {},
      });

      return sendJson(res, 201, { session: publicConversation(conversation) });
    }

    if (req.method === 'POST' && pathname === '/api/messages') {
      const body = await readJson(req);
      if (!body.sessionId) return sendJson(res, 400, { error: 'sessionId is required' });
      const conversation = await getConversation(body.sessionId);
      if (!conversation) return sendJson(res, 404, { error: 'session not found' });

      const text = String(body.text || body.message || '').trim();
      if (!text) return sendJson(res, 400, { error: 'text is required' });

      const message = await addMessage(conversation, {
        direction: body.direction || 'out',
        sender: body.sender || body.role || body.direction || 'bot',
        role: body.role || body.sender,
        text,
        nodeId: body.nodeId,
        metadata: body.metadata || {},
        transport: body.transport || null,
      });

      return sendJson(res, 201, { message });
    }

    const sessionUpdateMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (req.method === 'PATCH' && sessionUpdateMatch) {
      const conversation = await getConversation(sessionUpdateMatch[1]);
      if (!conversation) return sendJson(res, 404, { error: 'session not found' });

      const body = await readJson(req);
      if (body.stage !== undefined) conversation.currentNodeId = body.stage;
      if (body.currentNodeId !== undefined) conversation.currentNodeId = body.currentNodeId;
      if (body.status !== undefined) conversation.status = body.status;
      if (body.temperature !== undefined) conversation.temperature = body.temperature;
      if (body.temperatura !== undefined) conversation.temperature = body.temperatura;
      if (body.score !== undefined) conversation.score = Number(body.score) || 0;
      if (body.variables !== undefined) {
        conversation.variables = { ...conversation.variables, ...body.variables };
      }

      const updated = await touch(conversation);
      return sendJson(res, 200, { session: publicConversation(updated) });
    }

    const conversationMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (req.method === 'GET' && conversationMatch) {
      const conversation = await getConversation(conversationMatch[1]);
      if (!conversation) return sendJson(res, 404, { error: 'conversation not found' });
      return sendJson(res, 200, { conversation: publicConversation(conversation) });
    }

    const messageMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
    if (req.method === 'GET' && messageMatch) {
      const conversation = await getConversation(messageMatch[1]);
      if (!conversation) return sendJson(res, 404, { error: 'conversation not found' });
      return sendJson(res, 200, { messages: conversation.messages || [] });
    }

    if (req.method === 'POST' && messageMatch) {
      const conversation = await getConversation(messageMatch[1]);
      if (!conversation) return sendJson(res, 404, { error: 'conversation not found' });

      const body = await readJson(req);
      const text = String(body.text || body.message || '').trim();
      if (!text) return sendJson(res, 400, { error: 'text is required' });

      if (body.manual === true || body.direction === 'out') {
        const message = await addMessage(conversation, {
          direction: 'out',
          sender: body.sender || body.role || 'operator',
          role: body.role || body.sender || 'operator',
          text,
          nodeId: body.nodeId,
          metadata: body.metadata || {},
          transport: body.transport || null,
        });
        return sendJson(res, 201, { message });
      }

      const result = await receiveHumanMessage({
        conversation,
        text,
        variables: body.variables || {},
        sendText: evolution.sendText,
      });

      return sendJson(res, 200, {
        conversationId: conversation.id,
        status: conversation.status,
        brain: result.brain,
        outbound: result.outbound,
      });
    }

    const reportMatch = pathname.match(/^\/api\/reports\/([^/]+)$/);
    if (req.method === 'GET' && reportMatch) {
      const conversation = await getConversation(reportMatch[1]);
      if (!conversation) return sendJson(res, 404, { error: 'conversation not found' });

      return sendJson(res, 200, {
        conversationId: conversation.id,
        flowId: conversation.flowId,
        target: conversation.target,
        status: conversation.status,
        temperature: conversation.temperature,
        score: conversation.score,
        variables: conversation.variables,
        optOut: conversation.optOut,
        nodeLog: conversation.nodeLog,
        messages: conversation.messages,
        errors: conversation.errors,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      });
    }

    if (req.method === 'POST' && pathname === '/webhooks/evolution/sdr') {
      const body = await readJson(req);

      // Evolution wraps event in { event, instance, data }
      const data = body.data || body;
      const key = data?.key || {};

      // B4 — anti-loop: ignore messages sent by the bot itself
      if (key.fromMe === true) {
        return sendJson(res, 200, { ignored: true, reason: 'fromMe' });
      }

      // Extract phone: remoteJid = "5531XXXXXXXXX@s.whatsapp.net"
      const remoteJid = key.remoteJid || '';
      const phone = remoteJid.split('@')[0].replace(/\D/g, '');
      if (!phone) {
        return sendJson(res, 400, { error: 'could not extract phone from remoteJid' });
      }

      // Extract text from known Evolution message shapes
      const msg = data?.message || {};
      const text = (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.buttonsResponseMessage?.selectedDisplayText ||
        msg.listResponseMessage?.title ||
        ''
      ).trim();

      if (!text) {
        return sendJson(res, 200, { ignored: true, reason: 'no text content' });
      }

      const senderSnapshot = await getWebhookInboxSnapshot(phone, remoteJid, senderState.getSender(phone));
      if (!senderSnapshot?.awaitUser) {
        return sendJson(res, 200, {
          ignored: true,
          reason: 'awaitUser=false',
          phone,
          stage: senderSnapshot?.stage || null,
        });
      }

      // ── camada de cadência: debounce por phone (DEBOUNCE_ENABLED=true para ativar) ──
      const queued = debounceEnqueue({
        phone,
        text,
        onFlush: async (combinedText) => {
          // refetch: estado pode ter mudado enquanto esperava
          const snapshot = senderState.getSender(phone);
          const conv = await getOrCreateWebhookConversation(phone, snapshot);
          if (['completed', 'done', 'handed_off'].includes(conv.status) || conv.optOut) {
            console.log(`[debounce/flush] phone=${phone} ignorado: ${conv.status}`);
            return;
          }
          await receiveHumanMessage({
            conversation: conv,
            text: combinedText,
            variables: {},
            sendText: evolution.sendText,
          });
          checkLlmHealth();
        },
      });

      if (queued) {
        claimWebhookReply(phone, senderSnapshot);
        // debounce ativo: retorna 200 imediatamente, brain processa após janela
        return sendJson(res, 200, { queued: true, phone, debounce_ms: Number(process.env.DEBOUNCE_MS || 1500) });
      }
      claimWebhookReply(phone, senderSnapshot);

      // debounce desabilitado: caminho original (síncrono)
      let conversation = await getConversationByPhone(phone);
      if (!conversation) {
        conversation = await getOrCreateWebhookConversation(phone, senderSnapshot);

        const result = await receiveHumanMessage({
          conversation,
          text,
          variables: {},
          sendText: evolution.sendText,
        });
        checkLlmHealth();

        return sendJson(res, 201, {
          conversationId: conversation.id,
          status: result.status,
          autoStarted: true,
          flowId: defaultFlowId,
          brain: result.brain,
          outbound: result.outbound,
        });
      }
      if (['completed', 'done', 'handed_off'].includes(conversation.status) || conversation.optOut) {
        return sendJson(res, 200, { ignored: true, reason: `conversation ${conversation.status}` });
      }

      const result = await receiveHumanMessage({
        conversation,
        text,
        variables: {},
        sendText: evolution.sendText,
      });
      checkLlmHealth();

      return sendJson(res, 200, {
        conversationId: conversation.id,
        status: result.status,
        brain: result.brain,
        outbound: result.outbound,
      });
    }

    if (req.method === "GET" && pathname === "/api/flows") {
      return sendJson(res, 200, { flows: await listFlows() });
    }

    const flowMatch = pathname.match(/^\/api\/flows\/([^/]+)$/);
    if (req.method === "GET" && flowMatch) {
      const flow = await getFlow(decodeURIComponent(flowMatch[1]));
      if (!flow) return sendJson(res, 404, { error: "flow not found" });
      return sendJson(res, 200, { flow });
    }

    if (req.method === "POST" && pathname === "/api/flows") {
      const body = await readJson(req);
      const id = body.id || body.flowId;
      if (!id) return sendJson(res, 400, { error: "id is required" });
      const flow = await createFlow({ id, name: body.name || "", niche: body.niche || "", version: body.version || 1, definition: body.definition || body.flow || {}, active: Boolean(body.active) });
      return sendJson(res, 201, { id: flow.id, flow });
    }

    if (req.method === "PUT" && flowMatch) {
      const body = await readJson(req);
      const flow = await updateFlow(decodeURIComponent(flowMatch[1]), { name: body.name, niche: body.niche, version: body.version, definition: body.definition || body.flow, active: body.active });
      if (!flow) return sendJson(res, 404, { error: "flow not found" });
      return sendJson(res, 200, { flow });
    }


    if (req.method === 'POST' && pathname === '/api/sim/turn') {
      const body = await readJson(req);

      // resolve flow override — testa RASCUNHO sem ativar em produção
      let flowOverride = null;
      if (body.flow) {
        const f = body.flow;
        flowOverride = (f && Array.isArray(f.stages)) ? { definition: f } : f;
      } else if (body.flowId) {
        const rec = await getFlow(String(body.flowId));
        if (!rec) return sendJson(res, 404, { error: 'flow not found', flowId: body.flowId });
        flowOverride = { definition: rec.definition };
      }
      // nenhum dos dois -> cai no flow ativo (flowOverride permanece null)

      // history -> shape do brain ({ direction: 'in'|'out', text })
      const history = Array.isArray(body.history) ? body.history.map((m) => {
        const who = String(m.direction || m.role || m.sender || m.from || '');
        const isIn = /in|lead|user|cliente|human/i.test(who);
        return { direction: isIn ? 'in' : 'out', text: String(m.text || m.message || '') };
      }).filter((m) => m.text) : [];

      // variaveis: defaults demo + variaveis do cliente (carrega __objecao_count/__ponto_retorno p/ statelessness)
      const variables = Object.assign({}, defaultDemoVariables(), body.variables || {});

      // sessao sintetica efemera — NAO persistida, NAO enviada
      const session = {
        id: 'sim',
        currentNodeId: body.stage || variables.__stage || undefined,
        score: Number(body.score) || Number(variables.__score) || 1,
        variables,
      };

      const result = await callBrain({
        session,
        history,
        lastMessage: String(body.lastMessage || body.message || ''),
        classificacao: body.classificacao || variables.classificacao || '',
        flowOverride,
      });

      return sendJson(res, 200, {
        reply: result.reply,
        stage_anterior: result.stage_anterior,
        stage_novo: result.stage,
        temperatura: result.temperatura,
        score: result.score,
        send_preview: result.send_preview,
        booked: result.booked,
        precisa_humano: result.precisa_humano,
        done: result.done,
        objecao: result.objecao,
        objecao_count: result.objecao_count,
        clamped: result.clamped,
        // p/ statelessness multi-turno: reenvie isto em "variables" na proxima chamada
        variables: session.variables,
      });
    }


    // ── POST /api/script/validate (validateFlow sem LLM) ───────────────────────
    if (req.method === 'POST' && pathname === '/api/script/validate') {
      const body = await readJson(req);
      if (!body.flow || typeof body.flow !== 'object')
        return sendJson(res, 400, { error: 'flow (object) é obrigatório' });
      const errors = validateFlow(body.flow);
      return sendJson(res, 200, { valid: errors.length === 0, errors });
    }

    // ── POST /api/script/import  (MD → node-graph) ───────────────────────────
    if (req.method === 'POST' && pathname === '/api/script/import') {
      const body = await readJson(req);
      if (!body.script_md || typeof body.script_md !== 'string')
        return sendJson(res, 400, { error: 'script_md (string) é obrigatório' });
      const flow = await importScript(body.script_md.trim());
      // auto-save .spec.md — rastreabilidade grátis, sem LLM
      try {
        const flowId = body.flow_id || (flow && flow.id) || 'unknown';
        const specDir = path.join(__dirname, '..', 'flows');
        fs.mkdirSync(specDir, { recursive: true });
        fs.writeFileSync(path.join(specDir, `${flowId}.spec.md`), body.script_md.trim(), 'utf8');
        console.log(`[script/import] spec salvo: flows/${flowId}.spec.md`);
      } catch (e) {
        console.warn('[script/import] auto-save spec falhou (non-fatal):', e.message);
      }
      return sendJson(res, 200, { flow });
    }

    // ── POST /api/script/export  (node-graph → MD) ───────────────────────────
    if (req.method === 'POST' && pathname === '/api/script/export') {
      const body = await readJson(req);
      if (!body.flow || typeof body.flow !== 'object')
        return sendJson(res, 400, { error: 'flow (object) é obrigatório' });
      const script_md = await exportScript(body.flow);
      return sendJson(res, 200, { script_md });
    }

    return sendJson(res, 404, { error: 'not found' });
  } catch (error) {
    const status = error.status || 500;
    return sendJson(res, status, {
      error: error.message,
      availableFlows: error.availableFlows,
    });
  }
}

const server = http.createServer(handler);

ensureSchema()
  .then(() => {
    server.listen(port, host, () => {
      console.log(`SDR Totum engine listening on http://${host}:${port}`);
    });
    const intervalMs = Number(process.env.NO_RESPONSE_TICK_MS || 5000);
    setInterval(() => {
      runNoResponseTimeoutTick().catch((error) => {
        console.error('[no-response-tick] failed', error);
      });
    }, Math.max(1000, intervalMs)).unref();
  })
  .catch((error) => {
    console.error('Failed to initialize SDR schema:', error);
    process.exit(1);
  });
