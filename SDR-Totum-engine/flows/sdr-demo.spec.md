# Demo SDR Odonto — Clínica OdontoSorriso (Tipo A, linear)

## VARIÁVEIS
- ESPECIALIDADE: especialidade da clínica
- QTD_AVALIACOES: quantidade de avaliações da clínica
- NOME_EMPRESA: nome da empresa/clínica
- NOME_DONO: nome do dono da clínica
- CIDADE: cidade onde a clínica está localizada
- CONTEUDO_RECENTE: conteúdo recente da clínica

## FLUXO
MSG01: Vi vocês aqui nas avaliações de {{ESPECIALIDADE}} na região. {{QTD_AVALIACOES}} avaliações. Aí é a {{NOME_EMPRESA}}, do {{NOME_DONO}}?
G01: [espera resposta do lead] → MSG02
MSG02: Estava pesquisando clínicas de {{ESPECIALIDADE}} aqui em {{CIDADE}} e a de vocês me chamou atenção.
MSG03: Vi um conteúdo recente de vocês sobre {{CONTEUDO_RECENTE}}. Bem diferente do que outras clínicas costumam postar.
MSG04: Daí fui pesquisar um pouco mais e encontrei mais de {{QTD_AVALIACOES}} avaliações no Google.
MSG05: {{QTD_AVALIACOES}} avaliações e uma nota alta. Isso é reputação construída de verdade. Poucas clínicas chegam nesse nível. Só fiquei com uma dúvida. 🤔
MSG06: Vocês têm algum site ou página própria hoje?
G02: [espera resposta do lead] → MSG07
MSG07: Foi justamente isso que me chamou atenção.
MSG08: Vocês já fizeram a parte mais difícil que é construir confiança. As avaliações, os conteúdos e a reputação da clínica mostram isso.
MSG09: Só que quem ainda não conhece a clínica nem sempre consegue perceber isso na primeira pesquisa.
MSG10: O cliente decide antes de te chamar. E é por isso que a maioria das empresas perde clientes antes da conversa começar.
MSG11: Não porque entregam um serviço ruim. Mas porque quem está pesquisando não consegue enxergar rapidamente o que faz aquela empresa ser a escolha certa.
MSG12: Foi exatamente essa sensação que tive analisando a clínica de vocês.
MSG13: Tem lógica isso que eu falei?
G03: [espera resposta do lead] → MSG14 (scoreHint:1.5)
MSG14: Foi justamente por isso que resolvi entrar em contato.
MSG15: Pensa comigo: quando um paciente pesquisa implante aqui na região e não acha vocês rápido, ele acaba marcando com quem apareceu primeiro — não com quem é melhor. Isso já aconteceu com vocês?
G04: [espera resposta do lead] → MSG16 (scoreHint:2.5)
MSG16: A gente trabalha com uma empresa por região nesse projeto. Antes de conversar com outras clínicas daqui, queria te mostrar uma oportunidade que enxerguei na de vocês.
MSG17: Poucas clínicas que analisei até agora me passaram tanto potencial quanto a de vocês. Tenho interesse real em fazer esse projeto funcionar aqui.
MSG18: Posso te mandar uma prévia sem compromisso?
G05: [espera resposta do lead] → MSG19 (scoreHint:2)
MSG19: Perfeito! Já te mando aqui. Fique de olho. 👀
AC01: [ação: enviar_previa] → MSG20
MSG20: Que tal uma conversa rápida de 15 minutos pra eu te explicar o que identifiquei? Pode ser amanhã às 10h ou às 16h — qual fica melhor?
G06: [espera resposta do lead] → MSG21 (scoreHint:2)
MSG21: Fechado! Te mando o link do nosso encontro. Obrigado, {{NOME_DONO}} — falo com você lá. 🙌
FIM: [fim da conversa]
