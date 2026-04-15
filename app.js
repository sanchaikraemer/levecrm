/* ═══════════════════════════════════════════════════════════════
   DIRECIONA APP — JavaScript principal
   ─────────────────────────────────────────────────────────────── */

// CONFIGURAÇÃO — apontar para o Worker em produção
const API_BASE = 'https://direciona-api.sanchaikraemer3.workers.dev';
//                   ↑ troque pelo URL do seu Worker depois do deploy

const LS_LICENSE = 'direciona_license_key';
const LS_NAME    = 'direciona_license_name';

/* ═══════════════════════════════════════
   ESTADO GLOBAL
═══════════════════════════════════════ */
let currentTab = null;
let lastBestResponse = '';
let historyPrintTexts = [];
let lastPrintText = '';
let tesseractLoading = null; // Promise do carregamento sob demanda
let analyzeAbortController = null;

/* ═══════════════════════════════════════
   BIBLIOTECA DE CONDUÇÃO
═══════════════════════════════════════ */
const libraryData = [
  {id:"abertura", title:"Abertura", topics:[
    {title:"Lead novo", subtitle:"Abrir com postura profissional", responses:[
      {label:"Equilibrada", text:"Obrigado pelo seu interesse no [empreendimento]. Posso te passar as melhores opções disponíveis no momento?\n\nMe confirma uma coisa para eu te direcionar melhor: você busca mais para morar ou para investir?", tip:"Boa para praticamente todo lead novo."},
      {label:"Mais premium", text:"Recebi seu interesse no [empreendimento] e posso te direcionar para as opções mais adequadas.\n\nMe confirma uma coisa: o objetivo hoje é moradia ou investimento?", tip:"Passa mais autoridade sem ficar fria."},
      {label:"Consultiva", text:"Olá! Recebi seu interesse e quero te ajudar da forma mais objetiva possível.\n\nPara eu te direcionar para a melhor opção hoje, me confirma: a busca é mais para moradia própria ou para investimento?", tip:"Boa para leads que precisam de mais cuidado na abertura."}
    ]},
    {title:"Cliente pergunta só o valor", subtitle:"Sem matar a conversa no número", responses:[
      {label:"Com direção", text:"Claro. Hoje temos opções a partir de R$ [valor], variando conforme unidade, posição e condição de pagamento.\n\nPara eu te direcionar da forma mais adequada, me confirma se sua busca hoje é mais para moradia ou investimento.", tip:"Evita resposta seca e já puxa perfil."},
      {label:"Valor + qualificação", text:"Posso te passar o valor, mas o que realmente define a melhor opção para você é como a condição se encaixa no seu momento. Você está olhando mais pela entrada, pela parcela ou pelo valor total?", tip:"Boa para transformar a pergunta de preço em qualificação."}
    ]},
    {title:"Lead de anúncio frio", subtitle:"Primeiro contato pós-anúncio", responses:[
      {label:"Leve e objetiva", text:"Olá! Vi que você se interessou pelo [empreendimento]. Posso te mandar as opções disponíveis no momento para você dar uma olhada com calma?", tip:"Boa abertura sem pressão para leads de anúncio."},
      {label:"Com qualificação", text:"Olá! Recebi seu interesse e tenho algumas opções interessantes para te apresentar.\n\nVocê está buscando mais para morar ou investir?", tip:"Qualifica já na abertura."}
    ]}
  ]},
  {id:"objecoes", title:"Objeções", topics:[
    {title:"Está caro", subtitle:"Reposicionar valor e condição", responses:[
      {label:"Reposicionar", text:"Entendo. Essa é uma percepção comum no início, principalmente quando o cliente ainda está comparando opções.\n\nO ponto principal aqui é avaliar o conjunto: localização, padrão, potencial de valorização e condição de pagamento.", tip:"Tira a conversa do impulso."},
      {label:"Abrir condição", text:"O que normalmente resolve essa percepção é ajustar a composição da proposta. Se eu te mostrar uma condição mais interessante, você gostaria de analisar?", tip:"Boa para avançar."},
      {label:"Comparativo de valor", text:"Quando a gente analisa o custo por metro e o potencial de valorização da região, o número costuma mudar bastante de perspectiva. Quer que eu te mostre essa análise?", tip:"Boa para clientes que comparam com outros imóveis."}
    ]},
    {title:"Não tenho entrada", subtitle:"Normalizar e direcionar", responses:[
      {label:"Normalizar", text:"Perfeito, isso acontece com bastante frequência. Nem sempre o problema está no imóvel, mas sim na forma como a entrada foi pensada.\n\nDependendo da opção, conseguimos trabalhar uma condição mais leve no início.", tip:"Boa para acalmar."},
      {label:"Puxar simulação", text:"Se eu te apresentar uma possibilidade com entrada facilitada, você gostaria que eu simulasse?", tip:"Leva para o próximo passo."},
      {label:"Parcelamento", text:"Em alguns casos, a entrada pode ser parcelada durante a obra. Vale a pena eu te mostrar como isso funciona?", tip:"Boa quando o produto permite parcelamento de entrada."}
    ]},
    {title:"Vou pensar", subtitle:"Abrir objeção real", responses:[
      {label:"Ir ao ponto", text:"Claro, sem problema. Só para eu entender e poder te ajudar melhor: hoje o que mais está pesando para você é o valor, a entrada ou o momento da decisão?", tip:"Boa para tirar resposta genérica."},
      {label:"Retomada elegante", text:"Eu te pergunto isso porque, muitas vezes, consigo ajustar a condição ou te direcionar para uma opção mais adequada. E aí a análise fica bem mais objetiva para você.", tip:"Use se ele continuar vago."}
    ]},
    {title:"Vai falar com a família", subtitle:"Participar da decisão sem pressionar", responses:[
      {label:"Curta e forte", text:"Perfeito, faz todo sentido analisar em conjunto. Se você quiser, posso explicar também diretamente para essa pessoa. Podemos fazer isso por ligação ou aqui no WhatsApp.", tip:"Curta, objetiva e muito usável no dia a dia."},
      {label:"Mais elegante", text:"Perfeito, e eu concordo com você: uma decisão assim deve mesmo ser analisada em conjunto. Inclusive, acho importante eu também ter a oportunidade de explicar diretamente para essa pessoa. Podemos fazer isso da forma que ficar melhor para vocês.", tip:"Boa quando quer um tom mais premium."}
    ]},
    {title:"Não é o momento", subtitle:"Entender a trava real", responses:[
      {label:"Abrir o ponto", text:"Entendo. Só para eu entender melhor, quando você fala que não é o momento, é mais uma questão de prazo, condição financeira ou ainda está pesando se faz sentido?", tip:"Separa os tipos de trava para direcionar melhor."},
      {label:"Manter canal aberto", text:"Sem problema. Vou te manter atualizado com novidades que possam fazer sentido para o seu perfil.", tip:"Boa para não queimar o lead que realmente não está pronto."}
    ]},
    {title:"Já tenho outro corretor", subtitle:"Respeitar sem recuar", responses:[
      {label:"Respeitosa e firme", text:"Entendo, e respeito. O que posso oferecer é uma segunda visão, porque trabalho esse produto de uma forma diferente e posso te mostrar algumas informações que talvez você ainda não tenha visto. Se fizer sentido, fico à disposição.", tip:"Boa para não fechar a porta e se posicionar como especialista."},
      {label:"Sem pressão", text:"Tudo certo. Se em algum momento você quiser uma segunda opinião ou mais detalhes sobre esse empreendimento, pode me chamar.", tip:"Curta e respeitosa."}
    ]}
  ]},
  {id:"retomada", title:"Retomada", topics:[
    {title:"Sumiu depois do valor", subtitle:"Retomar com elegância", responses:[
      {label:"Consultiva", text:"Olá, [nome]. Tudo bem? Retomei seu atendimento por aqui e queria entender se o que pesou mais para você foi a entrada, o valor total ou se apenas não é o momento ideal agora.", tip:"Direta e elegante."},
      {label:"Nova alternativa", text:"Se fizer sentido, eu posso inclusive te mostrar uma alternativa diferente dentro do que você procura, com condição mais ajustada.", tip:"Boa como segunda mensagem."}
    ]},
    {title:"Sumiu depois da visita", subtitle:"Retomar sem pressão", responses:[
      {label:"Abrir o ponto", text:"Olá, [nome]! Tudo bem? Fiquei aguardando seu retorno e queria entender melhor o que ficou na cabeça depois da visita. O que ficou mais positivo e o que ainda está pesando?", tip:"Boa para abrir o feedback real pós-visita."},
      {label:"Curta e direta", text:"Olá, [nome]! Depois da visita, ficou alguma dúvida ou tem algo que eu possa te ajudar a esclarecer?", tip:"Boa quando não quer parecer insistente."}
    ]},
    {title:"Lead travou em objeção", subtitle:"Retomar onde parou", responses:[
      {label:"Retomada com solução", text:"Olá, [nome]! Tudo bem? Fiquei pensando no que conversamos e tenho uma alternativa que pode encaixar melhor no que você me trouxe. Posso te mostrar?", tip:"Reativa com proposta, não com pressão."},
      {label:"Pergunta direta", text:"Olá, [nome]! Para continuar te ajudando da forma mais objetiva, me confirma uma coisa: o que mais ainda está pesando hoje é condição, momento ou produto?", tip:"Boa para retomadas mais diretas."}
    ]},
    {title:"Lead sumiu sem motivo", subtitle:"Reativar com leveza", responses:[
      {label:"Sem pressão", text:"Olá, [nome]! Fiquei na dúvida se você conseguiu olhar com calma o que eu te enviei.", tip:"Curta. Não pressiona. Reabre a conversa."},
      {label:"Com novidade", text:"Olá, [nome]! Tenho uma atualização sobre o [empreendimento] que pode te interessar. Posso te enviar?", tip:"Cria motivo para o contato sem parecer cobrança."}
    ]}
  ]},
  {id:"avanco", title:"Avanço", topics:[
    {title:"Levar para visita", subtitle:"Aproveitar interesse real", responses:[
      {label:"Convite objetivo", text:"Pelo que você me trouxe, acredito que vale a pena conhecer essa opção com mais atenção. Podemos agendar uma visita rápida e eu te apresento tudo de forma objetiva, sem compromisso.", tip:"Boa para manter ritmo comercial."},
      {label:"Com urgência leve", text:"Esse tipo de unidade costuma sair rápido. Se você quiser garantir a sua visita antes que reduza a disponibilidade, me fala qual dia fica melhor.", tip:"Cria senso de urgência sem pressão."}
    ]},
    {title:"Levar para ligação", subtitle:"Destravar rápido", responses:[
      {label:"Ligação curta", text:"Se preferir, eu posso te explicar tudo em uma ligação rápida de 5 minutos e já te deixo com as opções mais alinhadas.", tip:"Excelente para acelerar decisão."},
      {label:"Ligação com foco", text:"Às vezes, uma conversa rápida resolve dúvidas que levam muito mais tempo por mensagem. Você consegue 5 minutinhos hoje?", tip:"Boa para clientes com muitas dúvidas."}
    ]},
    {title:"Pedido de desconto", subtitle:"Negociar sem desvalorizar", responses:[
      {label:"Com critério", text:"Dependendo da unidade, forma de pagamento e prazo, existe possibilidade de ajuste sim. O ideal é eu entender exatamente qual opção faz mais sentido para você, porque aí consigo te passar uma condição mais real.", tip:"Mantém autoridade e evita liquidação."},
      {label:"Condicional", text:"Existe essa possibilidade, mas ela está ligada à forma como a proposta é estruturada. Quer que eu monte uma simulação com as melhores condições disponíveis agora?", tip:"Transforma desconto em proposta."}
    ]},
    {title:"Cliente pediu tempo para decidir", subtitle:"Criar movimento sem pressionar", responses:[
      {label:"Com validade", text:"Claro, sem problema. Só te aviso que essa condição está disponível até [data/período] e, depois disso, pode ter ajuste. Quero te garantir a melhor opção enquanto está dentro do prazo.", tip:"Cria urgência real sem pressão artificial."},
      {label:"Facilitando a decisão", text:"Quer que eu te monte um resumo com os pontos principais para você apresentar para quem vai decidir com você? Assim fica mais fácil de analisar.", tip:"Ajuda quem precisa convencer outra pessoa."}
    ]}
  ]},
  {id:"fechamento", title:"Fechamento", topics:[
    {title:"Proposta apresentada, aguardando retorno", subtitle:"Manter movimento sem parecer cobrança", responses:[
      {label:"Verificar alinhamento", text:"Olá, [nome]! Tudo bem? Estou aqui para te ajudar a resolver qualquer dúvida que tenha ficado sobre a proposta. Tem alguma coisa que ficou pesando?", tip:"Boa como primeiro follow-up pós-proposta."},
      {label:"Criar decisão", text:"[Nome], quero te ajudar a fechar no melhor momento e na melhor condição. O que ainda está faltando para você se sentir confortável em avançar?", tip:"Boa quando a proposta foi bem recebida."}
    ]},
    {title:"Sinal de fechamento mas cliente hesita", subtitle:"Transformar intenção em ação", responses:[
      {label:"Assumir o sim", text:"Pelo que entendi da nossa conversa, essa opção faz bastante sentido para o seu perfil. Para garantirmos a unidade, o próximo passo seria formalizar a reserva. Você prefere fazer isso hoje ou amanhã?", tip:"Boa quando tudo foi alinhado e só falta o movimento final."},
      {label:"Facilitar o passo", text:"Posso te guiar no processo de reserva agora? É simples, rápido e garante a unidade para você avaliar com calma.", tip:"Boa para desfazer a percepção de que fechar é complicado."}
    ]},
    {title:"Objeção de última hora", subtitle:"Tratar sem retroceder", responses:[
      {label:"Validar e avançar", text:"Entendo, e é normal que apareça alguma dúvida na hora de fechar. Me conta o que está travando agora e vejo como posso te ajudar.", tip:"Boa para objeções que surgem no momento de assinar."},
      {label:"Recapitular o valor", text:"Antes de a gente deixar isso de lado, quero só recapitular o que a gente construiu aqui: localização, produto e condição. Você acredita que essa combinação faz sentido para você?", tip:"Boa para reconectar o cliente com o valor."}
    ]},
    {title:"Fechar por referência", subtitle:"Usar o momento positivo para ampliar", responses:[
      {label:"Pedir indicação", text:"Fico muito feliz que tenha feito sentido para você! Se você conhece alguém que está buscando algo parecido, eu atendo com o mesmo cuidado. Pode me indicar?", tip:"Melhor momento para pedir indicação: logo após o fechamento."}
    ]}
  ]},
  {id:"reativacao", title:"Reativação", topics:[
    {title:"Lead frio há mais de 30 dias", subtitle:"Reativar sem parecer desesperado", responses:[
      {label:"Muito leve", text:"Olá, [nome]! Tudo bem? Passando para ver se você ainda está em busca de algo ou se o assunto ficou para outro momento.", tip:"Boa para leads muito antigos. Abre sem pressionar."},
      {label:"Com novidade", text:"Olá, [nome]! Tenho uma novidade relacionada ao [empreendimento] que pode te interessar. Posso te contar?", tip:"Boa quando há algo novo para oferecer."},
      {label:"Mudança de perfil", text:"Olá, [nome]! Às vezes, a busca muda ao longo do tempo. Queria entender se o que você procura hoje ainda é parecido com o que conversamos antes.", tip:"Boa para requalificar o lead antes de oferecer produto."}
    ]},
    {title:"Lead que cancelou ou desistiu", subtitle:"Reabrir com elegância", responses:[
      {label:"Sem cobrar", text:"Olá, [nome]! Tudo bem? Sei que em um momento anterior o timing não foi o certo. Quando sentir que faz sentido retomar, estou à disposição.", tip:"Boa para manter o canal sem pressão."},
      {label:"Com nova condição", text:"Olá, [nome]! Temos uma condição nova que mudou bastante em relação ao que a gente viu antes. Vale a pena você dar uma olhada?", tip:"Boa quando há uma condição genuinamente diferente."}
    ]},
    {title:"Cliente pós-venda que pode indicar", subtitle:"Manter relacionamento", responses:[
      {label:"Check-in natural", text:"Olá, [nome]! Tudo bem por aí? Passando só para saber como estão as coisas.", tip:"Mantém vínculo de forma natural."},
      {label:"Pedir indicação", text:"[Nome], tenho outras pessoas que estão buscando algo parecido com o que você adquiriu. Se você conhece alguém que possa se interessar, ficaria muito feliz em atender com o mesmo cuidado!", tip:"Pedir indicação com naturalidade pós-atendimento."}
    ]},
    {title:"Lead viajando ou ocupado", subtitle:"Respeitar e manter presença", responses:[
      {label:"Agenda aberta", text:"Sem problema! Pode me chamar quando voltar e a gente retoma com calma.", tip:"Boa para clientes que disseram estar ocupados ou viajando."},
      {label:"Retomada após ausência", text:"Bem-vindo de volta! Fica à vontade para retomar quando quiser. Tenho novidades sobre o [empreendimento] para te mostrar.", tip:"Boa retomada pós-viagem."}
    ]}
  ]}
];

/* ═══════════════════════════════════════
   REGRAS DO ANALISADOR LOCAL
═══════════════════════════════════════ */
const analyzerRules = [
  {id:"family", match:["esposa","marido","filho","filha","família","familia","falar com","conversar com","decidir com"], situation:"Decisão compartilhada com outra pessoa", heat:"Morno", profile:"Comprador cauteloso", risk:"Médio", goal:"Participar da decisão e evitar que a proposta seja repassada de forma incompleta.", next:"Convidar a outra pessoa para ligação ou grupo no WhatsApp.", avoid:"Evite responder apenas 'sem problema, me avise'. Isso te tira da decisão.", chips:["decisão conjunta","participação","clareza"], responses:[{label:"Mais curta", text:"Perfeito, faz todo sentido analisar em conjunto. Se você quiser, posso explicar também diretamente para essa pessoa. Podemos fazer isso por ligação ou aqui no WhatsApp.", tip:"Boa para uso rápido no dia a dia."},{label:"Mais premium", text:"Perfeito, e eu concordo com você: uma decisão assim deve mesmo ser analisada em conjunto. Inclusive, acho importante eu também ter a oportunidade de explicar diretamente para essa pessoa. Podemos fazer isso da forma que ficar melhor para vocês.", tip:"Boa quando quer mais elegância."}]},
  {id:"price", match:["caro","alto","valor","preço","preco","mais barato","abaixar","custoso"], situation:"Objeção de valor", heat:"Morno", profile:"Comparador ou investidor cauteloso", risk:"Médio para alto", goal:"Tirar a conversa do preço seco e reposicionar valor e condição.", next:"Abrir a análise entre valor, entrada e forma de pagamento.", avoid:"Evite justificar demais ou entrar em defesa longa do produto.", chips:["valor","comparação","condição"], responses:[{label:"Reposicionar", text:"Entendo. Essa é uma percepção comum no início, principalmente quando o cliente ainda está comparando opções. O ponto principal aqui é avaliar o conjunto: localização, padrão, potencial de valorização e condição de pagamento.", tip:"Tira a conversa do impulso."},{label:"Abrir condição", text:"O que normalmente resolve essa percepção é ajustar a composição da proposta. Se eu te mostrar uma condição mais interessante, você gostaria de analisar?", tip:"Boa para avançar."}]},
  {id:"entry", match:["entrada","sem entrada","não tenho entrada","nao tenho entrada","não consigo entrada","nao consigo entrada"], situation:"Travamento por entrada", heat:"Morno", profile:"Morador travado no início", risk:"Médio", goal:"Normalizar a objeção e abrir caminho para simulação.", next:"Levar para uma condição mais leve ou entrada facilitada.", avoid:"Evite tratar a falta de entrada como fim da conversa.", chips:["entrada","simulação","condição"], responses:[{label:"Normalizar", text:"Perfeito, isso acontece com bastante frequência. Nem sempre o problema está no imóvel, mas sim na forma como a entrada foi pensada. Dependendo da opção, conseguimos trabalhar uma condição mais leve no início.", tip:"Boa para acalmar."},{label:"Puxar simulação", text:"Se eu te apresentar uma possibilidade com entrada facilitada, você gostaria que eu simulasse?", tip:"Leva para o próximo passo."}]},
  {id:"think", match:["vou pensar","pensar","analisar","depois vejo","vou ver","mais pra frente","qualquer coisa te aviso"], situation:"Adiamento ou evasão", heat:"Frio para morno", profile:"Cliente indeciso", risk:"Alto de esfriar", goal:"Abrir a objeção real e evitar perda por silêncio.", next:"Perguntar se pesa valor, entrada ou momento.", avoid:"Evite aceitar o adiamento sem tentar entender a trava real.", chips:["adiamento","risco de sumir","objeção real"], responses:[{label:"Abrir a trava", text:"Claro, sem problema. Só para eu entender e poder te ajudar melhor: hoje o que mais está pesando para você é o valor, a entrada ou o momento da decisão?", tip:"Ótima para tirar o cliente do automático."},{label:"Retomada elegante", text:"Eu te pergunto isso porque, muitas vezes, consigo ajustar a condição ou te direcionar para uma opção mais adequada.", tip:"Use se ele continuar vago."}]},
  {id:"discount", match:["desconto","descontinho","melhorar valor","quanto consegue","faz por quanto","melhora"], situation:"Pedido de desconto", heat:"Quente ou morno", profile:"Negociador", risk:"Médio", goal:"Manter valor percebido e negociar com critério.", next:"Relacionar ajuste a unidade, prazo e forma de pagamento.", avoid:"Evite parecer liquidação ou vender desespero.", chips:["negociação","autoridade","ajuste"], responses:[{label:"Com critério", text:"Dependendo da unidade, forma de pagamento e prazo, existe possibilidade de ajuste sim. O ideal é eu entender exatamente qual opção faz mais sentido para você, porque aí consigo te passar uma condição mais real.", tip:"Segura bem o posicionamento."}]},
  {id:"visit", match:["quero ver","tenho interesse","visitar","agendar","quando posso ver","gostei","vamos marcar"], situation:"Interesse real com chance de avanço", heat:"Quente", profile:"Cliente já engajado", risk:"Baixo", goal:"Aproveitar o momento e levar para visita ou ligação.", next:"Puxar agenda ou chamada curta.", avoid:"Evite enrolar demais quando o cliente já demonstrou vontade.", chips:["lead quente","avanço","visita"], responses:[{label:"Visita", text:"Pelo que você me trouxe, acredito que vale a pena conhecer essa opção com mais atenção. Podemos agendar uma visita rápida e eu te apresento tudo de forma objetiva, sem compromisso.", tip:"Boa para manter ritmo."},{label:"Ligação curta", text:"Se preferir, eu posso te explicar tudo em uma ligação rápida de 5 minutos e já te deixo com as opções mais alinhadas.", tip:"Boa quando o timing pede rapidez."}]},
  {id:"invest", match:["investimento","investir","rentabilidade","alugar","valorização","valorizar","renda futura"], situation:"Cliente com perfil de investimento", heat:"Morno", profile:"Investidor", risk:"Médio", goal:"Direcionar para valorização, segurança e condição.", next:"Entender foco entre valorização, renda e entrada.", avoid:"Evite tratar investidor como morador comum.", chips:["investidor","valorização","renda futura"], responses:[{label:"Direcionar investidor", text:"Perfeito. E o seu foco hoje está mais em valorização, renda futura ou uma boa condição de entrada?", tip:"Qualifica rápido."},{label:"Análise de retorno", text:"Para esse perfil, o que costuma fazer mais diferença é a análise de retorno em médio prazo. Quer que eu te mostre como esse produto se encaixa nessa perspectiva?", tip:"Boa para investidores mais sofisticados."}]},
  {id:"ghost", match:["não respondeu","sem retorno","sumiu","não voltou","dias sem resposta","semanas sem resposta"], situation:"Cliente sumiu sem dar retorno", heat:"Frio", profile:"Indeterminado — requer requalificação", risk:"Alto", goal:"Reativar o contato com leveza sem parecer insistente.", next:"Mensagem curta que reabre a conversa sem cobrança.", avoid:"Evite mandar várias mensagens seguidas ou pressionar por resposta.", chips:["lead frio","sem resposta","reativação"], responses:[{label:"Reativar com leveza", text:"Olá, [nome]! Fiquei na dúvida se você conseguiu olhar com calma o que eu te enviei. Se fizer sentido retomar, fico à disposição.", tip:"Curta. Não pressiona. Reabre a conversa."},{label:"Com novidade", text:"Olá, [nome]! Tenho uma atualização sobre o [empreendimento] que pode te interessar. Posso te enviar?", tip:"Cria motivo para o contato."}]},
  {id:"busy", match:["viajando","viagem","ocupado","ocupada","férias","sem tempo","quando eu voltar","depois que voltar"], situation:"Cliente indisponível temporariamente", heat:"Morno para frio", profile:"Interessado mas sem janela de atenção", risk:"Baixo se bem gerenciado", goal:"Respeitar o momento e garantir a retomada no tempo certo.", next:"Confirmar quando ele volta e registrar para retomada.", avoid:"Evite empurrar produto enquanto ele está ocupado.", chips:["timing","retomada","respeito ao momento"], responses:[{label:"Agenda aberta", text:"Sem problema! Pode me chamar quando voltar e a gente retoma com calma.", tip:"Boa para clientes ocupados ou viajando."},{label:"Confirmar retorno", text:"Entendido! Quando você voltar, pode me chamar e a gente retoma. Quando é mais ou menos a sua previsão de retorno?", tip:"Cria compromisso de retomada sem pressionar."}]},
  {id:"competitor", match:["outro corretor","já estou sendo atendido","já tenho corretor","não preciso","estou sendo atendido"], situation:"Cliente já tem outro corretor", heat:"Frio", profile:"Em atendimento paralelo", risk:"Médio a alto", goal:"Se posicionar como especialista sem atacar a concorrência.", next:"Oferecer uma segunda visão diferenciada de forma respeitosa.", avoid:"Evite falar mal do outro corretor ou pressionar a troca.", chips:["concorrência","posicionamento","diferenciação"], responses:[{label:"Respeitosa e firme", text:"Entendo, e respeito. O que posso oferecer é uma segunda visão, porque trabalho esse produto de uma forma diferente e posso te mostrar algumas informações que talvez você ainda não tenha visto. Se fizer sentido, fico à disposição.", tip:"Boa para se posicionar como especialista."},{label:"Sem pressão", text:"Tudo certo. Se em algum momento você quiser uma segunda opinião ou mais detalhes, pode me chamar.", tip:"Curta e respeitosa."}]}
];

/* ═══════════════════════════════════════
   STOP WORDS (extração de nome)
═══════════════════════════════════════ */
const stopWords = new Set([
  "olá","ola","oi","bom","boa","dia","tarde","noite","tudo","bem","claro","sim","não","nao",
  "ok","certo","pode","quero","tenho","gostei","valor","entrada","andar","planta","visita",
  "agendar","obrigado","obrigada","perfeito","interessante","whatsapp","mensagem","encaminhada",
  "encaminhado","histórico","historico","conversa","última","ultimo","você","voce","como",
  "quando","por","que","uma","uns","com","para","mas","muito","mais","esta","esse",
  "isso","aqui","agora","hoje","ontem","semana","mês","mes","ano","novo","nova","podemos",
  "fica","pra","pelo","pela","veja","vou","ver","tem","ter","faz","fazer",
  "seja","seria","ainda","após","apos","antes","depois","desde","sempre",
  "nunca","talvez","acho","sei","sabe","saber","quer","querer","precisa","preciso",
  "hd","re","id","app","chat","audio","video","imagem","foto","arquivo","link",
  "status","online","lido","enviado","recebido","deletado","apagado","reencaminhada",
  "mensagens","contato","grupo","comunidade","broadcast","silenciar","fixar","marcar",
  "janeiro","fevereiro","março","marco","abril","maio","junho","julho","agosto",
  "setembro","outubro","novembro","dezembro","segunda","terça","terca","quarta","quinta",
  "sexta","sábado","sabado","domingo","amanhã","amanha"
]);

/* ═══════════════════════════════════════
   EXTRAIR NOME DO CLIENTE
═══════════════════════════════════════ */
function extractNameFromText(raw) {
  if (!raw) return "";
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean);

  function isValidName(word) {
    if (!word || word.length < 4) return false;
    if (stopWords.has(word.toLowerCase())) return false;
    if (/\d/.test(word)) return false;
    if (!/^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ]/.test(word)) return false;
    return true;
  }

  for (const line of lines.slice(0, 20)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ][a-záéíóúàâêôãõçñ]{3,})\s+([A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ][a-záéíóúàâêôãõçñ]{3,})(\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ][a-záéíóúàâêôãõçñ]{2,})?$/);
    if (m && isValidName(m[1])) return m[1];
  }
  for (let i = 0; i < Math.min(lines.length - 1, 30); i++) {
    const cur = lines[i], next = lines[i + 1];
    if (/^\d{1,2}:\d{2}/.test(next) && /^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ][a-záéíóúàâêôãõçñ]{3,}(\s[A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ][a-záéíóúàâêôãõçñ]{2,})*$/.test(cur)) {
      const first = cur.split(" ")[0];
      if (isValidName(first)) return first;
    }
  }
  for (const line of lines.slice(0, 30)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ][a-záéíóúàâêôãõçñ]{3,})\s*:/);
    if (m && isValidName(m[1])) return m[1];
  }
  for (const line of lines.slice(0, 15)) {
    const m = line.match(/^([A-ZÁÉÍÓÚÀÂÊÔÃÕÇÑ][a-záéíóúàâêôãõçñ]{4,})(\s|$)/);
    if (m && isValidName(m[1])) return m[1];
  }
  return "";
}

/* ═══════════════════════════════════════
   HELPERS DE UI
═══════════════════════════════════════ */
function $(id) { return document.getElementById(id); }
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function showToast(t){const el=$("toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200);}
function showLoading(title,text){$("loadingTitle").textContent=title||"Processando";$("loadingText").textContent=text||"Aguarde...";$("loadingOverlay").classList.add("show");}
function hideLoading(){$("loadingOverlay").classList.remove("show");}
function openCopyFallback(text){$("copyFallbackText").value=text;$("copyOverlay").classList.add("show");setTimeout(()=>{$("copyFallbackText").focus();$("copyFallbackText").select();},80);}
function closeCopyFallback(){$("copyOverlay").classList.remove("show");}
function legacyCopy(text){const t=document.createElement("textarea");t.value=text;t.setAttribute("readonly","");t.style.cssText="position:fixed;opacity:0;";document.body.appendChild(t);t.focus();t.select();let ok=false;try{ok=document.execCommand("copy");}catch(e){}document.body.removeChild(t);return ok;}
async function forceCopyFallback(){const text=$("copyFallbackText").value||"";if(!text){showToast("Nada para copiar.");return;}try{await navigator.clipboard.writeText(text);closeCopyFallback();showToast("Texto copiado.");return;}catch(e){}if(legacyCopy(text)){closeCopyFallback();showToast("Texto copiado.");}else{$("copyFallbackText").select();showToast("Toque e segure o texto para copiar.");}}
async function copyText(text){try{await navigator.clipboard.writeText(text);showToast("Texto copiado.");return;}catch(e){}if(legacyCopy(text)){showToast("Texto copiado.");return;}openCopyFallback(text);}
function updatePrintCounters(){$("historyCount").textContent=String(historyPrintTexts.length);$("lastCount").textContent=lastPrintText?"1":"0";}

/* ═══════════════════════════════════════
   SAUDAÇÃO E INTRO
═══════════════════════════════════════ */
function buildGreeting(rule, raw) {
  const name = extractNameFromText(raw);
  return name ? `Olá, ${name}. Tudo bem?` : "Olá! Tudo bem?";
}

function buildContextIntro(rule, raw) {
  const text = (raw || "").toLowerCase();
  if ((rule||{}).id === "visit_stalled") return "Estava retomando as conversas e vi que falamos sobre a visita.";
  if ((rule||{}).id === "cold_silent") return "Estava retomando as conversas e vi que falamos sobre as opções que te enviei.";
  if (/andar|andares|altura|posição|posicao/.test(text)) return "Estava retomando as conversas e vi que falamos sobre os andares e as opções disponíveis.";
  if (/valor|preço|preco|entrada|parcela|condição|condicao/.test(text)) return "Estava retomando as conversas e vi que falamos sobre valores e condição de pagamento.";
  if (/planta|metragem|m²|m2|dormit|suíte|suite/.test(text)) return "Estava retomando as conversas e vi que falamos sobre a planta e o perfil do imóvel.";
  if (/invest|valorização|valorizacao|renda futura|alugar/.test(text)) return "Estava retomando as conversas e vi que falamos sobre o potencial de investimento.";
  if (/esposa|marido|família|familia|filho|filha/.test(text)) return "Estava retomando as conversas e vi que falamos sobre analisar isso em conjunto.";
  return "Estava retomando as conversas e vi que falamos sobre essa oportunidade.";
}

function normalizeSuggestionText(text) {
  let t = (text || "").trim();
  t = t.replace(/[ \t]+/g, " ").trim();
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  t = t.replace(/(Obrigado[^.?!]*[.?!])/gi, "\n\n$1");
  t = t.replace(/(Recebi seu interesse[^.?!]*[.?!])/gi, "\n\n$1");
  t = t.replace(/(Estava retomando as conversas e vi que falamos sobre[^.?!]*[.?!])/gi, "\n\n$1");
  t = t.replace(/(Posso te passar[^?]*\?)/gi, "\n\n$1");
  t = t.replace(/(Me confirma[^?]*\?)/gi, "\n\n$1");
  t = t.replace(/(O que pesa mais[^?]*\?)/gi, "\n\n$1");
  t = t.replace(/(Se eu te apresentar[^?]*\?)/gi, "\n\n$1");
  t = t.replace(/(Se fizer sentido[^.?!]*[.?!])/gi, "\n\n$1");
  t = t.replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

/* ═══════════════════════════════════════
   ANÁLISE LOCAL
═══════════════════════════════════════ */
function scoreRule(text, rule) { let s=0; for(const t of rule.match){if(text.includes(t)) s++;} return s; }

function getPriorityText(raw) {
  if (lastPrintText && lastPrintText.trim()) return lastPrintText.toLowerCase();
  return (raw || "").toLowerCase().slice(-900);
}

function detectLastIntent(raw) {
  const text = getPriorityText(raw);
  if (/qual\s+andar|quais\s+andares|andar|andares|altura|alto|mais\s+alto/.test(text)) {
    return {id:"andar", next:"Responder a dúvida de andar e conduzir a escolha por posição, altura ou valor.", responses:[{label:"Conduzir após andar", text:"Perfeito. Entre os andares que te passei, já consigo te indicar qual faz mais sentido conforme o que você valoriza mais: altura, posição ou melhor custo-benefício. O que pesa mais pra você nessa escolha?", tip:"Responde e conduz ao mesmo tempo."},{label:"Direção mais consultiva", text:"Perfeito. Normalmente, quando o cliente pergunta sobre andar, a melhor escolha depende de altura, posição e condição. Se você quiser, eu já te digo qual dessas opções hoje faz mais sentido para o seu perfil.", tip:"Boa para não deixar a conversa parar no dado técnico."}]};
  }
  if (/qual\s+valor|valor|preço|preco|quanto/.test(text)) {
    return {id:"valor", next:"Responder valor e conduzir para condição, entrada ou encaixe da proposta.", responses:[{label:"Conduzir após valor", text:"Perfeito. Além do valor, o que realmente define a melhor escolha é como essa condição se encaixa para você. O que pesa mais hoje: entrada, parcela ou valor total?", tip:"Evita morrer no preço seco."},{label:"Valor com direção", text:"Perfeito. Posso te passar o valor, mas o mais importante aqui é te direcionar para a opção que faça mais sentido no teu momento. Você está olhando mais pela melhor condição ou pelo melhor produto?", tip:"Boa quando o cliente está comparando."}]};
  }
  if (/planta|metragem|m²|m2|metros|tamanho|su[ií]te|dormit[oó]rios/.test(text)) {
    return {id:"planta", next:"Responder planta ou metragem e conduzir pela prioridade do cliente.", responses:[{label:"Conduzir após planta", text:"Perfeito. Posso te direcionar pela planta que mais encaixa no teu objetivo. Você está olhando mais metragem, divisão dos ambientes ou condição de pagamento?", tip:"Transforma curiosidade em qualificação."},{label:"Mais consultiva", text:"Perfeito. Entre essas opções, a melhor escolha depende do que você prioriza no uso do imóvel. Se você quiser, eu já te indico qual planta costuma fazer mais sentido no teu perfil.", tip:"Boa para levar à escolha."}]};
  }
  if (/tem\s+ainda|dispon[ií]vel|dispon[ií]veis|sobrou|resta|restam|tem\s+unidade/.test(text)) {
    return {id:"disponibilidade", next:"Confirmar disponibilidade e puxar para escolha da melhor unidade.", responses:[{label:"Conduzir após disponibilidade", text:"Perfeito. Temos disponibilidade, e eu posso te direcionar agora para a unidade que hoje faz mais sentido, seja pela posição ou pela condição. O que pesa mais para você nessa escolha?", tip:"Boa para avançar depois do sim."},{label:"Mais objetiva", text:"Perfeito. Ainda temos opções, e o ideal agora é eu te mostrar qual delas está mais interessante no momento. Você quer que eu te direcione pela melhor condição ou pela melhor posição?", tip:"Abre dois caminhos úteis."}]};
  }
  if (/gostei|gostei de todos|interessei|interessou|curti/.test(text)) {
    return {id:"gostou", next:"Aproveitar o interesse e conduzir a uma escolha objetiva.", responses:[{label:"Conduzir após gostar", text:"Perfeito. Entre as opções que você gostou, já consigo te apontar qual faz mais sentido no teu perfil hoje. Você está olhando mais para morar ou para investimento?", tip:"Boa para transformar interesse em direção."},{label:"Mais objetiva", text:"Perfeito. Como você gostou das opções, o próximo passo é eu te afunilar isso para a melhor escolha. O que pesa mais pra você agora: valor, posição ou condição?", tip:"Puxa decisão."}]};
  }
  return null;
}

function detectVisitStalled(raw) {
  const text = (raw || "").toLowerCase();
  return /visita|visitar|conhecer|podemos visitar/.test(text) && /quando fica bom|qual dia|que dia|prefere semana|prefere s[aá]bado|hor[áa]rio/.test(text);
}
function buildVisitStalledRule() {
  return {id:"visit_stalled", situation:"Interesse em visita com conversa parada após convite de agenda", heat:"Morno para quente", profile:"Cliente com interesse real", risk:"Médio", goal:"Retomar a marcação da visita sem parecer cobrança.", next:"Oferecer opções simples de dia ou período para facilitar a resposta.", avoid:"Evite retomada genérica ou pergunta muito aberta.", chips:["visita","retomada","agenda"], responses:[{label:"Retomar visita", text:"Consigo te organizar isso sem problema. Você consegue melhor durante a semana ou prefere sábado?", tip:"Boa para destravar com duas opções simples."},{label:"Direção objetiva", text:"Posso te passar uma alternativa para esta semana ou, se ficar melhor, para o fim de semana. O que encaixa melhor para você?", tip:"Boa quando quer facilitar a resposta."},{label:"Período do dia", text:"Para eu te direcionar melhor, costuma ficar mais fácil para você de manhã, à tarde ou no fim do dia?", tip:"Boa quando o cliente travou na agenda."}]};
}
function detectUnansweredLead(raw) {
  const text = (raw || "").toLowerCase();
  return /tenho interesse|mais informa|quero mais informa|vi o an[uú]ncio|anuncio/.test(text) && /\?/.test(text) && !/andar|valor|pre[cç]o|metragem|planta|visitar|agendar|dispon[ií]vel|gostei|entrada|desconto/.test(text);
}
function buildColdLeadRule() {
  return {id:"cold_silent", situation:"Lead de anúncio sem resposta após abordagem", heat:"Frio", profile:"Ainda não qualificado", risk:"Alto", goal:"Reengajar com leveza para descobrir se ainda existe interesse real.", next:"Fazer uma retomada curta e elegante para reabrir a conversa.", avoid:"Evite tratar como lead quente ou empurrar produto sem antes reconquistar a atenção.", chips:["lead frio","sem resposta","reativação"], responses:[{label:"Retomada elegante", text:"Fiquei na dúvida se você conseguiu olhar com calma o que eu te enviei.", tip:"Boa para reabrir sem pressão."},{label:"Reengajar com direção", text:"Se fizer sentido para você, posso te sugerir uma alternativa mais alinhada com o seu perfil hoje.", tip:"Boa para puxar resposta sem insistência."}]};
}

function analyzeMessage() {
  $("aiResultBadge").style.display = "none";
  const raw = ($("clientMessage").value || "").trim();
  if (!raw) { showToast("Adicione pelo menos uma mensagem ou print."); return; }
  const text = raw.toLowerCase();
  const scored = analyzerRules.map(rule => ({rule, score: scoreRule(text, rule)})).sort((a,b) => b.score - a.score);
  let selected = scored.filter(x => x.score > 0).slice(0, 2).map(x => x.rule);
  if (detectVisitStalled(raw)) selected = [buildVisitStalledRule()];
  else if (detectUnansweredLead(raw)) selected = [buildColdLeadRule()];
  else if (!selected.length) selected = [{id:"default", situation:"Situação geral de atendimento", heat:"Morno", profile:"A definir", risk:"Médio", goal:"Entender o ponto real antes de responder no impulso.", next:"Fazer uma pergunta curta que direcione a conversa.", avoid:"Evite responder rápido demais sem identificar se o cliente está comparando, travado ou pronto para avançar.", chips:["leitura geral","condução","qualificação"], responses:[{label:"Pergunta de direção", text:"Perfeito. Para eu te direcionar da forma mais adequada, me confirma uma coisa: hoje o que mais pesa para você nessa análise é condição de pagamento, perfil do imóvel ou momento da compra?", tip:"Boa quando a mensagem não cai num padrão claro."},{label:"Condução consultiva", text:"Entendi. Se você quiser, eu posso te direcionar de forma mais objetiva, conforme o que faz mais sentido para o seu perfil hoje.", tip:"Mantém elegância e controle."}]}];

  const primary = selected[0], secondary = selected[1] || null;
  const lastIntent = detectLastIntent(raw);

  $("analysisSituation").textContent = secondary ? primary.situation + " + " + secondary.situation.toLowerCase() : primary.situation;
  $("analysisHeat").textContent = primary.heat;
  $("analysisProfile").textContent = primary.profile;
  $("analysisRisk").textContent = primary.risk;
  $("analysisGoal").textContent = lastIntent ? "Responder a última pergunta ou afirmação do cliente e, em seguida, conduzir a conversa." : primary.goal;
  $("analysisNext").textContent = lastIntent ? lastIntent.next : primary.next;

  const baseChips = [...(primary.chips || []), ...(((secondary || {}).chips) || [])];
  const intentChipMap = {andar:"última pergunta: andar", valor:"última pergunta: valor", planta:"última pergunta: planta", disponibilidade:"última pergunta: disponibilidade", gostou:"último movimento: gostou"};
  if (lastIntent && intentChipMap[lastIntent.id]) baseChips.unshift(intentChipMap[lastIntent.id]);
  $("analysisChips").innerHTML = [...new Set(baseChips)].map((chip, i) => `<span class="chip ${i===0?"warn":""} ${chip.toLowerCase().includes("quente")?"ok":""}">${escapeHtml(chip)}</span>`).join("");

  const avoidEl = $("analysisAvoid");
  avoidEl.style.display = "block";
  avoidEl.textContent = "⚠ Erro a evitar: " + (lastIntent ? "Responder só o dado técnico e deixar a conversa morrer sem condução." : primary.avoid);

  const combined = lastIntent
    ? [...lastIntent.responses, ...(primary.responses||[]), ...(((secondary||{}).responses)||[])].slice(0,4)
    : [...(primary.responses||[]), ...(((secondary||{}).responses)||[])].slice(0,4);

  const greeting = buildGreeting(primary, raw);
  const intro = buildContextIntro(primary, raw);
  const responses = combined.map(r => ({...r, fullText: normalizeSuggestionText(greeting + "\n\n" + intro + "\n\n" + r.text)}));
  if (primary.id === "cold_silent") responses.forEach(r => { r.fullText = r.fullText.replace(/\nPerfeito[.,]/g, ""); });
  lastBestResponse = responses[0] ? responses[0].fullText : "";
  renderResponses(responses);
}

function renderResponses(responses) {
  const wrap = $("analysisResponses");
  wrap.innerHTML = responses.map((r, i) => `
    <div class="response ${i===0?"best":""}">
      <div class="top">
        <span class="tag ${i===0?"gold":""}">${escapeHtml(r.label)}${i===0?" · melhor linha":""}</span>
        <button class="btn dark btn-copy" data-copy-idx="${i}" style="padding:9px 13px;min-height:auto;font-size:12.5px;">Copiar</button>
      </div>
      <p>${escapeHtml(r.fullText)}</p>
      <div class="tip">${escapeHtml(r.tip)}</div>
    </div>
  `).join("");
  // Event delegation segura (sem JSON.stringify dentro de atributos)
  wrap.querySelectorAll('.btn-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.copyIdx, 10);
      copyText(responses[idx].fullText || responses[idx].texto || "");
    });
  });
}

/* ═══════════════════════════════════════
   ANÁLISE COM IA (via Worker)
═══════════════════════════════════════ */
async function analyzeWithAI() {
  const raw = ($("clientMessage").value || "").trim();
  if (!raw) { showToast("Cole a mensagem do cliente antes de analisar."); return; }

  const license = localStorage.getItem(LS_LICENSE);
  if (!license) { showGate(); return; }

  // Cancela chamada anterior se existir
  if (analyzeAbortController) analyzeAbortController.abort();
  analyzeAbortController = new AbortController();

  showLoading("Analisando com IA", "Claude está lendo o contexto e montando a análise completa...");

  const detectedName = extractNameFromText(raw);
  const greetingInstruction = detectedName
    ? `Inclua a saudação "Olá, ${detectedName}. Tudo bem?" no início de cada resposta.`
    : `Inclua a saudação "Olá! Tudo bem?" no início de cada resposta.`;

  try {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + license
      },
      body: JSON.stringify({ message: raw, greeting_instruction: greetingInstruction }),
      signal: analyzeAbortController.signal
    });

    if (response.status === 401 || response.status === 403) {
      hideLoading();
      const err = await response.json().catch(() => ({}));
      localStorage.removeItem(LS_LICENSE);
      localStorage.removeItem(LS_NAME);
      showGate(err?.error || "Sua licença não é mais válida.");
      return;
    }
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      hideLoading();
      showToast("Erro: " + (err?.error || `HTTP ${response.status}`));
      return;
    }
    const data = await response.json();
    const text = (data.content || []).map(i => i.text || "").join("");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      hideLoading();
      showToast("IA não retornou formato esperado. Tente novamente.");
      return;
    }
    const parsed = JSON.parse(jsonMatch[0]);
    renderAIAnalysis(parsed);
    showToast("Análise com IA concluída.");
  } catch(err) {
    if (err.name === 'AbortError') return; // cancelamento intencional
    console.error(err);
    showToast("Erro: " + (err.message || "falha desconhecida"));
  } finally {
    hideLoading();
    analyzeAbortController = null;
  }
}

function renderAIAnalysis(parsed) {
  $("aiResultBadge").style.display = "inline-flex";
  $("analysisSituation").textContent = parsed.situacao || "—";
  $("analysisHeat").textContent = parsed.temperatura || "—";
  $("analysisProfile").textContent = parsed.perfil || "—";
  $("analysisRisk").textContent = parsed.risco || "—";
  $("analysisGoal").textContent = parsed.objetivo || "—";
  $("analysisNext").textContent = parsed.proximo_passo || "—";
  $("analysisChips").innerHTML = (parsed.chips || []).map((chip, i) => `<span class="chip ${i===0?"warn":""}">${escapeHtml(chip)}</span>`).join("");
  const avoidEl = $("analysisAvoid");
  if (parsed.evitar) { avoidEl.style.display = "block"; avoidEl.textContent = "⚠ Erro a evitar: " + parsed.evitar; }
  else { avoidEl.style.display = "none"; }
  const respostas = (parsed.respostas || []).map(r => ({
    label: r.label || "Resposta",
    fullText: (r.texto || "").replace(/\\n/g, "\n"),
    tip: r.dica || ""
  }));
  lastBestResponse = respostas[0] ? respostas[0].fullText : "";
  renderResponses(respostas);
}

/* ═══════════════════════════════════════
   LIMPAR
═══════════════════════════════════════ */
function clearAnalyzer() {
  if (analyzeAbortController) { analyzeAbortController.abort(); analyzeAbortController = null; }
  $("clientMessage").value = "";
  $("analysisSituation").textContent = "Cole uma mensagem para analisar.";
  ["analysisHeat","analysisProfile","analysisRisk","analysisGoal","analysisNext"].forEach(id => $(id).textContent = "—");
  $("analysisChips").innerHTML = "";
  $("analysisAvoid").style.display = "none";
  $("aiResultBadge").style.display = "none";
  $("analysisResponses").innerHTML = '<div class="empty">Cole a mensagem do cliente ou anexe os prints e toque em <strong>Analisar agora</strong>.</div>';
  lastBestResponse = ""; historyPrintTexts = []; lastPrintText = ""; updatePrintCounters();
}

/* ═══════════════════════════════════════
   PRINTS / OCR (Tesseract sob demanda)
═══════════════════════════════════════ */
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractLoading) return tesseractLoading;
  tesseractLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => { tesseractLoading = null; reject(new Error('Falha ao carregar OCR.')); };
    document.head.appendChild(s);
  });
  return tesseractLoading;
}

function rebuildMessageFromPrints() {
  const parts = [];
  if (historyPrintTexts.length) historyPrintTexts.forEach((tx, i) => parts.push("=== HISTÓRICO DA CONVERSA " + (i+1) + " ===\n" + tx));
  if (lastPrintText) parts.push("=== ÚLTIMA CONVERSA ===\n" + lastPrintText);
  $("clientMessage").value = parts.join("\n\n");
  updatePrintCounters();
}

async function handlePrintUpload(files, type) {
  const fileList = Array.from(files || []);
  if (!fileList.length) return;
  const isHistory = type === "history";

  showLoading("Preparando OCR", "Carregando o leitor de imagem (pode demorar na primeira vez).");
  let Tesseract;
  try { Tesseract = await loadTesseract(); }
  catch(err) { hideLoading(); showToast("Não consegui carregar o OCR. Verifique sua internet."); return; }

  showLoading(isHistory ? "Lendo histórico da conversa" : "Lendo última conversa",
              isHistory ? "Aguarde enquanto o sistema extrai o contexto geral." : "Aguarde enquanto o sistema extrai a parte mais recente.");
  try {
    if (isHistory) {
      let lidos = 0;
      for (const file of fileList) {
        const result = await Tesseract.recognize(file, "por");
        const extracted = result?.data?.text?.trim() || "";
        if (extracted) { historyPrintTexts.push(extracted); lidos++; }
      }
      if (!lidos) { hideLoading(); showToast("Não consegui ler os prints do histórico."); return; }
    } else {
      const file = fileList[fileList.length - 1];
      const result = await Tesseract.recognize(file, "por");
      const extracted = result?.data?.text?.trim() || "";
      if (!extracted) { hideLoading(); showToast("Não consegui ler o último print."); return; }
      lastPrintText = extracted;
    }
    rebuildMessageFromPrints();
    showLoading("Analisando conversa", "Os prints foram lidos. Montando a leitura e as respostas sugeridas.");
    setTimeout(() => {
      try { analyzeMessage(); showToast(isHistory ? "Histórico lido e analisado." : "Última conversa lida e analisada."); }
      catch(err) { console.error(err); showToast("Erro ao analisar a conversa."); }
      finally { hideLoading(); }
    }, 180);
  } catch(err) { console.error(err); hideLoading(); showToast("Erro ao ler o print."); }
}

/* ═══════════════════════════════════════
   BIBLIOTECA
═══════════════════════════════════════ */
function renderTabs() {
  $("tabs").innerHTML = libraryData.map(tab => `<button class="tab ${tab.id===currentTab?"active":""}" data-tab-id="${tab.id}">${escapeHtml(tab.title)}</button>`).join("");
  $("tabs").querySelectorAll('.tab').forEach(b => {
    b.addEventListener('click', () => setTab(b.dataset.tabId));
  });
}
function setTab(id) { currentTab = id; renderTabs(); renderLibrary(); }
function renderLibrary() {
  const wrap = $("library");
  const search = $("search").value.trim().toLowerCase();
  const tab = libraryData.find(item => item.id === currentTab);
  const filtered = tab.topics.filter(topic => {
    if (!search) return true;
    return [topic.title, topic.subtitle, ...topic.responses.map(r => r.label+" "+r.text+" "+r.tip)].join(" ").toLowerCase().includes(search);
  });
  if (!filtered.length) { wrap.innerHTML = '<div class="section"><div class="empty">Nada encontrado nesta aba para essa busca.</div></div>'; return; }
  wrap.innerHTML = filtered.map((topic, idx) => `
    <section class="topic ${idx===0?"open":""}">
      <button class="topicBtn" data-toggle-topic>
        <div><strong>${escapeHtml(topic.title)}</strong><span>${escapeHtml(topic.subtitle)}</span></div>
        <i class="chevron">+</i>
      </button>
      <div class="topicBody">
        ${topic.responses.map((r, i) => `
          <div class="response ${i===0?"best":""}">
            <div class="top">
              <span class="tag ${i===0?"gold":""}">${escapeHtml(r.label)}</span>
              <button class="btn dark btn-lib-copy" data-copy-text="${escapeHtml(r.text)}" style="padding:9px 13px;min-height:auto;font-size:12.5px;">Copiar</button>
            </div>
            <p>${escapeHtml(r.text)}</p>
            <div class="tip">${escapeHtml(r.tip)}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");
  // Event handlers
  wrap.querySelectorAll('[data-toggle-topic]').forEach(btn => {
    btn.addEventListener('click', () => btn.closest(".topic").classList.toggle("open"));
  });
  wrap.querySelectorAll('.btn-lib-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      // Decodifica entidades HTML pra recuperar o texto original
      const tmp = document.createElement('div');
      tmp.innerHTML = btn.dataset.copyText;
      copyText(tmp.textContent);
    });
  });
}

/* ═══════════════════════════════════════
   GATE DE LICENÇA
═══════════════════════════════════════ */
function showGate(errorMsg) {
  $("appRoot").style.display = 'none';
  $("gateOverlay").classList.add('show');
  if (errorMsg) {
    const e = $("gateError");
    e.textContent = errorMsg;
    e.classList.add('show');
  }
  setTimeout(() => $("gateInput").focus(), 100);
}

function hideGate() {
  $("gateOverlay").classList.remove('show');
  $("appRoot").style.display = 'block';
  $("gateError").classList.remove('show');
}

async function submitLicense() {
  const input = $("gateInput");
  const key = (input.value || '').trim().toUpperCase();
  const errEl = $("gateError");
  errEl.classList.remove('show');

  if (!key || !/^DIR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
    errEl.textContent = "Formato inválido. A chave começa com DIR- e tem três blocos.";
    errEl.classList.add('show');
    return;
  }

  const btn = $("gateSubmit");
  btn.disabled = true;
  btn.textContent = 'Validando...';

  try {
    const response = await fetch(`${API_BASE}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key })
    });
    const data = await response.json();
    if (!response.ok || !data.valid) {
      const reasons = {
        not_found: 'Chave não encontrada. Confira com seu fornecedor.',
        inactive: 'Esta licença está cancelada ou pausada.',
        expired:  'Sua licença venceu. Entre em contato para renovar.',
        missing_key: 'Chave ausente.'
      };
      errEl.textContent = reasons[data.reason] || (data.error || 'Licença inválida.');
      errEl.classList.add('show');
      return;
    }
    localStorage.setItem(LS_LICENSE, key);
    if (data.name) localStorage.setItem(LS_NAME, data.name);
    updateWhoLabel();
    hideGate();
    showToast('Licença ativada. Bom trabalho!');
  } catch(err) {
    errEl.textContent = 'Erro de conexão. Verifique sua internet e tente de novo.';
    errEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function logout() {
  if (!confirm('Tem certeza que quer sair? Você vai precisar colar a chave de novo.')) return;
  localStorage.removeItem(LS_LICENSE);
  localStorage.removeItem(LS_NAME);
  showGate();
}

function updateWhoLabel() {
  const name = localStorage.getItem(LS_NAME);
  $("whoLabel").textContent = name ? name : '';
}

async function checkExistingLicense() {
  const key = localStorage.getItem(LS_LICENSE);
  if (!key) { showGate(); return; }
  // Re-valida silenciosamente em background. Se inválida, força gate.
  try {
    const response = await fetch(`${API_BASE}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key })
    });
    const data = await response.json();
    if (!data.valid) {
      localStorage.removeItem(LS_LICENSE);
      localStorage.removeItem(LS_NAME);
      const reasons = {
        not_found: 'Sua chave não consta mais no sistema.',
        inactive: 'Sua assinatura foi pausada ou cancelada.',
        expired:  'Sua assinatura venceu.',
      };
      showGate(reasons[data.reason] || 'Licença inválida.');
      return;
    }
    if (data.name) localStorage.setItem(LS_NAME, data.name);
    updateWhoLabel();
    hideGate();
  } catch(err) {
    // Sem internet: deixa entrar com cache, app local funciona
    updateWhoLabel();
    hideGate();
  }
}

/* ═══════════════════════════════════════
   EVENTOS E INICIALIZAÇÃO
═══════════════════════════════════════ */
function bindEvents() {
  $("btnAnalyze").addEventListener("click", analyzeMessage);
  $("btnAnalyzeAI").addEventListener("click", analyzeWithAI);
  $("btnClear").addEventListener("click", clearAnalyzer);
  $("btnForceCopy").addEventListener("click", forceCopyFallback);
  $("btnCloseCopy").addEventListener("click", closeCopyFallback);
  $("logoutBtn").addEventListener("click", logout);

  $("historyPrintInput").addEventListener("change", async e => {
    await handlePrintUpload(e.target.files, "history");
    e.target.value = "";
  });
  $("lastPrintInput").addEventListener("change", async e => {
    await handlePrintUpload(e.target.files, "last");
    e.target.value = "";
  });
  $("clientMessage").addEventListener("paste", async e => {
    const items = Array.from((e.clipboardData?.items) || []);
    const imageItems = items.filter(i => i.type?.startsWith("image/"));
    if (!imageItems.length) return;
    e.preventDefault();
    const files = imageItems.map(i => i.getAsFile()).filter(Boolean);
    if (files.length) await handlePrintUpload(files, "history");
  });
  $("search").addEventListener("input", renderLibrary);

  // Gate
  $("gateSubmit").addEventListener("click", submitLicense);
  $("gateInput").addEventListener("keydown", e => { if (e.key === "Enter") submitLicense(); });
  $("gateHelp").addEventListener("click", () => {
    alert("Para obter sua chave, entre em contato com o fornecedor do Direciona App. A chave tem o formato DIR-XXXX-XXXX-XXXX.");
  });
}

function init() {
  currentTab = libraryData[0].id;
  bindEvents();
  updatePrintCounters();
  renderTabs();
  renderLibrary();
  checkExistingLicense();

  // Service worker para PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW falhou:', err));
  }
}

document.addEventListener('DOMContentLoaded', init);
