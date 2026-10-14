/*
 * ==========================================================
 *  CONFIGURAÇÃO DO SITE — edite aqui os dados da MF Team.
 *  Tudo que está aqui é aplicado automaticamente na página.
 * ==========================================================
 */
window.CONFIG = {
  coachName: "Maicon Fonseca",
  // Somente números, com DDI + DDD. Ex.: 554197611616
  whatsapp: "554197611616",
  whatsappDisplay: "(41) 9761-1616",
  instagram: "@fonseca.treinador",

  // Planos de consultoria. "price" é o valor total do plano.
  // O site calcula sozinho o valor por protocolo e a economia.
  plans: [
    {
      name: "1 Protocolo", protocols: 1, price: 249.5,
      description: "Opção ideal para quem deseja iniciar com estratégia e acompanhamento profissional.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos"],
      cta: "Escolher 1 Protocolo"
    },
    {
      name: "2 Protocolos", protocols: 2, price: 465.5, featured: true,
      description: "Formato premium recomendado para quem busca constância, acompanhamento sólido e melhor custo-benefício.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos", "Maior compromisso com o processo"],
      cta: "Quero o plano premium"
    },
    {
      name: "3 Protocolos", protocols: 3, price: 611.4,
      description: "Excelente escolha para manter evolução contínua e maior tempo de acompanhamento.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos", "Maior compromisso com o processo"],
      cta: "Escolher 3 Protocolos"
    },
    {
      name: "6 Protocolos", protocols: 6, price: 1200,
      description: "Plano para quem quer estrutura, acompanhamento prolongado e máxima consistência.",
      features: ["Treino individualizado", "Acesso ao app", "Suporte via WhatsApp", "Ajustes periódicos", "Maior compromisso com o processo"],
      cta: "Escolher 6 Protocolos"
    }
  ]
};
