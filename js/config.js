/*
 * ==========================================================
 *  CONFIGURAÇÃO DA FONSECA TEAM
 *  Todos os dados editáveis do site e do app ficam aqui.
 * ==========================================================
 */
window.CONFIG = {
  coachName: "Maicon Fonseca",
  // Somente números, com 55 + DDD.
  whatsapp: "554197611616",
  whatsappDisplay: "(41) 9761-1616",
  instagram: "@fonseca.treinador",

  // Planos. "price" é o valor total; o site calcula o valor por protocolo e a economia.
  plans: [
    {
      name: "1 Protocolo", protocols: 1, price: 249.5, cta: "Escolher 1 Protocolo",
      description: "Opção ideal para quem deseja iniciar com estratégia e acompanhamento profissional.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos"]
    },
    {
      name: "2 Protocolos", protocols: 2, price: 465.5, cta: "Quero o plano premium", featured: true,
      description: "Formato premium recomendado para quem busca constância, acompanhamento sólido e melhor custo-benefício.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos", "Maior compromisso com o processo"]
    },
    {
      name: "3 Protocolos", protocols: 3, price: 611.4, cta: "Escolher 3 Protocolos",
      description: "Excelente escolha para manter evolução contínua e maior tempo de acompanhamento.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos", "Maior compromisso com o processo"]
    },
    {
      name: "6 Protocolos", protocols: 6, price: 1200, cta: "Escolher 6 Protocolos",
      description: "Plano para quem quer estrutura, acompanhamento prolongado e máxima consistência.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos", "Maior compromisso com o processo"]
    }
  ],

  // Vídeos da história, sem som. Índice 0 = fundo da abertura; 1 a 7 = capítulos.
  // Coloque os arquivos em assets/videos/ e preencha "video" e "poster".
  // "mobile" é opcional (versão vertical). Sem vídeo, o capítulo usa um fundo da marca.
  // Ex.: { video: "assets/videos/story-01.mp4", mobile: "assets/videos/story-01-m.mp4", poster: "assets/videos/story-01.jpg" }
  story: [
    { video: "", mobile: "", poster: "" }, // 00 · abertura
    { video: "", mobile: "", poster: "" }, // 01 · segunda-feira
    { video: "", mobile: "", poster: "" }, // 02 · planilha da internet
    { video: "", mobile: "", poster: "" }, // 03 · Maicon
    { video: "", mobile: "", poster: "" }, // 04 · protocolo
    { video: "", mobile: "", poster: "" }, // 05 · WhatsApp
    { video: "", mobile: "", poster: "" }, // 06 · constância
    { video: "", mobile: "", poster: "" }  // 07 · Fonseca Team
  ],

  // Perguntas frequentes. Para adicionar uma resposta que falta, descomente e preencha.
  faq: [
    { q: "Preciso treinar em academia?", a: "Não necessariamente. Eu monto o treino de acordo com o local e os equipamentos que você tem. Você me conta isso na anamnese." },
    { q: "Sou iniciante. Serve para mim?", a: "Serve. O protocolo respeita o seu nível atual, e pelo WhatsApp eu tiro suas dúvidas de execução." },
    { q: "Como funciona o suporte no WhatsApp?", a: "Você fala direto comigo pelo WhatsApp para tirar dúvidas sobre o treino e a execução dos exercícios durante o acompanhamento." },
    { q: "Tenho lesão ou limitação. Posso participar?", a: "Pode. Lesões, dores e limitações entram na anamnese, e o treino é montado respeitando cada uma delas. Em alguns casos posso pedir liberação médica." },
    { q: "Atende em qual região?", a: "A consultoria é online e atende alunos em todo o Brasil." },
    { q: "Como contratar?", a: "Escolha o plano e clique no botão. A conversa abre no WhatsApp e eu te passo os próximos passos." }
    // { q: "O que é um protocolo e quanto tempo dura?", a: "" },
    // { q: "Como funciona a parte de alimentação?", a: "" },
    // { q: "De quanto em quanto tempo o treino é ajustado?", a: "" },
    // { q: "Quais são as formas de pagamento?", a: "" }
  ],

  // Site-app. Deixe em branco para usar o MODO DEMONSTRAÇÃO (dados salvos só no aparelho).
  // Para usar de verdade, crie um projeto no Supabase e cole aqui a URL e a chave pública (anon).
  supabase: {
    url: "",
    anonKey: ""
  }
};
