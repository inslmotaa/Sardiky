# Fonseca Team · Consultoria Online Premium

Site da consultoria online Fonseca Team (Maicon Fonseca). É um site estático, sem etapa de build, pronto para publicar na Netlify.

## Tecnologia

- **HTML5, CSS3 e JavaScript moderno**, sem frameworks: carrega rápido e funciona em qualquer hospedagem.
- **[GSAP](https://gsap.com) 3.12.5 + ScrollTrigger**: animações de abertura, títulos surgindo palavra por palavra, efeitos ligados à rolagem e efeitos 3D.
- **[Lenis](https://lenis.darkroom.engineering) 1.1.13**: rolagem suave.

As bibliotecas ficam dentro do próprio site, em `js/vendor/`, então ele não depende de servidores externos. Se o visitante ativou "reduzir movimento" no aparelho, ou se as bibliotecas não carregarem, o site continua funcionando com animações simples.

## Estrutura

```
index.html        Página única com todas as seções
css/style.css     Estilos (cores no topo, em :root)
js/config.js      Seus dados: WhatsApp, Instagram, planos e vídeos
js/main.js        Interações: menu, planos, comparativo, vídeos, calculadora, formulário
js/motion.js      Animações avançadas (GSAP, ScrollTrigger e Lenis)
js/vendor/        Bibliotecas GSAP, ScrollTrigger e Lenis
assets/           Logo, favicon, fotos e vídeos
```

## Seções

Tela de abertura · Topo com foto · Objetivos · Método Fonseca Team + como começar · Benefícios · Planos + tabela comparativa · Vídeos · Depoimentos · Sobre o profissional · Calculadora de IMC e calorias · Perguntas frequentes · Formulário de contato (envia para o WhatsApp) · Rodapé · Botão flutuante do WhatsApp.

## Como adicionar vídeos

Os vídeos ficam na lista `videos` em `js/config.js`. A seção "Fonseca Team em ação" e o link "Vídeos" do menu só aparecem quando a lista tem pelo menos um vídeo.

**Opção 1: link do Instagram ou do YouTube (mais fácil).** Copie o link do reel ou do vídeo e cole:

```js
videos: [
  { title: "Treino de pernas completo", tag: "Treino", url: "https://www.instagram.com/reel/CODIGO/" },
  { title: "Resultado do aluno", tag: "Resultado", url: "https://youtube.com/shorts/CODIGO" },
],
```

Para reels do Instagram, vale adicionar `poster: "assets/videos/capa.jpg"` com uma imagem de capa. Sem ela, o card mostra o logo.

**Opção 2: arquivo de vídeo próprio.** Salve o vídeo em `assets/videos/` e use `src`:

```js
{ title: "Treino de costas", tag: "Treino", src: "assets/videos/costas.mp4", poster: "assets/videos/costas.jpg" },
```

Dicas para arquivos:
- Use MP4 (H.264), na vertical (9:16), em 720p ou 1080p.
- Mantenha cada vídeo com até cerca de 10 MB, para o site continuar rápido. Vídeos longos ficam melhor no Instagram ou no YouTube (opção 1).
- O `poster` é opcional. Sem ele, aparece o primeiro quadro do vídeo.
- Para um vídeo na horizontal, adicione `vertical: false`.

**Vídeo de fundo no topo (opcional):** preencha `heroVideo` em `js/config.js`, por exemplo `heroVideo: { src: "assets/videos/fundo.mp4", poster: "assets/coach.jpg" }`. Ele toca sem som e em repetição, atrás do texto do topo.

## O que editar antes de publicar

1. **`js/config.js`**: troque `whatsapp` (só números, com 55 + DDD), `whatsappDisplay` e `instagram`. Os preços e itens dos planos também ficam aqui; o valor por protocolo, a economia e a tabela comparativa são calculados sozinhos.
2. **Foto**: salve a foto do Maicon como `assets/coach.jpg` (de preferência quadrada). Enquanto não existir, aparece o símbolo do logo.
3. **Cores**: no início de `css/style.css`, altere `--red`, `--red-bright` e `--red-dark`.

## Publicar na Netlify

Arraste a pasta do projeto em https://app.netlify.com/drop, ou conecte este repositório (sem comando de build, diretório de publicação `.`).
