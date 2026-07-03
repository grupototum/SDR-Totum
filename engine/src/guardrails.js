// Guardrails contra bugs REAIS já ocorridos. Não afrouxar.

// Campos sem os quais a ABERTURA não pode ser personalizada => aborta o disparo daquele lead.
export const REQUIRED_FOR_DISPATCH = ['whatsapp', 'nome_empresa', 'especialidade', 'cidade', 'qtd_avaliacoes'];

export function missingRequired(lead) {
  return REQUIRED_FOR_DISPATCH.filter(f => {
    const v = lead?.[f];
    return v === undefined || v === null || String(v).trim() === '';
  });
}

const PLACEHOLDER_PATTERNS = [
  /\{\{?\s*[\w ]+\s*\}?\}/,            // {{nome_empresa}}, {NOME_DONO}
  /\[[\w _-]+\]/,                       // [NOME], [link]
  /cl[ií]nica\s+exemplo/i,
  /dr\.?\s*exemplo|doutora?\s+exemplo/i,
  /\bexemplo\s+ltda\b/i,
  /\bNOME_(EMPRESA|DONO|SDR)\b/,
  /\bLINK_AGENDA\b/,
  /\blorem ipsum\b/i,
];

export function hasPlaceholder(text) {
  return PLACEHOLDER_PATTERNS.some(re => re.test(text));
}

// Nome inventado: se o lead não tem nome_dono, o bot não pode chamar ninguém de Dr./doutor Fulano.
export function hasInventedName(text, lead) {
  if (lead?.nome_dono && String(lead.nome_dono).trim() !== '') return false;
  // Sem flag i: o nome próprio exige inicial MAIÚSCULA ("Dr. Roberto" pega; "o doutor vai ver" não)
  return /\b(?:[Dd]r\.?|[Dd]ra\.?|[Dd]outora?)\s+[A-ZÀ-Ü][a-zà-ü]+/.test(text);
}

export const normalizeText = (t) =>
  String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/https?:\/\/\S+/g, '<url>').replace(/[^\w<>\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Repetição exata (normalizada) de mensagem já enviada ao lead.
export function isRepeated(text, sentTexts) {
  const n = normalizeText(text);
  if (n.length < 12) return false; // "ok", "perfeito" etc. podem repetir
  return sentTexts.some(s => normalizeText(s) === n);
}

// Valida a saída do cérebro antes de enviar. Retorna { ok, reason }.
export function validateOutbound(text, lead, sentTexts) {
  if (!text || !String(text).trim()) return { ok: false, reason: 'mensagem_vazia' };
  if (hasPlaceholder(text)) return { ok: false, reason: 'placeholder' };
  if (hasInventedName(text, lead)) return { ok: false, reason: 'nome_inventado' };
  if (isRepeated(text, sentTexts)) return { ok: false, reason: 'repeticao' };
  return { ok: true };
}
