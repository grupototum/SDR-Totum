// O CÉREBRO: LLM (Groq→NVIDIA) guiado pelo FLOW v2 do builder. Entrada = system prompt
// (gerado do flow) + histórico. Saída = { mensagem, stage, temperatura, objetivo_atingido, precisa_humano }.
import { mockThink } from './mockBrain.js';
import { getFlow, stageMap, stageIds, entryStage, leadVars, renderTemplate, renderCopy, objectionInterrupt } from './flow.js';

const PROVIDERS = {
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    jsonMode: true,
  },
  nvidia: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: () => process.env.NVIDIA_API_KEY,
    model: () => process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
    jsonMode: false, // nem todo modelo NVIDIA aceita response_format; parse robusto abaixo
  },
};

export function buildSystemPrompt(lead, { sentTexts = [], retryNote = '', flow = null, stageId = null } = {}) {
  const def = flow || getFlow();
  const map = stageMap(def);
  const stId = map[stageId] ? stageId : (map[lead.stage] ? lead.stage : entryStage(def));
  const st = map[stId];
  const vars = leadVars(lead, def);
  const linkLp = vars.LINK_LP;
  const g = def.globals || {};
  const _gr = g.guardrails || [];
  const guardrails = Array.isArray(_gr) ? _gr.join('\n') : String(_gr);
  const refCopy = renderCopy(st.reference_copy, vars);
  const trail = def.stages.map(s => s.terminal ? `${s.id} (terminal)` : `${s.id} -> ${s.next || '?'}`).join(' | ');
  const obj = objectionInterrupt(def);

  return `# PAPEL
Você é o SDR da Totum no WhatsApp. Você NÃO vende: investiga e revela uma oportunidade que o
lead ainda não percebeu. Você conversa como gente, não como robô.

# OBJETIVO GERAL (do flow "${def.id || def.flow_id || ''}")
${g.objetivo || def.objective || ''}

# GUARDRAILS DO FLOW (obrigatórios)
${guardrails}

# ESTÁGIO ATUAL: "${stId}"
- META: ${st.goal || ''}
- COMO AGIR: ${renderTemplate(st.instruction || '', vars)}
${refCopy.length ? `- REFERÊNCIA DE FALA (adapte à conversa, não copie literal):\n${refCopy.map(c => '   • ' + c).join('\n')}` : ''}
- AVANCE para "${st.next || '(terminal)'}" QUANDO: ${st.advance_when || 'a meta do estágio for cumprida'}. Se a condição já foi satisfeita pela última resposta do lead, avance JÁ (proponha o próximo estágio em "stage"). Não trave a conversa re-perguntando o que o lead já respondeu.
- TRILHO COMPLETO: ${trail}
${obj ? `\n# OBJEÇÕES (${obj.categories?.join(', ')}): ACOLHA (nunca corrija), reintroduza como curiosidade e permaneça no estágio; preço nunca revela valor, redireciona pra prévia.` : ''}

# REGRAS DE ESTILO (invioláveis, valem sobre qualquer copy)
- Uma mensagem por vez. Nunca dois blocos juntos.
- Mensagens curtas, diretas, humanas. Tom neutro, curioso, confiante, nunca animado demais.
- Nunca vender no primeiro contato. Nunca falar preço/serviço/proposta antes do "posso mandar a prévia?".
- Proibido: "estratégia inovadora", "potencializar", "presença digital", "transformação digital",
  "crescimento exponencial". Nada de em-dash: use ponto ou vírgula. Nada de "teria interesse"
  (use "tenho interesse real"). Emoji: só 🤔, e raramente.
- Resposta fora do fluxo: responda curto e volte ao ponto onde parou.
- Nunca repita frase já enviada. Se não entendeu, reformule.
- Não repita argumento/ideia já usada na conversa; cada mensagem avança um passo novo.
- TODA mensagem termina com UMA pergunta (ou pedido claro de resposta) que induz o lead a responder e puxa o próximo passo. Nunca deixe a conversa sem gancho. Única exceção: encerramento final (objetivo atingido ou precisa_humano).
- Nunca invente detalhe não combinado (horário exato, "vou te ligar", material que não existe). Confirme só o que o lead disse.

# DADOS DO LEAD (variáveis do flow preenchidas pelo sistema; você NUNCA inventa)
${JSON.stringify(vars, null, 2)}
${lead.notas_pesquisa ? `Notas de pesquisa: ${lead.notas_pesquisa}` : ''}
Se um dado necessário faltar (vazio acima), fale de forma natural sem ele
("a clínica de vocês"). NUNCA escreva placeholder, colchete ou chave {{}}. NUNCA invente nome de pessoa.
Gatekeeper (secretária/recepção): mude de abordagem, apresente-se, ofereça áudio/resumo pra
encaminhar ao decisor ou peça o canal dele. NUNCA despeje o pitch em quem não decide;
conseguiu canal/encaminhamento => precisa_humano=true. Todo encerramento deixa o link ${linkLp}.

# FRASES JÁ ENVIADAS (PROIBIDO repetir qualquer uma, nem parecido)
${sentTexts.length ? sentTexts.map(t => `- ${t}`).join('\n') : '(nenhuma ainda)'}
${retryNote ? `\n# ATENÇÃO\n${retryNote}` : ''}

# SAÍDA (obrigatório: JSON válido, nada além do JSON)
{"mensagem": "<texto único a enviar no WhatsApp, sem aspas extras, sem colchetes>",
 "stage": "<${stageIds(def).join('|')}>",
 "temperatura": "<frio|morno|quente>",
 "objetivo_atingido": <true|false quando a reunião/horário for confirmado>,
 "precisa_humano": <true|false>}`;
}

async function callLlm(provider, messages) {
  const p = PROVIDERS[provider];
  const key = p.key();
  if (!key) throw new Error(`chave do provider ${provider} não setada`);
  const body = { model: p.model(), messages, temperature: 0.7, max_tokens: 500 };
  if (p.jsonMode) body.response_format = { type: 'json_object' };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${provider} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return data.choices[0].message.content;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise(r => setTimeout(r, 1500));
    } finally { clearTimeout(timer); }
  }
}

function parseBrainOutput(raw, fallback = {}, validIds = []) {
  // Parse robusto: aceita cercas ```json e texto em volta; pega do primeiro { ao último }.
  let s = String(raw).replace(/```json|```/g, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  let j;
  if (a >= 0 && b > a) {
    try { j = JSON.parse(s.slice(a, b + 1)); } catch { j = null; }
  }
  if (!j) {
    // Modelo devolveu texto puro: usa como mensagem e mantém o estado atual.
    j = { mensagem: s, stage: fallback.stage, temperatura: fallback.temperatura,
          objetivo_atingido: false, precisa_humano: false };
  }
  const stage = validIds.includes(j.stage) ? j.stage : (fallback.stage || validIds[0]);
  const temperatura = ['frio', 'morno', 'quente'].includes(j.temperatura) ? j.temperatura : 'morno';
  return {
    mensagem: String(j.mensagem || '').trim(),
    stage, temperatura,
    objetivo_atingido: j.objetivo_atingido === true,
    precisa_humano: j.precisa_humano === true,
  };
}

/**
 * think(lead, history, opts) -> { mensagem, stage, temperatura, objetivo_atingido, precisa_humano }
 * history: [{direction:'in'|'out', text}], em ordem. Vazio = gerar a ABERTURA.
 */
export async function think(lead, history, opts = {}) {
  const conf = process.env.SDR_LLM
    || (process.env.GROQ_API_KEY ? 'groq' : (process.env.NVIDIA_API_KEY ? 'nvidia' : ''));
  if (conf === 'mock') return mockThink(lead, history, opts);
  const providers = conf.split(',').map(s => s.trim()).filter(p => PROVIDERS[p]);
  if (!providers.length) throw new Error('Configure SDR_LLM=groq|nvidia|groq,nvidia (com as chaves) ou SDR_LLM=mock');

  const def = opts.flow || getFlow();
  const map = stageMap(def);
  const curStage = map[lead.stage] ? lead.stage : entryStage(def);
  const system = buildSystemPrompt(lead, { ...opts, flow: def, stageId: curStage });
  const chat = history.map(m => ({
    role: m.direction === 'out' ? 'assistant' : 'user',
    content: m.text,
  }));
  if (chat.length === 0) {
    chat.push({ role: 'user', content: '(sistema) Gere a PRIMEIRA mensagem de abertura para este lead, seguindo o estágio abertura.' });
  }
  chat.push({ role: 'system', content: 'Lembrete de formato: responda SOMENTE com o objeto JSON de # SAÍDA ({"mensagem":..., "stage":..., "temperatura":..., "objetivo_atingido":..., "precisa_humano":...}). Nenhum texto fora do JSON.' });
  let lastErr;
  for (const provider of providers) { // cadeia: primeiro que responder ganha (ex.: groq,nvidia)
    try {
      const raw = await callLlm(provider, [{ role: 'system', content: system }, ...chat]);
      return parseBrainOutput(raw, { stage: curStage, temperatura: lead.temperatura }, stageIds(def));
    } catch (e) { lastErr = e; console.warn(`[brain] ${provider} falhou (${e.message}), tentando próximo`); }
  }
  throw lastErr;
}
