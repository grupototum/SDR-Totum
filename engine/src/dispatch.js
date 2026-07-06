// Disparo da ABERTURA para leads status=novo. Valida variáveis obrigatórias; sem elas, ABORTA o lead.
// Uso: node src/dispatch.js [--limit N] [--dry-run] [--plan]
//
// Humanização de tráfego (configurável por env, ver .env.example):
//   DISPATCH_RAMP   ramp-up diário por dia de vida do número, ex: "5,8,12,18,25,35,50"
//   JITTER_MIN/MAX  intervalo aleatório (ms) entre aberturas — nunca fixo
//   WINDOW_START/END janela comercial (horário local); fora dela, disparo é adiado
//   INSTANCE_ID     identifica a instância p/ ramp-up e teto diário (default 'default')
// `--plan` imprime o cronograma do dia sem enviar nada.
import { openDb, STATUS, getLeadsByStatus, setLeadState, addMessage,
         dispatchDayOfLife, dispatchSentToday, incrementDispatchCount, getRecentOpenings } from './db.js';
import { think } from './brain.js';
import { missingRequired, validateOutbound, normalizeText } from './guardrails.js';
import { makeEvolutionTransport } from './evolution.js';
import { getFlow } from './flow.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Lido do process.env a cada chamada (não congelado em const no import) — produção só seta a
// env uma vez mesmo, mas os testes precisam mudar DISPATCH_RAMP/WINDOW_*/JITTER_* por caso.
const INSTANCE_ID = () => process.env.INSTANCE_ID || 'default';
const RAMP = () => String(process.env.DISPATCH_RAMP || '5,8,12,18,25,35,50')
  .split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0);
const JITTER_MIN = () => Number(process.env.JITTER_MIN || 300000);
const JITTER_MAX = () => Number(process.env.JITTER_MAX || 900000);
const WINDOW_START = () => process.env.WINDOW_START || '09:00';
const WINDOW_END = () => process.env.WINDOW_END || '19:00';
const ANTI_TEMPLATE_N = () => Number(process.env.ANTI_TEMPLATE_N || 5);
const ANTI_TEMPLATE_THRESHOLD = () => Number(process.env.ANTI_TEMPLATE_THRESHOLD || 0.6);

const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isWeekday = (d) => d.getDay() >= 1 && d.getDay() <= 5;
const parseHM = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
// intervalo [startMins,endMins) com suporte a virada de meia-noite (ex: quiet_hours 22:00-08:00)
const inMinuteRange = (mins, startMins, endMins) =>
  startMins <= endMins ? (mins >= startMins && mins < endMins) : (mins >= startMins || mins < endMins);

export function dailyCap(day) {
  const ramp = RAMP();
  if (ramp.length === 0) return Infinity;
  return ramp[Math.min(day, ramp.length) - 1];
}

export function isWithinDispatchWindow(date, flow) {
  if (!isWeekday(date)) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  if (!inMinuteRange(mins, parseHM(WINDOW_START()), parseHM(WINDOW_END()))) return false;
  const quiet = flow?.globals?.humanization?.quiet_hours;
  if (Array.isArray(quiet) && quiet.length === 2 && inMinuteRange(mins, parseHM(quiet[0]), parseHM(quiet[1]))) {
    return false;
  }
  return true;
}

export function jitterMs(min = JITTER_MIN(), max = JITTER_MAX()) {
  return min + Math.random() * (max - min);
}

// Similaridade por sobreposição de tokens (Jaccard) — pega paráfrase superficial
// (troca de sinônimo mantém a maioria dos tokens), não é NLP pesado nem depende de libs.
const tokenSet = (text) => new Set(normalizeText(text).split(' ').filter((w) => w.length > 2));
function jaccard(a, b) {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}
export function isTooSimilarToRecent(text, recentTexts, threshold = ANTI_TEMPLATE_THRESHOLD()) {
  const set = tokenSet(text);
  return recentTexts.some((r) => jaccard(set, tokenSet(r)) >= threshold);
}

export async function dispatchNewLeads(db, transport, {
  limit = Infinity,
  dryRun = false,
  log = console,
  // false p/ testes/simulador: pula janela comercial, ramp-up e o jitter longo
  // (mantém anti-template, guardrails e dedupe — essas não são "ritmo", são correção).
  humanize = true,
  instanceId = INSTANCE_ID(),
  now = () => new Date(),
  // injetável p/ testes — produção usa o setTimeout real (evita esperar minutos reais em teste).
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const nowDate = now();
  const dateStr = toDateStr(nowDate);

  if (humanize) {
    const flow = getFlow();
    if (!isWithinDispatchWindow(nowDate, flow)) {
      log.info?.('[dispatch] fora da janela comercial/quiet hours — adiado pro próximo horário útil');
      return [];
    }
    const day = dispatchDayOfLife(db, instanceId, dateStr);
    const cap = dailyCap(day);
    const sentToday = dispatchSentToday(db, instanceId, dateStr);
    if (sentToday >= cap) {
      log.info?.(`[dispatch] teto diário atingido (${sentToday}/${cap}, dia ${day} de vida do número)`);
      return [];
    }
    limit = Math.min(limit, cap - sentToday);
  }

  const leads = getLeadsByStatus(db, STATUS.NOVO).slice(0, limit);
  const results = [];
  for (const lead of leads) {
    const missing = missingRequired(lead);
    if (missing.length) {
      setLeadState(db, lead.id, { status: STATUS.ABORTADO, abort_reason: `faltando:${missing.join(',')}` });
      log.warn?.(`[dispatch] ABORTADO ${lead.whatsapp}: faltando ${missing.join(', ')}`);
      results.push({ lead: lead.whatsapp, ok: false, reason: `faltando:${missing.join(',')}` });
      continue;
    }
    try {
      let out = await think(lead, [], {});

      // Anti-template: abertura parecida demais com as últimas enviadas → pede reformulação estrutural.
      const recent = getRecentOpenings(db, ANTI_TEMPLATE_N());
      if (isTooSimilarToRecent(out.mensagem, recent)) {
        log.warn?.(`[dispatch] abertura similar às últimas ${ANTI_TEMPLATE_N()}, pedindo reformulação p/ ${lead.whatsapp}`);
        out = await think(lead, [], {
          retryNote: 'Sua abertura ficou parecida demais com aberturas recentes enviadas a OUTROS leads. Reformule a ESTRUTURA da mensagem (ordem das ideias, gancho inicial, forma da pergunta) — não troque só sinônimos.',
        });
      }

      const check = validateOutbound(out.mensagem, lead, []);
      if (!check.ok) {
        setLeadState(db, lead.id, { status: STATUS.ABORTADO, abort_reason: `guardrail:${check.reason}` });
        log.error?.(`[dispatch] ABORTADO ${lead.whatsapp}: guardrail ${check.reason}`);
        results.push({ lead: lead.whatsapp, ok: false, reason: check.reason });
        continue;
      }
      if (dryRun) {
        log.info?.(`[dry-run] ${lead.whatsapp}: ${out.mensagem}`);
        results.push({ lead: lead.whatsapp, ok: true, dryRun: true, mensagem: out.mensagem });
        continue;
      }
      // Envia em blocos separados (parágrafos) com delay de digitando entre eles.
      const blocos = out.mensagem.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
      for (let i = 0; i < blocos.length; i++) {
        await transport.sendText(lead.whatsapp, blocos[i]);
        addMessage(db, lead.id, 'out', blocos[i]);
        if (i < blocos.length - 1) {
          await sleep(humanize ? Math.min(4000, 1200 + blocos[i].length * 50) : 800);
        }
      }
      setLeadState(db, lead.id, { status: STATUS.EM_CONVERSA, stage: out.stage, temperatura: out.temperatura });
      if (humanize) incrementDispatchCount(db, instanceId, dateStr);
      log.info?.(`[dispatch] enviado p/ ${lead.whatsapp}`);
      results.push({ lead: lead.whatsapp, ok: true });
      // ritmo humano entre leads — irregular (nunca fixo) quando humanizado, curto por padrão nos testes/sim.
      await sleep(humanize ? jitterMs() : 3000 + Math.random() * 5000);
    } catch (e) {
      log.error?.(`[dispatch] ERRO ${lead.whatsapp}: ${e.message} (lead permanece novo p/ retry)`);
      results.push({ lead: lead.whatsapp, ok: false, reason: e.message });
    }
  }
  return results;
}

// Cronograma do dia (sem enviar): quantos cabem na janela a partir de agora e em que horários.
export function planToday(db, instanceId, nowDate) {
  const dateStr = toDateStr(nowDate);
  const day = dispatchDayOfLife(db, instanceId, dateStr);
  const cap = dailyCap(day);
  const sentToday = dispatchSentToday(db, instanceId, dateStr);
  const remaining = Math.max(0, cap - sentToday);

  const windowStart = new Date(nowDate);
  windowStart.setHours(...String(WINDOW_START()).split(':').map(Number), 0, 0);
  const windowEnd = new Date(nowDate);
  windowEnd.setHours(...String(WINDOW_END()).split(':').map(Number), 0, 0);

  let cursor = nowDate < windowStart ? new Date(windowStart) : new Date(nowDate);
  const schedule = [];
  let deferred = 0;
  for (let i = 0; i < remaining; i++) {
    if (i > 0) cursor = new Date(cursor.getTime() + jitterMs());
    if (cursor > windowEnd || !isWeekday(nowDate)) {
      deferred = remaining - i;
      break;
    }
    schedule.push(new Date(cursor));
  }
  return { day, cap, sentToday, remaining, schedule, deferred };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  if (args.includes('--plan')) {
    const db = openDb();
    const plan = planToday(db, INSTANCE_ID(), new Date());
    console.log(`[dispatch --plan] dia ${plan.day} de vida — teto ${plan.cap}, já enviados hoje ${plan.sentToday}`);
    console.log(`[dispatch --plan] ${plan.schedule.length} disparo(s) programados hoje:`);
    for (const t of plan.schedule) console.log(`  - ${t.toLocaleTimeString('pt-BR')}`);
    if (plan.deferred > 0) {
      console.log(`[dispatch --plan] ${plan.deferred} lead(s) ficam pro próximo dia útil (não cabem na janela/teto hoje)`);
    }
  } else {
    const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
    const dryRun = args.includes('--dry-run');
    const db = openDb();
    const transport = dryRun ? { async sendText() {} } : makeEvolutionTransport();
    const r = await dispatchNewLeads(db, transport, { limit, dryRun });
    console.log(`[dispatch] concluído: ${r.filter((x) => x.ok).length}/${r.length} ok`);
  }
}
