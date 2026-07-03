// Estado por lead em SQLite (node:sqlite, zero deps nativas).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const STATUS = {
  NOVO: 'novo',
  EM_CONVERSA: 'em_conversa',
  GANHO: 'ganho',
  HUMANO: 'humano',
  ENCERRADO: 'encerrado',
  ABORTADO: 'abortado',
};

export function openDb(path = process.env.DB_PATH || './data/sdr.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // WAL exige shm (falha em mounts FUSE/rede); cai pra DELETE quando não der.
  try { db.exec('PRAGMA journal_mode = WAL;'); } catch { db.exec('PRAGMA journal_mode = DELETE;'); }
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp TEXT NOT NULL UNIQUE,
      nome_empresa TEXT, nome_dono TEXT, especialidade TEXT, cidade TEXT,
      qtd_avaliacoes TEXT, conteudo_recente TEXT, concorrentes TEXT,
      nota_seo TEXT, tem_site TEXT, notas_pesquisa TEXT,
      status TEXT NOT NULL DEFAULT 'novo',
      stage TEXT NOT NULL DEFAULT 'abertura',
      temperatura TEXT NOT NULL DEFAULT 'morno',
      abort_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL REFERENCES leads(id),
      direction TEXT NOT NULL CHECK (direction IN ('in','out')),
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS processed (
      wa_msg_id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS dispatch_daily (
      instance_id TEXT NOT NULL,
      date TEXT NOT NULL,
      sent_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (instance_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_msgs_lead ON messages(lead_id, id);
  `);
  return db;
}

export const normPhone = (p) => String(p || '').replace(/\D/g, '');

export function upsertLead(db, lead) {
  const whatsapp = normPhone(lead.whatsapp);
  db.prepare(`
    INSERT INTO leads (whatsapp, nome_empresa, nome_dono, especialidade, cidade, qtd_avaliacoes,
                       conteudo_recente, concorrentes, nota_seo, tem_site, notas_pesquisa)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(whatsapp) DO UPDATE SET
      nome_empresa=excluded.nome_empresa, nome_dono=excluded.nome_dono,
      especialidade=excluded.especialidade, cidade=excluded.cidade,
      qtd_avaliacoes=excluded.qtd_avaliacoes, conteudo_recente=excluded.conteudo_recente,
      concorrentes=excluded.concorrentes, nota_seo=excluded.nota_seo,
      tem_site=excluded.tem_site, notas_pesquisa=excluded.notas_pesquisa,
      updated_at=datetime('now')
  `).run(whatsapp, lead.nome_empresa ?? null, lead.nome_dono ?? null, lead.especialidade ?? null,
         lead.cidade ?? null, lead.qtd_avaliacoes ?? null, lead.conteudo_recente ?? null,
         lead.concorrentes ?? null, lead.nota_seo ?? null, lead.tem_site ?? null,
         lead.notas_pesquisa ?? null);
  return getLeadByPhone(db, whatsapp);
}

// WhatsApp BR: o JID pode vir SEM o nono dígito (5533991294114 <-> 553391294114).
// Gera as variantes equivalentes pra matching.
export function phoneVariants(p) {
  const n = normPhone(p);
  const v = new Set([n]);
  if (n.startsWith('55')) {
    if (n.length === 13 && n[4] === '9') v.add(n.slice(0, 4) + n.slice(5)); // remove o 9
    if (n.length === 12) v.add(n.slice(0, 4) + '9' + n.slice(4));          // insere o 9
  }
  return [...v];
}

export const getLeadByPhone = (db, phone) => {
  const vs = phoneVariants(phone);
  return db.prepare(`SELECT * FROM leads WHERE whatsapp IN (${vs.map(() => '?').join(',')})`).get(...vs);
};

export const getLeadsByStatus = (db, status) =>
  db.prepare('SELECT * FROM leads WHERE status = ? ORDER BY id').all(status);

export function setLeadState(db, id, { status, stage, temperatura, abort_reason } = {}) {
  const cur = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  db.prepare(`UPDATE leads SET status=?, stage=?, temperatura=?, abort_reason=?, updated_at=datetime('now') WHERE id=?`)
    .run(status ?? cur.status, stage ?? cur.stage, temperatura ?? cur.temperatura,
         abort_reason ?? cur.abort_reason, id);
}

export function addMessage(db, leadId, direction, text) {
  db.prepare('INSERT INTO messages (lead_id, direction, text) VALUES (?,?,?)').run(leadId, direction, text);
}

export const getHistory = (db, leadId) =>
  db.prepare('SELECT direction, text FROM messages WHERE lead_id = ? ORDER BY id').all(leadId);

export const getSentTexts = (db, leadId) =>
  db.prepare(`SELECT text FROM messages WHERE lead_id = ? AND direction='out' ORDER BY id`).all(leadId).map(r => r.text);

// Dedupe de mensagem do WhatsApp: true = primeira vez.
export function markProcessed(db, waMsgId) {
  if (!waMsgId) return true;
  try { db.prepare('INSERT INTO processed (wa_msg_id) VALUES (?)').run(waMsgId); return true; }
  catch { return false; }
}

// Ramp-up de tráfego por instância: dia de vida = dias desde o 1º registro em dispatch_daily.
export function dispatchDayOfLife(db, instanceId, dateStr) {
  const row = db.prepare('SELECT MIN(date) as first FROM dispatch_daily WHERE instance_id = ?').get(instanceId);
  if (!row?.first) return 1; // ainda não disparou nenhum dia — hoje é o dia 1
  const days = Math.floor((new Date(`${dateStr}T00:00:00Z`) - new Date(`${row.first}T00:00:00Z`)) / 86400000) + 1;
  return Math.max(1, days);
}

export function dispatchSentToday(db, instanceId, dateStr) {
  const row = db.prepare('SELECT sent_count FROM dispatch_daily WHERE instance_id=? AND date=?').get(instanceId, dateStr);
  return row?.sent_count ?? 0;
}

export function incrementDispatchCount(db, instanceId, dateStr) {
  db.prepare(`
    INSERT INTO dispatch_daily (instance_id, date, sent_count) VALUES (?,?,1)
    ON CONFLICT(instance_id, date) DO UPDATE SET sent_count = sent_count + 1
  `).run(instanceId, dateStr);
}

// Últimas N aberturas enviadas (1ª mensagem 'out' de cada lead) — para a checagem anti-template.
export const getRecentOpenings = (db, n) =>
  db.prepare(`
    SELECT m.text FROM messages m
    WHERE m.direction = 'out' AND m.id IN (SELECT MIN(id) FROM messages GROUP BY lead_id)
    ORDER BY m.id DESC LIMIT ?
  `).all(n).map(r => r.text);

// Leads em conversa cuja última mensagem é do lead (resposta pendente) — usado no boot pós-restart.
export const getLeadsAwaitingReply = (db) =>
  db.prepare(`
    SELECT l.* FROM leads l
    WHERE l.status = 'em_conversa' AND (
      SELECT m.direction FROM messages m WHERE m.lead_id = l.id ORDER BY m.id DESC LIMIT 1
    ) = 'in'
  `).all();
