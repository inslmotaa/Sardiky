# MF Team · Consultoria Online Premium

Site da consultoria online MF Team (Maicon Fonseca). É um site estático (HTML, CSS e JavaScript puros), sem build, pronto para publicar na Netlify.

## Estrutura

```
index.html        Página única com todas as seções
css/style.css     Estilos (cores no topo, em :root)
js/config.js      Seus dados: WhatsApp, Instagram, e-mail e planos
js/main.js        Interações: menu, planos, comparativo, calculadora, formulário
assets/           Favicon e fotos
```

## Seções

Hero com foto · Objetivos · Método MFTeam + como começar · Benefícios · Planos + tabela comparativa · Depoimentos · Sobre o profissional · Calculadora de IMC e calorias · Perguntas frequentes · Formulário de contato (envia para o WhatsApp) · Rodapé · Botão flutuante do WhatsApp.

## O que editar antes de publicar

1. **`js/config.js`**: troque `whatsapp` (só números, com 55 + DDD), `whatsappDisplay` e `instagram`. Os preços e itens dos planos também ficam aqui; o valor por protocolo, a economia e a tabela comparativa são calculados sozinhos.
2. **Foto**: salve a foto do Maicon como `assets/coach.jpg` (de preferência vertical, 4:5). Enquanto não existir, aparece um bloco com "MF".
3. **Cores**: no início de `css/style.css`, altere `--accent`, `--accent-2` e `--grad`.

## Publicar na Netlify

Arraste a pasta do projeto em https://app.netlify.com/drop, ou conecte este repositório (sem comando de build, diretório de publicação `.`).
