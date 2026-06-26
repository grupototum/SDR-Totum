const { Pool } = require('pg');
const senderState = require('./sender_state');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for SDR persistence');
}

const pool = new Pool({ connectionString: databaseUrl });
let schemaReady;

function now() {
  return new Date().toISOString();
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  // Brazilian mobile 13-digit (55+DDD+9+8digits) → canonical 12-digit (55+DDD+8digits).
  // Same physical number, just the 9th digit was added to mobile numbers post-2012.
  if (digits.length === 13 && digits.startsWith('55') && digits[4] === '9') {
    return digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}

function dbStatus(conversation) {
  if (conversation.optOut) return 'opted_out';
  if (conversation.status === 'frio') return 'completed';
  if (conversation.status === 'completed' || conversation.status === 'done') return 'completed';
  return 'active';
}

function publicStatus(row) {
  const variables = row.variables || {};
  if (variables.__engineStatus) return variables.__engineStatus;
  return row.status === 'active' ? 'created' : row.status;
}

function serializeVariables(conversation) {
  return {
    ...(conversation.variables || {}),
    __engineStatus: conversation.status,
    __errors: conversation.errors || [],
    __flowId: conversation.flowId,
    __nodeLog: conversation.nodeLog || [],
    __optOut: Boolean(conversation.optOut),
    __targetName: conversation.target?.name || '',
    __targetRaw: conversation.target?.raw || null,
  };
}

function publicVariables(variables = {}) {
  return Object.fromEntries(
    Object.entries(variables).filter(([key]) => !key.startsWith('__')),
  );
}

function rowToConversation(row, messages = []) {
  const variables = row.variables || {};
  const phone = normalizePhone(row.phone);

  return {
    id: row.id,
    flowId: variables.__flowId || process.env.DEFAULT_FLOW_ID || 'sdr-demo',
    target: {
      phone,
      name: variables.__targetName || variables.lead_name || '',
      raw: variables.__targetRaw || { phone },
    },
    variables: publicVariables(variables),
    status: publicStatus(row),
    currentNodeId: row.stage || null,
    temperature: row.temperature || 'frio',
    score: row.score || 0,
    booked: Boolean(variables.__brain?.booked),
    done: Boolean(variables.__brain?.done),
    precisaHumano: Boolean(variables.__brain?.precisa_humano),
    sendPreview: Boolean(variables.__brain?.send_preview),
    optOut: Boolean(variables.__optOut || row.status === 'opted_out'),
    messages,
    nodeLog: variables.__nodeLog || [],
    errors: variables.__errors || [],
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

function rowToMessage(row) {
  return {
    id: row.id,
    direction: row.direction,
    role: row.sender,
    text: row.text || '',
    transport: null,
    metadata: row.node_id ? { nodeId: row.node_id } : {},
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

async function loadMessages(sessionId) {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, direction, sender, text, node_id, created_at
       FROM sdr_messages
      WHERE session_id = $1
      ORDER BY created_at ASC`,
    [sessionId],
  );
  return result.rows.map(rowToMessage);
}

async function createConversation({ flowId, target, variables = {} }) {
  await ensureSchema();
  const targetPhone = typeof target === 'string' ? target : target?.phone || target?.number;
  const targetName = typeof target === 'object' ? target.name : undefined;
  const phone = normalizePhone(targetPhone);
  const conversationVariables = {
    ...variables,
    __engineStatus: 'created',
    __errors: [],
    __flowId: flowId,
    __nodeLog: [],
    __optOut: false,
    __targetName: targetName || variables.lead_name || '',
    __targetRaw: target || { phone },
  };

  const result = await pool.query(
    `INSERT INTO sdr_sessions (phone, status, stage, temperature, score, variables)
     VALUES ($1, 'active', NULL, 'frio', 0, $2::jsonb)
     RETURNING *`,
    [phone, JSON.stringify(conversationVariables)],
  );

  const conversation = rowToConversation(result.rows[0], []);
  senderState.upsertConversation(conversation);
  return conversation;
}

async function listConversations() {
  await ensureSchema();
  const result = await pool.query(
    `SELECT *
       FROM sdr_sessions
      ORDER BY created_at DESC`,
  );

  return result.rows.map((row) => {
    const conversation = rowToConversation(row);
    return {
      id: conversation.id,
      flowId: conversation.flowId,
      target: conversation.target,
      status: conversation.status,
      currentNodeId: conversation.currentNodeId,
      temperature: conversation.temperature,
      score: conversation.score,
      optOut: conversation.optOut,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  });
}

async function listWaitingConversationIds() {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id
       FROM sdr_sessions
      WHERE status = 'active'
        AND variables->>'__engineStatus' = 'waiting_input'
      ORDER BY updated_at ASC`,
  );
  return result.rows.map((row) => row.id);
}

async function getConversation(id) {
  await ensureSchema();
  const result = await pool.query('SELECT * FROM sdr_sessions WHERE id = $1', [id]);
  if (!result.rows[0]) return null;
  return rowToConversation(result.rows[0], await loadMessages(id));
}

async function getConversationByPhone(phone) {
  await ensureSchema();
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const result = await pool.query(
    `SELECT *
       FROM sdr_sessions
      WHERE phone = $1
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1`,
    [normalized],
  );

  if (!result.rows[0]) return null;
  return rowToConversation(result.rows[0], await loadMessages(result.rows[0].id));
}

async function updateConversation(id, updates = {}) {
  const current = await getConversation(id);
  if (!current) return null;

  if (updates.current_node !== undefined) {
    updates.currentNodeId = updates.current_node;
    delete updates.current_node;
  }

  Object.assign(current, updates);
  return touch(current);
}

async function touch(conversation) {
  await ensureSchema();
  conversation.updatedAt = now();

  const result = await pool.query(
    `UPDATE sdr_sessions
        SET status = $2,
            stage = $3,
            temperature = $4,
            score = $5,
            variables = $6::jsonb,
            updated_at = now()
      WHERE id = $1
      RETURNING *`,
    [
      conversation.id,
      dbStatus(conversation),
      conversation.currentNodeId,
      conversation.temperature,
      conversation.score,
      JSON.stringify(serializeVariables(conversation)),
    ],
  );

  const updated = rowToConversation(result.rows[0], conversation.messages || []);
  senderState.upsertConversation(updated);
  return updated;
}

async function addMessage(conversation, message) {
  await ensureSchema();
  const result = await pool.query(
    `INSERT INTO sdr_messages (session_id, direction, sender, text, node_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, direction, sender, text, node_id, created_at`,
    [
      conversation.id,
      message.direction,
      message.role || message.sender || message.direction,
      message.text || '',
      message.nodeId || conversation.currentNodeId || null,
    ],
  );

  const item = {
    ...rowToMessage(result.rows[0]),
    transport: message.transport || null,
    metadata: message.metadata || {},
  };

  if (!Array.isArray(conversation.messages)) conversation.messages = [];
  conversation.messages.push(item);
  senderState.appendHistory(conversation, {
    ...item,
    msgId: message.msgId,
    nodeId: message.nodeId || conversation.currentNodeId || null,
  });
  await touch(conversation);
  return item;
}

async function addNodeLog(conversation, nodeId, node, extra = {}) {
  await ensureSchema();
  conversation.nodeLog.push({
    nodeId,
    type: node?.type || 'unknown',
    at: now(),
    ...extra,
  });
  await touch(conversation);
}

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS sdr_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        phone text NOT NULL,
        status text NOT NULL DEFAULT 'active',
        stage text DEFAULT 'abertura',
        temperature text,
        score integer DEFAULT 0,
        variables jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS sdr_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL REFERENCES sdr_sessions(id) ON DELETE CASCADE,
        direction text NOT NULL,
        sender text NOT NULL,
        text text,
        node_id text,
        created_at timestamptz DEFAULT now()
      );

      ALTER TABLE sdr_sessions ADD COLUMN IF NOT EXISTS stage text DEFAULT 'abertura';
      ALTER TABLE sdr_sessions ADD COLUMN IF NOT EXISTS temperature text;
      ALTER TABLE sdr_sessions ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
      ALTER TABLE sdr_sessions ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb;

      CREATE INDEX IF NOT EXISTS idx_sdr_sessions_phone_status ON sdr_sessions (phone, status);
      CREATE INDEX IF NOT EXISTS idx_sdr_messages_session ON sdr_messages (session_id, created_at);

      CREATE TABLE IF NOT EXISTS sdr_flows (
        id text PRIMARY KEY,
        name text NOT NULL DEFAULT '',
        definition jsonb NOT NULL DEFAULT '{}'::jsonb,
        active boolean NOT NULL DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_flows_active ON sdr_flows (active) WHERE active = true;
      ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS niche text DEFAULT '';
      ALTER TABLE sdr_flows ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
    `);
  }
  return schemaReady;
}

async function listFlows() {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, name, niche, version, active, created_at, updated_at FROM sdr_flows ORDER BY active DESC, updated_at DESC`,
  );
  return result.rows.map((r) => ({
    id: r.id, name: r.name, niche: r.niche || '', version: r.version || 1, active: r.active,
    createdAt: r.created_at?.toISOString?.() || r.created_at,
    updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
  }));
}

async function getFlow(id) {
  await ensureSchema();
  const result = await pool.query(`SELECT * FROM sdr_flows WHERE id = $1`, [id]);
  const r = result.rows[0];
  if (!r) return null;
  return { id: r.id, name: r.name, niche: r.niche || '', version: r.version || 1, definition: r.definition || {}, flow: r.definition || {}, active: r.active,
    createdAt: r.created_at?.toISOString?.() || r.created_at,
    updatedAt: r.updated_at?.toISOString?.() || r.updated_at };
}

async function getActiveFlow() {
  await ensureSchema();
  const result = await pool.query(`SELECT * FROM sdr_flows WHERE active = true LIMIT 1`);
  const r = result.rows[0];
  if (!r) return null;
  return { id: r.id, name: r.name, definition: r.definition || {}, active: true };
}

async function createFlow({ id, name = "", niche = "", version = 1, definition = {}, active = false }) {
  await ensureSchema();
  if (!id) throw new Error("flow id is required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (active) await client.query(`UPDATE sdr_flows SET active = false, updated_at = now() WHERE active = true`);
    await client.query(
      `INSERT INTO sdr_flows (id, name, niche, version, definition, active) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, niche = EXCLUDED.niche, version = EXCLUDED.version, definition = EXCLUDED.definition, active = EXCLUDED.active, updated_at = now()`,
      [id, name, niche, version, JSON.stringify(definition), Boolean(active)],
    );
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return getFlow(id);
}

async function updateFlow(id, { name, niche, version, definition, active } = {}) {
  await ensureSchema();
  const existing = await getFlow(id);
  if (!existing) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (active === true) await client.query(`UPDATE sdr_flows SET active = false, updated_at = now() WHERE active = true AND id <> $1`, [id]);
    await client.query(
      `UPDATE sdr_flows SET name = $2, niche = $3, version = $4, definition = $5::jsonb, active = $6, updated_at = now() WHERE id = $1`,
      [id, name !== undefined ? name : existing.name,
       niche !== undefined ? niche : existing.niche,
       version !== undefined ? version : existing.version,
       JSON.stringify(definition !== undefined ? definition : existing.definition),
       active !== undefined ? Boolean(active) : existing.active],
    );
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return getFlow(id);
}


module.exports = {
  addMessage,
  addNodeLog,
  createConversation,
  ensureSchema,
  getConversation,
  getConversationByPhone,
  listConversations,
  listWaitingConversationIds,
  touch,
  updateConversation,
  listFlows,
  getFlow,
  getActiveFlow,
  createFlow,
  updateFlow,
};
