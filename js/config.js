/*
 * ==========================================================
 *  CONFIGURAÇÃO DO SITE — FONSECA TEAM
 *  Edite aqui contatos, vídeo da hero, planos, resultados,
 *  depoimentos, Instagram e FAQ. O layout se ajusta sozinho.
 *  A história do Maicon (capítulos e bastidores) fica em
 *  js/story.config.js.
 * ==========================================================
 */
window.SITE = {
  coach: "Maicon Fonseca",
  // Número do registro profissional, como aparece na carteira.
  cref: "XXXXXX-G/PR",
  formacao: "Bacharel em Educação Física", // edite com a formação real

  // Somente números, com 55 + DDD.
  whatsapp: "554197611616",
  whatsappDisplay: "(41) 9761-1616",
  whatsappMessage: "Olá Maicon! Vim pelo site e quero começar na Fonseca Team.",
  instagram: "fonseca.treinador", // sem o @

  /*
   * HERO — vídeo vertical (9:16) à direita do nome.
   * video: arquivo MP4 (ex.: "media/hero/hero.mp4") OU link do YouTube/Vimeo.
   *        Deixe "" para mostrar só a foto.
   * poster: imagem exibida enquanto o vídeo carrega.
   * photo:  foto usada quando não há vídeo. Um PNG sem fundo
   *         (ex.: "media/hero/maicon-recorte.png") fica recortado sobre o líquido.
   */
  hero: {
    video: "media/hero/hero.mp4",
    poster: "media/hero/hero-poster.jpg",
    photo: "media/hero/hero-poster.jpg",
    label: "Ao vivo no treino"
  },

  /*
   * PLANOS — "price" é texto livre (ex.: "197"). "paymentUrl": quando tiver
   * link de pagamento (Mercado Pago, Hotmart, Stripe), cole aqui e o botão
   * "Assinar" passa a abrir o pagamento em vez do WhatsApp.
   */
  plans: [
    {
      name: "Mensal",
      price: "000",
      period: "/mês",
      note: "Para começar e sentir o método na prática.",
      features: ["Treino individualizado", "Área do aluno com vídeos", "Suporte pelo WhatsApp", "Ajuste do treino no mês"],
      paymentUrl: ""
    },
    {
      name: "Trimestral",
      price: "000",
      period: "/mês",
      note: "Tempo suficiente para ver o corpo mudar.",
      features: ["Tudo do Mensal", "Reavaliação a cada 30 dias", "Ajustes conforme a evolução", "Análise de vídeo da execução"],
      featured: true,
      badge: "Mais escolhido",
      paymentUrl: ""
    },
    {
      name: "Semestral",
      price: "000",
      period: "/mês",
      note: "Para quem quer transformar de verdade.",
      features: ["Tudo do Trimestral", "Periodização de 6 meses", "Prioridade no suporte", "Melhor valor por mês"],
      paymentUrl: ""
    }
  ],

  /*
   * RESULTADOS — antes e depois. Publique apenas fotos com
   * autorização por escrito do aluno. "example: true" mostra o selo EXEMPLO.
   */
  results: [
    { before: "media/resultados/exemplo-1-antes.svg", after: "media/resultados/exemplo-1-depois.svg", name: "Aluno exemplo", detail: "12 semanas · Hipertrofia", example: true },
    { before: "media/resultados/exemplo-2-antes.svg", after: "media/resultados/exemplo-2-depois.svg", name: "Aluna exemplo", detail: "16 semanas · Emagrecimento", example: true },
    { before: "media/resultados/exemplo-3-antes.svg", after: "media/resultados/exemplo-3-depois.svg", name: "Aluno exemplo", detail: "20 semanas · Performance", example: true }
  ],

  testimonials: [
    { text: "Texto de exemplo. Troque pelo depoimento real de um aluno, com a autorização dele para publicar.", name: "Nome do aluno", detail: "Aluno há 6 meses", example: true },
    { text: "Texto de exemplo. Um bom depoimento conta o antes, o que mudou no dia a dia e o resultado.", name: "Nome da aluna", detail: "Aluna há 1 ano", example: true },
    { text: "Texto de exemplo. Frases curtas e específicas convencem mais do que elogios genéricos.", name: "Nome do aluno", detail: "Aluno há 3 meses", example: true }
  ],

  // Grade de 6 posts. Troque as imagens em media/instagram/ e cole o link de cada post.
  instagramPosts: [
    { image: "media/instagram/post-1.svg", url: "", alt: "Post do Instagram" },
    { image: "media/instagram/post-2.svg", url: "", alt: "Post do Instagram" },
    { image: "media/instagram/post-3.svg", url: "", alt: "Post do Instagram" },
    { image: "media/instagram/post-4.svg", url: "", alt: "Post do Instagram" },
    { image: "media/instagram/post-5.svg", url: "", alt: "Post do Instagram" },
    { image: "media/instagram/post-6.svg", url: "", alt: "Post do Instagram" }
  ],

  faq: [
    { q: "Como recebo o meu treino?", a: "Depois da anamnese, o Maicon monta seu treino e ele aparece na área do aluno, no celular. Cada exercício tem vídeo, séries, repetições, carga sugerida e tempo de descanso." },
    { q: "Preciso treinar em academia?", a: "Não. O treino é montado para a estrutura que você tem: academia completa, condomínio ou casa. Você informa isso na anamnese." },
    { q: "Treino em casa funciona?", a: "Funciona. Com progressão bem feita, peso livre, elásticos e o próprio corpo geram resultado. O que muda é a estratégia, não o compromisso." },
    { q: "Como funciona o suporte?", a: "Pelo WhatsApp, direto com o Maicon. Dúvidas de execução, ajustes de carga e rotina são respondidos de perto, sem robô." },
    { q: "Posso cancelar?", a: "Pode. No plano mensal, basta não renovar. Nos planos de mais meses, as condições de cancelamento são combinadas antes da assinatura, por escrito." }
  ]
};
