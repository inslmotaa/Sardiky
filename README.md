# Rock Me Mamma · Pizza Bar Experience

Site cardápio do Rock Me Mamma, pizza bar na Al. Júlia da Costa, 1829, no Bigorrilho, em Curitiba. É um site estático (HTML, CSS e JavaScript puros), sem build, pronto para publicar na Netlify.

## Estrutura

```
index.html        Página única: abertura, cardápio, como chegar e rodapé
css/style.css     Estilos (cores e fontes no topo, em :root)
js/menu.js        O cardápio completo: categorias, pratos, drinks e preços
js/config.js      WhatsApp, Instagram, endereço e aviso da taxa de serviço
js/main.js        Monta o cardápio, busca, filtros e navegação por categoria
assets/           Logo (branca e preta), favicon e imagem de compartilhamento
```

## Recursos

- Cardápio inteiro do PDF, separado em **Cozinha** e **Bar**, com títulos em letra cursiva como no cardápio impresso.
- Barra de categorias fixa que acompanha a rolagem.
- Busca por nome ou ingrediente (sem diferenciar acentos) e filtros **Vegetariano**, **Vegano** e **Zero lactose**.
- Seção "Visite" com endereço, mapa, rota no Google Maps, WhatsApp e Instagram.
- Botão flutuante do WhatsApp.

## Como atualizar o cardápio

Abra `js/menu.js`. Cada prato é uma linha como esta:

```js
{ name: "Calabresa", desc: "Molho de tomate, mozzarela, ...", price: 67 },
```

- Mudar preço: troque o número em `price`.
- Item vegetariano, vegano ou sem lactose: adicione `tags: ["veg"]`, `["vegan"]` ou `["lac"]`.
- Vários tamanhos: use `prices: [{ label: "350 ml", value: 18 }, { label: "500 ml", value: 22 }]`.
- Remover um item: apague a linha.

Contatos (WhatsApp e Instagram) ficam em `js/config.js`.

## Publicar na Netlify

Arraste a pasta do projeto em https://app.netlify.com/drop, ou conecte este repositório (sem comando de build, diretório de publicação `.`).
