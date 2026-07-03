// Cérebro MOCK determinístico (SDR_LLM=mock): valida plumbing, guardrails, persistência e
// simulador SEM chave Groq. Segue a mesma máquina de estágios do cérebro real.
// NÃO é o produto final: em produção usar SDR_LLM=groq.

const LP = () => process.env.LINK_LP || 'https://lp.grupototum.com/';
const SDR = () => process.env.NOME_SDR || 'Rael';

const RE = {
  gatekeeper: /secret[aá]ri|recep[cç]|quem decide [eé] o|n[aã]o sou (o |a )?(dono|respons|decis)|sou (a |o )?assistente/i,
  reject: /n[aã]o tenho interesse|n[aã]o quero|para de|me deixa|sem interesse|n[aã]o me (liga|chama)|remove|tira meu (n[uú]mero|contato)/i,
  price: /pre[cç]o|quanto custa|qual o valor|muito caro|caro demais/i,
  who: /quem ([eé]|es) (vc|voc[eê])|o que (vc|voc[eê]) quer|do que se trata|quem est[aá] falando/i,
  accept: /\b(sim|pode|pode sim|claro|manda|ok|beleza|fechado|bora|aceito|quero|combinado|isso|perfeito|[oó]timo|gostei|faz sentido|verdade|t[oô] dentro|topo)\b/i,
  refuse: /\b(n[aã]o|nunca|nada)\b/i,
  channel: /whats|n[uú]mero|zap|contato|fala com ele|manda (no|pro)|33\d|55\d|\d{8,}/i,
  time: /amanh[aã]|hoje|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|\d{1,2}h|\d{1,2}:\d{2}|de manh[aã]|[aà] tarde|[aà] noite/i,
};

function ladderText(r, lead, variant) {
  const conc = lead.concorrentes ? String(lead.concorrentes).split(/[;,]/).map(s => s.trim()).filter(Boolean).slice(0, 2).join(' e ') : 'as outras da região';
  const dono = lead.nome_dono ? ` Falo com ${lead.nome_dono}?` : '';
  const V = [
    [ // 0 abertura
      `Oi! Aqui é o ${SDR()}, da Totum. Estava pesquisando ${lead.especialidade} em ${lead.cidade} e vi vocês nas avaliações. ${lead.qtd_avaliacoes} avaliações e nota boa. Aí é a ${lead.nome_empresa}?${dono}`,
      `Oi, tudo bem? ${SDR()} aqui, da Totum. Encontrei a ${lead.nome_empresa} pesquisando ${lead.especialidade} em ${lead.cidade}. Falo com quem cuida da clínica?`,
    ],
    [ // 1 abertura pt2: site
      `Boa! Então, a reputação de vocês chamou atenção${lead.conteudo_recente ? `, e vi um conteúdo recente sobre ${lead.conteudo_recente}, diferente do que as outras postam` : ''}. Só que procurei no Google e com IA e não achei o site de vocês. Vocês têm site ou página própria hoje?`,
      `Legal. O que me deixou com uma dúvida 🤔 foi isso: a nota de vocês é alta, mas pesquisando no Google não encontrei uma página própria. Existe site da clínica hoje?`,
    ],
    [ // 2 qualificacao
      `Entendi. E é você que cuida da divulgação da clínica?`,
      `Saquei. Quem cuida dessa parte de divulgação aí, é você mesmo?`,
    ],
    [ // 3 diagnostico
      `Então, o que percebi foi isso: quando alguém pesquisa ${lead.especialidade} em ${lead.cidade}, compara vocês com ${conc}. E quem ganha essa comparação nem sempre é a melhor clínica, é quem passa mais confiança antes do primeiro contato. Vocês já fizeram a parte difícil, que é a reputação. Falta garantir que quem chega pela primeira vez perceba isso. Tem lógica isso que falei?`,
      `O ponto é: o cliente decide enquanto pesquisa, antes de chamar. Se a primeira impressão online não mostra a reputação que vocês construíram, ele marca com quem aparece melhor, não com quem atende melhor. Faz sentido pra você?`,
    ],
    [ // 4 ask_previa
      `A gente trabalha com uma clínica por região. Antes de falar com outras daqui, queria te mostrar a oportunidade que enxerguei na de vocês. Posso te mandar uma prévia que resolve isso? Sem compromisso.`,
      `Montei uma análise específica da ${lead.nome_empresa}, e como trabalhamos com uma clínica por região, preferi te procurar primeiro. Te mando uma prévia sem compromisso?`,
    ],
    [ // 5 previa + agendamento
      `Ótimo, já estou montando. Enquanto isso dá uma olhada: ${LP()} . Pra eu te explicar o que montei, você tem uns 20 min essa semana?`,
      `Perfeito, vou preparar. De amostra, olha isso aqui: ${LP()} . Consegue uns 20 min essa semana pra eu te mostrar o que encontrei?`,
    ],
    [ // 6 confirmacao
      `Fechado${lead.nome_dono ? `, ${lead.nome_dono}` : ''}. O que vou te mostrar não é só uma página, a página é o que aparece. Na reunião você entende o que está por trás. Te confirmo por aqui. Obrigado!`,
      `Combinado então. Te mando a confirmação por aqui. Obrigado pelo papo!`,
    ],
  ];
  const bank = V[r];
  return bank[Math.min(variant, bank.length - 1)];
}

// ids alinhados ao flow v2.6 do builder
const STAGE_BY_RUNG = ['abertura', 'abertura', 'qualificacao', 'diagnostico', 'oferta_previa', 'agendamento', 'encerrado'];

function newState() {
  return { rung: 0, asked: [0, 0, 0, 0, 0, 0, 0], mode: 'main', gkStep: 0, temp: 'morno', done: false, human: false, whoAnswered: false, priceAnswered: false };
}

// Um passo: dado o estado e a fala do lead, devolve a resposta e muta o estado.
function step(st, inText, lead) {
  const t = String(inText || '');
  const out = (mensagem, extra = {}) => ({
    mensagem,
    stage: extra.stage ?? STAGE_BY_RUNG[Math.min(st.rung, 6)],
    temperatura: extra.temp ?? st.temp,
    objetivo_atingido: !!extra.done,
    precisa_humano: !!extra.human,
  });

  // Gatekeeper: muda de abordagem, nunca despeja o pitch.
  if (st.mode !== 'gk' && RE.gatekeeper.test(t)) {
    st.mode = 'gk'; st.gkStep = 1; st.rung = 2;
    return out(`Ah, entendi! Então, me chamo ${SDR()}, da Totum, trabalho com isso desde 2003. Analisei a ${lead.nome_empresa} e achei umas coisas que ${lead.nome_dono ? `o ${lead.nome_dono}` : 'quem decide aí'} vai querer ver. Posso te mandar um áudio curto resumindo, pra você encaminhar?`, { stage: 'qualificacao' });
  }
  if (st.mode === 'gk') {
    if (st.gkStep === 1) {
      if (RE.channel.test(t) || (RE.accept.test(t) && !RE.refuse.test(t))) {
        st.human = true; st.gkStep = 2;
        return out(`Perfeito, obrigado! Já preparo e te mando aqui pra você repassar. Qualquer coisa, o material de amostra fica em ${LP()}`, { stage: 'qualificacao', human: true, temp: 'morno' });
      }
      st.gkStep = 2;
      return out(`Sem problema. Qual o melhor canal pra eu falar direto com quem cuida dessa parte? Pode ser um WhatsApp ou e-mail.`, { stage: 'qualificacao' });
    }
    st.human = true;
    return out(`Obrigado! Vou fazer contato por lá então. Deixo aqui uma amostra do que faço, caso queiram dar uma olhada: ${LP()}`, { stage: 'qualificacao', human: true });
  }

  // Recusa/irritação antes do ask da prévia: acolhe e passa pro humano.
  if (RE.reject.test(t) && st.rung < 5) {
    st.human = true; st.temp = 'frio';
    return out(`Entendo, sem problema 😊 Não precisa decidir nada agora. Se um dia quiser ver o que encontrei sobre a clínica, fica aqui uma amostra: ${LP()}`, { human: true, temp: 'frio' });
  }

  // Objeção de preço: acolhe e redireciona pra prévia.
  if (RE.price.test(t) && !st.priceAnswered) {
    st.priceAnswered = true; st.rung = Math.max(st.rung, 4);
    return out(`Boa pergunta. Mas prefiro não falar número antes de você ver o que encontrei, porque o valor depende do que faz sentido pra clínica. Posso te mandar a prévia primeiro? Sem compromisso.`, { stage: 'oferta_previa' });
  }

  // "Quem é você?": responde curto e volta ao ponto.
  if (RE.who.test(t) && !st.whoAnswered) {
    st.whoAnswered = true;
    const back = st.rung <= 1 ? `Vi a ${lead.nome_empresa} pesquisando ${lead.especialidade} em ${lead.cidade}, e uma coisa me chamou atenção. Vocês têm site ou página própria hoje?` : `Voltando: ${ladderText(st.rung, lead, 1)}`;
    st.asked[st.rung] += 1; st.rung = Math.max(st.rung, 1);
    return out(`Justo! Sou o ${SDR()}, da Totum, trabalho com clínicas desde 2003. Não estou vendendo nada agora. ${back}`);
  }

  // Escada principal: avança um degrau a cada resposta do lead.
  if (st.rung >= 4 && RE.refuse.test(t) && !RE.accept.test(t)) {
    // recusou a prévia/agendamento depois do ask: encerra elegante com o link.
    st.done = false; st.human = false; st.temp = 'frio'; st.rung = 6;
    return out(`Tranquilo, fica à vontade. Se mudar de ideia, uma amostra do que eu ia te mostrar fica aqui: ${LP()} Boa semana!`, { stage: 'encerrado', temp: 'frio' });
  }

  st.rung += 1;
  if (st.rung >= 6) {
    st.done = true; st.temp = 'quente';
    return out(ladderText(6, lead, st.asked[6]++), { stage: 'encerrado', done: true, temp: 'quente' });
  }
  if (st.rung === 5) st.temp = 'quente';
  if (st.rung >= 3 && RE.accept.test(t)) st.temp = 'quente';
  return out(ladderText(st.rung, lead, st.asked[st.rung]++));
}

export function mockThink(lead, history) {
  const st = newState();
  // Abertura (sem histórico)
  if (!history || history.length === 0) {
    return {
      mensagem: ladderText(0, lead, 0),
      stage: 'abertura', temperatura: 'morno', objetivo_atingido: false, precisa_humano: false,
    };
  }
  // Replay determinístico: reaplica cada inbound na ordem; a última produz a resposta.
  let reply = null;
  st.asked[0] = 1; // abertura já enviada
  for (const m of history) {
    if (m.direction === 'in') reply = step(st, m.text, lead);
  }
  return reply ?? { mensagem: ladderText(1, lead, 0), stage: 'abertura', temperatura: 'morno', objetivo_atingido: false, precisa_humano: false };
}
