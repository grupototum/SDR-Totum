import sys,time,os
D="/root/.openclaw/workspace-paulo/SDR-Totum-engine/src"
ts=time.strftime("%Y%m%d_%H%M%S")
def patch(fn, repls):
    p=os.path.join(D,fn)
    s=open(p,encoding="utf-8").read()
    open(p+".bak-flows-"+ts,"w",encoding="utf-8").write(s)
    for old,new in repls:
        if old not in s:
            print("ANCHOR NAO ENCONTRADO em",fn,"->",repr(old[:60])); sys.exit(2)
        s=s.replace(old,new,1)
    open(p,"w",encoding="utf-8").write(s)
    print("patched",fn)

store_funcs = '''
async function listFlows() {
  await ensureSchema();
  const result = await pool.query(
    `SELECT id, name, active, created_at, updated_at FROM sdr_flows ORDER BY active DESC, updated_at DESC`,
  );
  return result.rows.map((r) => ({
    id: r.id, name: r.name, active: r.active,
    createdAt: r.created_at?.toISOString?.() || r.created_at,
    updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
  }));
}

async function getFlow(id) {
  await ensureSchema();
  const result = await pool.query(`SELECT * FROM sdr_flows WHERE id = $1`, [id]);
  const r = result.rows[0];
  if (!r) return null;
  return { id: r.id, name: r.name, definition: r.definition || {}, active: r.active,
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

async function createFlow({ id, name = "", definition = {}, active = false }) {
  await ensureSchema();
  if (!id) throw new Error("flow id is required");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (active) await client.query(`UPDATE sdr_flows SET active = false, updated_at = now() WHERE active = true`);
    await client.query(
      `INSERT INTO sdr_flows (id, name, definition, active) VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, definition = EXCLUDED.definition, active = EXCLUDED.active, updated_at = now()`,
      [id, name, JSON.stringify(definition), Boolean(active)],
    );
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return getFlow(id);
}

async function updateFlow(id, { name, definition, active } = {}) {
  await ensureSchema();
  const existing = await getFlow(id);
  if (!existing) return null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (active === true) await client.query(`UPDATE sdr_flows SET active = false, updated_at = now() WHERE active = true AND id <> $1`, [id]);
    await client.query(
      `UPDATE sdr_flows SET name = $2, definition = $3::jsonb, active = $4, updated_at = now() WHERE id = $1`,
      [id, name !== undefined ? name : existing.name,
       JSON.stringify(definition !== undefined ? definition : existing.definition),
       active !== undefined ? Boolean(active) : existing.active],
    );
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  return getFlow(id);
}

'''

schema_add = '''      CREATE INDEX IF NOT EXISTS idx_sdr_messages_session ON sdr_messages (session_id, created_at);

      CREATE TABLE IF NOT EXISTS sdr_flows (
        id text PRIMARY KEY,
        name text NOT NULL DEFAULT '',
        definition jsonb NOT NULL DEFAULT '{}'::jsonb,
        active boolean NOT NULL DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sdr_flows_active ON sdr_flows (active) WHERE active = true;'''

patch("store.js", [
  ("      CREATE INDEX IF NOT EXISTS idx_sdr_messages_session ON sdr_messages (session_id, created_at);", schema_add),
  ("\nmodule.exports = {", store_funcs + "\nmodule.exports = {"),
  ("  updateConversation,\n};", "  updateConversation,\n  listFlows,\n  getFlow,\n  getActiveFlow,\n  createFlow,\n  updateFlow,\n};"),
])

flow_routes = '''    if (req.method === "GET" && pathname === "/api/flows") {
      return sendJson(res, 200, { flows: await listFlows() });
    }

    const flowMatch = pathname.match(/^\\/api\\/flows\\/([^/]+)$/);
    if (req.method === "GET" && flowMatch) {
      const flow = await getFlow(decodeURIComponent(flowMatch[1]));
      if (!flow) return sendJson(res, 404, { error: "flow not found" });
      return sendJson(res, 200, { flow });
    }

    if (req.method === "POST" && pathname === "/api/flows") {
      const body = await readJson(req);
      const id = body.id || body.flowId;
      if (!id) return sendJson(res, 400, { error: "id is required" });
      const flow = await createFlow({ id, name: body.name || "", definition: body.definition || body.flow || {}, active: Boolean(body.active) });
      return sendJson(res, 201, { flow });
    }

    if (req.method === "PUT" && flowMatch) {
      const body = await readJson(req);
      const flow = await updateFlow(decodeURIComponent(flowMatch[1]), { name: body.name, definition: body.definition || body.flow, active: body.active });
      if (!flow) return sendJson(res, 404, { error: "flow not found" });
      return sendJson(res, 200, { flow });
    }

    return sendJson(res, 404, { error: 'not found' });'''

patch("server.js", [
  ("  touch,\n} = require('./store');", "  touch,\n  listFlows,\n  getFlow,\n  createFlow,\n  updateFlow,\n} = require('./store');"),
  ("    return sendJson(res, 404, { error: 'not found' });", flow_routes),
])

brain_helpers = '''const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getActiveFlow } = require('./store');

function buildRoteiro(definition = {}) {
  const nodes = (definition && definition.nodes) || {};
  const out = [];
  for (const n of Object.values(nodes)) {
    if (!n) continue;
    let t = n.text || n.message || n.content || '';
    if (!t && Array.isArray(n.messages)) t = n.messages.join(' ');
    if (t && String(t).trim()) out.push(String(t).trim());
  }
  return out.slice(0, 40);
}'''

brain_old = '''  const prompt = SYSTEM_PROMPT
    .replace('{{variaveis_json}}', vars)
    .replace('{{history}}', histText || '(sem histórico ainda)')
    .replace('{{ultima_msg}}', lastMessage || '')
    .replace('{{classificacao}}', classificacao || '');'''

brain_new = '''  let roteiroBlock = '';
  try {
    const activeFlow = await getActiveFlow();
    if (activeFlow) {
      const linhas = buildRoteiro(activeFlow.definition);
      if (linhas.length) {
        roteiroBlock = `\\n\\nROTEIRO ATIVO "${activeFlow.name || activeFlow.id}" - use como TRILHO (siga a ordem e a intencao destes passos, adaptando a fala a conversa real; nao copie literal se nao couber):\\n` + linhas.map((l, i) => `${i + 1}. ${l}`).join('\\n');
      }
    }
  } catch (e) { /* sem flow ativo: usa o roteiro padrao */ }

  const prompt = SYSTEM_PROMPT
    .replace('{{variaveis_json}}', vars)
    .replace('{{history}}', histText || '(sem histórico ainda)')
    .replace('{{ultima_msg}}', lastMessage || '')
    .replace('{{classificacao}}', classificacao || '') + roteiroBlock;'''

patch("brain.js", [
  ("const { GoogleGenerativeAI } = require('@google/generative-ai');", brain_helpers),
  (brain_old, brain_new),
])
print("OK todos os patches aplicados")
