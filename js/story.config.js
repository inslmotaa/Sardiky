/*
 * ==========================================================
 *  HISTÓRIA DO MAICON — capítulos, frases e bastidores.
 *  Adicione, remova ou reordene itens à vontade: o layout
 *  é montado a partir desta lista.
 *
 *  media: caminho de FOTO (.jpg .png .webp .svg) ou VÍDEO
 *         (.mp4 .webm, ou link do YouTube/Vimeo). O site
 *         detecta o tipo sozinho.
 *  poster: capa do vídeo (obrigatória para vídeos MP4).
 *
 *  Os textos abaixo são modelos: troque pela história real.
 * ==========================================================
 */
window.STORY = {
  eyebrow: "A história",
  title: "Antes de treinar alguém, eu tive que me treinar.",

  chapters: [
    {
      marker: "20XX · O começo",
      title: "O começo",
      text: "Escreva aqui como o treino entrou na sua vida: a primeira academia, o primeiro objetivo, o que te fez continuar quando ninguém estava olhando.",
      media: "media/story/capitulo-1.svg",
      alt: "Maicon no início dos treinos"
    },
    {
      marker: "20XX · A virada",
      title: "A virada",
      text: "O momento em que o treino deixou de ser hobby. Um resultado, uma lesão, uma pessoa que você ajudou. O que mudou a partir dali.",
      media: "media/story/capitulo-2.svg",
      alt: "Maicon treinando"
    },
    {
      type: "quote",
      text: "Resultado não é sorte. É método, constância e alguém que te cobra de perto."
    },
    {
      marker: "20XX · A formação",
      title: "A formação",
      text: "Graduação, cursos, certificações. Conte o que você estudou e como isso mudou a forma de montar um treino.",
      media: "media/story/capitulo-3.svg",
      alt: "Maicon em formação"
    },
    {
      marker: "Hoje · Fonseca Team",
      title: "A Fonseca Team hoje",
      text: "Consultoria online com treino individualizado e acompanhamento de perto. Cada aluno com um plano, um objetivo e alguém olhando a evolução.",
      media: "media/story/capitulo-4.jpg",
      alt: "Maicon Fonseca de braços cruzados com a camiseta da Fonseca Team"
    }
  ],

  // Fechamento: números grandes em vermelho. Troque "000" pelos números reais.
  stats: [
    { value: "000", prefix: "+", label: "alunos atendidos" },
    { value: "00", prefix: "", label: "anos de experiência" },
    { value: "00", prefix: "", label: "cidades e países" }
  ],

  // Galeria "Bastidores": fotos e vídeos misturados (masonry + lightbox).
  gallery: [
    { media: "media/bastidores/bastidores-01.svg", alt: "Bastidores do treino" },
    { media: "media/bastidores/bastidores-02.svg", alt: "Bastidores do treino" },
    { media: "media/bastidores/bastidores-03.svg", alt: "Bastidores do treino" },
    { media: "media/bastidores/bastidores-04.svg", alt: "Bastidores do treino" },
    { media: "media/bastidores/bastidores-05.svg", alt: "Bastidores do treino" },
    { media: "media/bastidores/bastidores-06.svg", alt: "Bastidores do treino" },
    { media: "media/bastidores/bastidores-07.svg", alt: "Bastidores do treino" },
    { media: "media/bastidores/bastidores-08.svg", alt: "Bastidores do treino" }
  ]
};
