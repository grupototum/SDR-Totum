const fs = require('node:fs');
const path = require('node:path');

const STATE_FILE = process.env.SDR_STATE_FILE
  || path.resolve(__dirname, '..', '..', 'sdr-state.json');
const LOCK_FILE = `${STATE_FILE}.lock`;
let lockDepth = 0;

function now() {
  return new Date().toISOString();
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  // Brazilian mobile 13-digit (55+DDD+9+8digits) → canonical 12-digit (55+DDD+8digits).
  if (digits.length === 13 && digits.startsWith('55') && digits[4] === '9') {
    return digits.slice(0, 4) + digits.slice(5);
  }
  return digits;
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8').trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function writeStateUnlocked(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, STATE_FILE);
}

function writeState(state) {
  if (lockDepth > 0) return writeStateUnlocked(state);
  return withStateLock(() => writeStateUnlocked(state));
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withStateLock(fn) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const started = Date.now();
  let fd;
  while (true) {
    try {
      fd = fs.openSync(LOCK_FILE, 'wx');
      fs.writeFileSync(fd, `${process.pid} ${new Date().toISOString()}\n`, 'utf8');
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started > 5000) {
        try {
          const stat = fs.statSync(LOCK_FILE);
          if (Date.now() - stat.mtimeMs > 30000) {
            fs.unlinkSync(LOCK_FILE);
            continue;
          }
        } catch (statError) {
          if (statError.code !== 'ENOENT') throw statError;
        }
        throw new Error(`timeout waiting for sender state lock: ${LOCK_FILE}`);
      }
      sleepSync(25);
    }
  }

  try {
    lockDepth += 1;
    return fn();
  } finally {
    lockDepth -= 1;
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(LOCK_FILE); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function directionOf(direction) {
  const value = String(direction || '').toLowerCase();
  if (value === 'in' || value === 'inbound' || value === 'lead' || value === 'human' || value === 'user') {
    return 'in';
  }
  return 'out';
}

function publicVars(vars = {}) {
  return Object.fromEntries(
    Object.entries(vars || {}).filter(([key]) => !key.startsWith('__')),
  );
}

function ensureSender(state, phone, defaults = {}) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const current = state[normalized] && typeof state[normalized] === 'object' ? state[normalized] : {};
  const updatedAt = current.updatedAt || now();
  const history = Array.isArray(current.history) ? current.history : [];
  if (!history.length && current.lastMsg) {
    history.push({
      direction: 'out',
      msgId: String(current.lastMsg),
      text: String(current.lastText || current.text || ''),
      ts: updatedAt,
    });
  }
  state[normalized] = {
    phone: normalized,
    name: current.name || defaults.name || '',
    remoteJid: current.remoteJid || defaults.remoteJid || `${normalized}@s.whatsapp.net`,
    status: current.status || defaults.status || 'opened',
    awaitUser: typeof current.awaitUser === 'boolean' ? current.awaitUser : defaults.awaitUser === true,
    stage: current.stage || defaults.stage || null,
    flow: current.flow || defaults.flow || process.env.DEFAULT_FLOW_ID || 'sdr-demo',
    history,
    vars: {
      ...(current.vars && typeof current.vars === 'object' ? current.vars : {}),
      ...publicVars(defaults.vars || {}),
    },
    updatedAt,
  };
  return state[normalized];
}

function upsertConversation(conversation) {
  return withStateLock(() => {
    const phone = normalizePhone(conversation?.target?.phone || conversation?.phone);
    if (!phone) return null;
    const state = readState();
    const sender = ensureSender(state, phone, {
      name: conversation.target?.name || '',
      stage: conversation.currentNodeId || conversation.stage || null,
      flow: conversation.flowId,
      vars: conversation.variables || {},
    });
    sender.name = conversation.target?.name || sender.name || '';
    sender.remoteJid = sender.remoteJid || `${phone}@s.whatsapp.net`;
    sender.status = ['completed', 'done'].includes(conversation.status)
      ? 'closed'
      : conversation.status === 'handed_off' ? 'paused' : sender.status || 'opened';
    sender.stage = conversation.currentNodeId || conversation.stage || sender.stage || null;
    sender.flow = conversation.flowId || sender.flow || process.env.DEFAULT_FLOW_ID || 'sdr-demo';
    sender.vars = { ...(sender.vars || {}), ...publicVars(conversation.variables || {}) };
    sender.updatedAt = now();
    writeState(state);
    return sender;
  });
}

function appendHistory(conversation, message) {
  return withStateLock(() => {
    const phone = normalizePhone(conversation?.target?.phone || conversation?.phone);
    if (!phone) return null;
    const state = readState();
    const sender = ensureSender(state, phone, {
      name: conversation.target?.name || '',
      stage: conversation.currentNodeId || conversation.stage || null,
      flow: conversation.flowId,
      vars: conversation.variables || {},
    });

    const item = {
      direction: directionOf(message.direction || message.role || message.sender),
      text: String(message.text || ''),
      ts: message.createdAt || message.created_at || now(),
    };
    const msgId = message.msgId || message.messageId || message.nodeId || message.metadata?.msgId || message.metadata?.nodeId;
    if (item.direction === 'out' && msgId) item.msgId = String(msgId);

    if (item.direction === 'out' && item.msgId) {
      const existing = sender.history.find((entry) => entry?.direction === 'out' && entry?.msgId === item.msgId);
      if (existing) {
        existing.text = item.text || existing.text || '';
        existing.ts = item.ts || existing.ts || now();
        existing.pending = false;
        existing.reservedAt = existing.reservedAt || existing.ts;
        sender.stage = conversation.currentNodeId || conversation.stage || sender.stage || null;
        sender.flow = conversation.flowId || sender.flow || process.env.DEFAULT_FLOW_ID || 'sdr-demo';
        sender.name = conversation.target?.name || sender.name || '';
        sender.vars = { ...(sender.vars || {}), ...publicVars(conversation.variables || {}) };
        sender.updatedAt = now();
        writeState(state);
        return sender;
      }
    }

    sender.history.push(item);
    sender.stage = conversation.currentNodeId || conversation.stage || sender.stage || null;
    sender.flow = conversation.flowId || sender.flow || process.env.DEFAULT_FLOW_ID || 'sdr-demo';
    sender.name = conversation.target?.name || sender.name || '';
    sender.remoteJid = sender.remoteJid || `${phone}@s.whatsapp.net`;
    sender.status = ['completed', 'done'].includes(conversation.status)
      ? 'closed'
      : conversation.status === 'handed_off' ? 'paused' : sender.status || 'opened';
    sender.vars = { ...(sender.vars || {}), ...publicVars(conversation.variables || {}) };
    sender.updatedAt = now();
    writeState(state);
    return sender;
  });
}

function getSender(phone) {
  const state = readState();
  return state[normalizePhone(phone)] || null;
}

function alreadySent(phone, msgId) {
  if (!msgId) return false;
  const sender = getSender(phone);
  if (!sender || !Array.isArray(sender.history)) return false;
  return sender.history.some((item) => item?.direction === 'out' && item?.msgId === String(msgId));
}

function reserveOutbound(phone, msgId, text = '', defaults = {}) {
  if (!msgId) return false;
  return withStateLock(() => {
    const state = readState();
    const sender = ensureSender(state, phone, defaults);
    if (!sender) return false;
    const id = String(msgId);
    const exists = Array.isArray(sender.history)
      && sender.history.some((item) => item?.direction === 'out' && item?.msgId === id);
    if (exists) return false;
    sender.history.push({
      direction: 'out',
      msgId: id,
      text: String(text || ''),
      ts: now(),
      pending: true,
      reservedAt: now(),
    });
    sender.awaitUser = defaults.awaitUser === true ? true : false;
    sender.status = defaults.status || sender.status || 'opened';
    sender.stage = defaults.stage || sender.stage || null;
    sender.flow = defaults.flow || sender.flow || process.env.DEFAULT_FLOW_ID || 'sdr-demo';
    sender.name = defaults.name || sender.name || '';
    sender.remoteJid = sender.remoteJid || defaults.remoteJid || `${sender.phone}@s.whatsapp.net`;
    sender.vars = { ...(sender.vars || {}), ...publicVars(defaults.vars || {}) };
    sender.updatedAt = now();
    writeState(state);
    return true;
  });
}

function updateInbox(phone, updates = {}, defaults = {}) {
  return withStateLock(() => {
    const state = readState();
    const sender = ensureSender(state, phone, defaults);
    if (!sender) return null;
    if (updates.name !== undefined) sender.name = String(updates.name || '');
    if (updates.remoteJid !== undefined) sender.remoteJid = String(updates.remoteJid || `${sender.phone}@s.whatsapp.net`);
    if (updates.status !== undefined) sender.status = String(updates.status || 'opened');
    if (updates.awaitUser !== undefined) sender.awaitUser = updates.awaitUser === true;
    if (updates.stage !== undefined) sender.stage = updates.stage || null;
    if (updates.flow !== undefined) sender.flow = updates.flow || process.env.DEFAULT_FLOW_ID || 'sdr-demo';
    if (updates.vars && typeof updates.vars === 'object') {
      sender.vars = { ...(sender.vars || {}), ...publicVars(updates.vars) };
    }
    sender.updatedAt = now();
    writeState(state);
    return sender;
  });
}

function setAwaitUser(phone, awaitUser, defaults = {}) {
  return updateInbox(phone, { awaitUser }, defaults);
}

module.exports = {
  STATE_FILE,
  appendHistory,
  alreadySent,
  getSender,
  normalizePhone,
  readState,
  reserveOutbound,
  setAwaitUser,
  updateInbox,
  upsertConversation,
  writeState,
};
