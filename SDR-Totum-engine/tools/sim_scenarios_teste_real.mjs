#!/usr/bin/env node
// sim_scenarios_teste_real.mjs — validação obrigatória pré-WhatsApp (teste real 28/06).
// Roda 3 cenários no simulador embutido (POST /api/sim/turn — não envia nada, usa LLM_CHAIN_SIM):
//   1. decisor interessado  → deve chegar na prévia/agendamento
//   2. cético ("quem é você?") → bot se apresenta e volta ao fluxo
//   3. secretária (gatekeeper)  → muda de abordagem, não repete pitch
// Critérios (hard-fail): ZERO {{placeholder}}, ZERO literal de demo, ZERO frase repetida do bot.
// Heurística (warn): nomes próprios fora das variáveis (nome inventado tipo "Milena").
//
// Uso (na VPS, onde estão as chaves):
//   node tools/sim_scenarios_teste_real.mjs [flowId] [arquivo-vars.json]
//   flowId default: sdr-odonto-stages-v2
//   arquivo-vars.json: variáveis REAIS de 1 clínica (obrigatório pra validação oficial)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const out = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('='); if (i < 0) continue;
      out[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, '');
    }
  } catch {}
  return out;
}
const env = loadEnv();
const PORT = process.env.PORT || env.PORT || '3002';
const KEY = process.env.SDR_API_KEY || env.SDR_API_KEY || '';
const ENDPOINT = process.env.SIM_ENDPOINT || `http://127.0.0.1:${PORT}/api/sim/turn`;
const MAX_TURNS = 12;
const DELAY_MS = Number(process.env.SIM_DELAY_MS || 1500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// flowId OU caminho de um .json com a definição (testa rascunho local sem tocar o DB)
const flowArg = process.argv[2] || 'sdr-odonto-stages-v2';
const flowInline = flowArg.endsWith('.json') ? JSON.parse(fs.readFileSync(flowArg, 'utf8')) : null;
const flowId = flowInline ? null : flowArg;
const varsFile = process.argv[3];

// VARIÁVEIS REAIS de 1 clínica — para a validação oficial passe um JSON via argv[3].
// (placeholders realistas abaixo só pra smoke; NÃO validam o teste oficial)
const VARS = varsFile ? JSON.parse(fs.readFileSync(varsFile, 'utf8')) : {
  NOME_DONO: 'Dra. Fernanda',
  NOME_EMPRESA: 'Odonto Vale Sorriso',
  ESPECIALIDADE: 'implantes',
  CIDADE: 'Governador Valadares',
  QTD_AVALIACOES: '143',
  CONTEUDO_RECENTE: 'lentes de contato dental',
  NOME_SDR: 'Israel',
  LANDING_PAGE_URL: 'grupototum.com/previa',
  TEM_SITE: 'não',
  TIPO_OPORTUNIDADE: 'A',
  NOTA_SEO: '5',
  PRECO_MINIMO: '1.500',
  LINK_AGENDA: 'wa.me/5533997001893',
  CONCORRENTE_1: 'clínica concorrente 1',
  CONCORRENTE_2: 'clínica concorrente 2',
  CONCORRENTE_3: 'clínica concorrente 3',
};

const DEMO_LITERALS = ['clínica exemplo', 'clinica exemplo', 'dr. exemplo', 'dr exemplo', 'clínica odontosorriso', 'clinica odontosorriso', '{{'];
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const SCENARIOS = [
  {
    id: 'decisor_interessado',
    desc: 'Decisor interessado → deve chegar no ask da prévia / agendamento',
    open: 'Oi! Quem fala?',
    by_stage: {
      abertura: ['Sim, sou eu mesma, pode falar'],
      diagnostico: ['A maioria chega por indicação mesmo, o Google quase não traz paciente'],
      implicacao: ['É, isso me incomoda sim, sinto que a gente perde paciente pra concorrência'],
      oferta_previa: ['Quero ver sim, pode mandar'],
      previa: ['Gostei! Como funciona?'],
      agendamento: ['Pode ser quinta de manhã'],
    },
    fallback: ['Entendi, faz sentido', 'Pode continuar'],
    success: (log) => log.some((t) => ['oferta_previa', 'previa', 'agendamento'].includes(t.stage_novo) || t.send_preview || t.booked),
    successDesc: 'chegou em oferta_previa/previa/agendamento',
  },
  {
    id: 'cetico_identidade',
    desc: 'Cético ("quem é você? o que quer?") → se apresenta e volta ao fluxo',
    open: 'Quem é você? O que você quer? Como conseguiu meu número?',
    by_stage: {
      abertura: ['Sei... e o que exatamente vocês fazem?', 'Tá, e por que eu deveria te ouvir?'],
      diagnostico: ['Hm. A gente vai indo, chega gente por indicação'],
      implicacao: ['Pode ser, nunca medi isso'],
      oferta_previa: ['Manda ver então'],
    },
    fallback: ['Continua', 'Entendi'],
    success: (log) => {
      const all = norm(log.map((t) => t.reply.join(' ')).join(' '));
      const apresentou = /totum|israel/.test(all);
      const voltou = log.some((t) => t.stage_novo && t.stage_novo !== 'abertura' && t.stage_novo !== 'encerrado');
      return apresentou && voltou;
    },
    successDesc: 'se apresentou (Totum/SDR) e avançou de estágio',
  },
  {
    id: 'secretaria_gatekeeper',
    desc: 'Secretária ("quem decide é o doutor") → oferece áudio, NÃO marca humano, bloco áudio continua',
    open: 'Oi, aqui é a secretária da clínica. A doutora tá em atendimento',
    by_stage: {
      abertura: ['Sou só a secretária, quem decide essas coisas é a doutora', 'Pode mandar o áudio sim, eu encaminho pra ela'],
      observacao: ['Sou só a secretária, isso é com a doutora', 'Pode mandar o áudio sim, eu encaminho'],
      qualificacao: ['Quem cuida disso é a doutora', 'Pode mandar o áudio sim, eu encaminho'],
      diagnostico: ['Isso aí só a doutora sabe responder'],
      implicacao: ['Olha, posso anotar um recado'],
      oferta_previa: ['Tá, posso mostrar pra ela depois'],
    },
    fallback: ['Pode mandar o áudio sim, eu encaminho pra ela', 'Vou ver com ela'],
    success: (log) => log.length >= 3 && !log.some((t) => t.precisa_humano),
    successDesc: 'fluiu sem travar em humano (precisa_humano nunca true no caminho gatekeeper)',
  },
];

async function turn(body) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  await sleep(DELAY_MS);
  return j;
}

function pickMsg(sc, stage, visits) {
  const opts = sc.by_stage[stage] || sc.fallback;
  return opts[Math.min(visits, opts.length - 1)];
}

async function runScenario(sc) {
  const problems = [];
  const warns = [];
  const log = [];
  const botNorms = [];
  let history = [];
  let variables = { ...VARS };
  let stage = '';
  const visits = {};

  let msg = sc.open;
  for (let i = 0; i < MAX_TURNS; i++) {
    history.push({ direction: 'in', text: msg });
    const r = await turn({ ...(flowInline ? { flow: flowInline } : { flowId }), stage, variables, history: history.slice(0, -1), lastMessage: msg });
    log.push(r);
    const replyText = (r.reply || []).join(' ');
    console.log(`  [LEAD] ${msg}`);
    console.log(`  [BOT ${r.stage_anterior}→${r.stage_novo}${r.precisa_humano ? ' ⚠humano' : ''}${r.send_audio ? ' 🎧bloco-áudio' : ''}${r.notificar_humano ? ' 🔔notifica' : ''}] ${replyText || '(vazio)'}`);

    // critérios hard
    const low = replyText.toLowerCase();
    for (const d of DEMO_LITERALS) if (low.includes(d)) problems.push(`turno ${i + 1}: literal proibido "${d}" em: ${replyText}`);
    // pitch precoce: proibido antes da oferta da prévia (regras 2, 3, 8 do script)
    const PITCH = [/ajud(?:o|amos)\s+(?:as?\s+)?cl[ií]nicas?/i, /presen[çc]a digital/i, /ser(?:em)?\s+encontrad[oa]s?\s+(?:online|no google|na internet)/i, /marketing digital/i, /nossos?\s+servi[çc]os?/i, /proposta comercial/i];
    const preOferta = !['oferta_previa', 'previa', 'agendamento', 'encerrado', 'COMPLEX_REDIRECT'].includes(r.stage_novo);
    if (preOferta) for (const re of PITCH) if (re.test(replyText)) problems.push(`turno ${i + 1}: pitch precoce em: ${replyText}`);
    const n = norm(replyText);
    if (n) {
      const head8 = n.split(' ').slice(0, 8).join(' ');
      for (const prev of botNorms.slice(-3)) {
        if (prev === n || (n.split(' ').length >= 8 && prev.split(' ').slice(0, 8).join(' ') === head8)) {
          problems.push(`turno ${i + 1}: frase repetida do bot: ${replyText}`);
          break;
        }
      }
      botNorms.push(n);
    }
    // heurística: nome próprio fora das variáveis (ex.: "Milena")
    const allow = new Set(norm(Object.values(VARS).join(' ') + ' totum google whatsapp instagram').split(' '));
    const words = replyText.match(/\b[A-ZÀ-Ü][a-zà-ü]{2,}\b/g) || [];
    for (const w of words) {
      const nw = norm(w);
      if (!allow.has(nw) && /^(dra?|sr|sra)$/.test(nw) === false && !warns.includes(nw)) {
        // só palavras que parecem nome de pessoa (não começo de frase): aparece no meio do texto
        const idx = replyText.indexOf(w);
        if (idx > 0 && !/[.!?…]\s*$/.test(replyText.slice(0, idx).trim())) warns.push(nw);
      }
    }

    if (r.reply?.length) history.push({ direction: 'out', text: r.reply[0] });
    variables = r.variables || variables;
    stage = r.stage_novo || stage;
    if (r.done || r.booked || stage === 'encerrado') break;
    visits[stage] = (visits[stage] || 0) + 1;
    msg = pickMsg(sc, stage, visits[stage] - 1);
  }

  const objetivo = sc.success(log);
  const ok = problems.length === 0 && objetivo;
  console.log(`  → objetivo (${sc.successDesc}): ${objetivo ? 'OK' : 'FALHOU'}`);
  if (warns.length) console.log(`  → WARN nomes fora das variáveis (conferir se não é invenção): ${warns.join(', ')}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  return { id: sc.id, ok, problems, warns, turns: log.length };
}

async function main() {
  console.log(`Simulador: ${ENDPOINT} | flow: ${flowInline ? flowArg + ' (inline)' : flowId} | vars: ${varsFile || '(defaults de smoke — use JSON real p/ validação oficial)'}`);
  const results = [];
  for (const sc of SCENARIOS) {
    console.log(`\n━━ ${sc.id}: ${sc.desc}`);
    results.push(await runScenario(sc));
  }
  console.log('\n══ RESULTADO ══');
  for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.id} (${r.turns} turnos)${r.problems.length ? ` — ${r.problems.length} problema(s)` : ''}`);
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

main().catch((e) => { console.error('✗ harness falhou:', e.message); process.exit(2); });
