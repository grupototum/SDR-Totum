# PROMPT — Claude Code: Página "Pesquisa" (wizard de ordem + histórico) no SDR Totum

> Cole no Claude Code dentro do repo grupototum/SDR-Totum, DEPOIS de colar o componente base `multistep-form` em /components/ui e instalar deps (clsx, tailwind-merge, @radix-ui/*, class-variance-authority, lucide-react, framer-motion, sonner).
> FONTE DA VERDADE DO CONTEÚDO: /docs/MESTRE_DE_PESQUISA_v2.md. Mudança nova e isolada — não quebrar Flow Builder, Console nem Relatórios.

```
Construa a página PESQUISA do SDR Totum a partir do componente base multistep-form (stepper animado + validação por passo + footer de navegação) já em /components/ui. O wizard monta uma ORDEM DE PESQUISA DE LOTE e, no fim, GERA UM PROMPT copiável pra colar em qualquer LLM/agente. Mais uma página de HISTÓRICO (modo lista e card). Todo o conteúdo (campos, gate, schema de saída, formato do prompt) vem de docs/MESTRE_DE_PESQUISA_v2.md — leia esse arquivo e trate como fonte da verdade.

PASSO 0: confirme shadcn+Tailwind+TS; use os tokens do Design System Totum já no repo (NÃO as cores default do shadcn); localize a camada de dados (mock/http via API_CONTRACT.md) e o roteamento. Adicione rotas /pesquisa e /pesquisa/historico.

DESIGN: Totum Red dark-first, Geomanist, card rounded-3xl, foco vermelho #da2128, animações framer-motion do componente base.

═══ WIZARD — 6 PASSOS (conteúdo vem da FASE 0/1/6 do mestre) ═══
1) Nicho & ICP: nicho (default "Clínicas odontológicas"), descrição do ICP, encaixe natural (default "Landing Page Express"), upsell futuro (contexto).
2) Geografia: estados + cidades (chips). Pré-popular SP/MG/ES com as cidades da FASE 0 do mestre.
3) Gate ICP (FASE 1 — defaults editáveis) + Exclusões: mín. avaliações (default 50), nota mínima (default 4,5), exige WhatsApp (on), Instagram ativo últimos N dias (default 60), nicho odonto não-individual. Exclusões: franquias, grandes redes, marcas nacionais, corporativas.
4) Tipos & Ângulos: tipos A/B/C (default todos) + ângulos de munição (diferencial escondido, comparação com concorrente, perda de momento, reputação desperdiçada, urgência de decisão).
5) Campos de saída desejados: checklist do schema POR PROSPECT (FASE 6 do mestre), agrupado por Bloco A–G (Identificação, GMB, Instagram, Site, Concorrentes, CNPJ, Enriquecimento). Default marcado: todos os bloqueantes + munição (DIFERENCIAL_REAL, GANCHO_ABERTURA, CATEGORIA_PRINCIPAL, CAUSA, CONSEQUENCIA, ARGUMENTO_AUDIO). Mostrar quais são bloqueantes.
6) Revisão & Output: preview do PROMPT gerado (read-only, monospace) + botões "Copiar prompt", "Salvar no histórico", e "Rodar com agente (em breve)" DESABILITADO.

Validação por passo: P1 nicho; P2 ≥1 cidade; P3 valores válidos; P5 ≥1 campo. Footer "Próximo" respeita isso.

═══ GERADOR DO PROMPT (o cérebro) ═══
generateResearchPrompt(orderData): renderiza uma ORDEM DE PESQUISA no formato do MESTRE_DE_PESQUISA_v2.md, com seções: MISSÃO (fixa: revelar oportunidade, regra de ouro Dado→Problema→Impacto→Oportunidade), FASE 0 (ICP/geografia/exclusões/tipos/ângulos do wizard), FASE 1 GATE (com os thresholds do passo 3), FASE 2 fontes, FASE 6 OUTPUT POR PROSPECT (montado SÓ com os campos marcados no passo 5, mantendo placeholders {NOME_EMPRESA} etc.), e RESUMO DO LOTE. O texto sai pronto pra colar. Não inventar campos fora do mestre.

═══ HISTÓRICO (/pesquisa/historico) ═══
- Lista das ordens salvas. Toggle "Lista | Card" (ícones lucide), preferência em localStorage.
- Lista: tabela (Nome, Nicho, Geografia, Criada em, Status). Card: grid Totum.
- Ações por item: Ver prompt, Duplicar (reabre o wizard pré-preenchido), (futuro) Ver resultados.
- Nome auto: "[nicho] — [estado(s)] — [data]".
- Persistir via camada de dados: mock/localStorage AGORA; endpoint /api/research-orders como TODO (http). Não usar fetch direto.

═══ REGRAS ═══
Tipagem forte (interface OrderData), um componente/arquivo, surgical, sem dependência nova além das instaladas. Não tocar Flow Builder/Console/Relatórios. Ao terminar: build+lint passam; commit; resumo (arquivos) + o que ficou de fora.
```
