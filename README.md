# Rock Me Mamma · Pizza Bar Experience

Site cardápio do Rock Me Mamma, pizza bar na Al. Júlia da Costa, 1829, no Bigorrilho, em Curitiba. É um site estático (HTML, CSS e JavaScript puros), sem build, pronto para publicar na Netlify.

## Estrutura

```
index.html        Página única: abertura, cardápio completo, como chegar e rodapé
css/style.css     Estilos (cores e fontes no topo, em :root)
js/main.js        Busca, filtros e destaque da categoria durante a rolagem
assets/           Logo (branca e preta), favicon e imagem de compartilhamento
```

O cardápio e os contatos estão escritos direto no `index.html`, então aparecem em qualquer celular ou navegador, mesmo com o JavaScript bloqueado. O JavaScript só acrescenta a busca e os filtros.

## Recursos

- Cardápio inteiro do PDF, separado em **Cozinha** e **Bar**, com títulos em letra cursiva como no cardápio impresso.
- Barra de categorias fixa que acompanha a rolagem.
- Busca por nome ou ingrediente (sem diferenciar acentos), com botão de busca no topo do site e na barra de categorias, contador de resultados e filtros **Vegetariano**, **Vegano** e **Zero lactose**.
- Seção "Visite" com endereço, mapa (com alternativa caso o mapa não carregue), rota no Google Maps, WhatsApp e Instagram.
- Botão flutuante do WhatsApp.

## Como atualizar o cardápio

No `index.html`, cada categoria começa com um comentário (ex.: `<!-- Pizzas Tradicionais -->`) e cada item é um bloco `<li class="item">`:

- **Mudar preço:** troque o número dentro de `<span class="price__val">67</span>`.
- **Mudar nome ou descrição:** edite o texto em `item__name` ou `item__desc`.
- **Remover um item:** apague o bloco do `<li class="item">` até o `</li>` correspondente.
- **Adicionar um item:** copie um bloco parecido e altere o texto.
- **Vegetariano, vegano ou sem lactose:** use `data-tags="veg"`, `"vegan"` ou `"lac"` no `<li>` (é o que os filtros usam) e copie o ícone `<span class="tag ...">` de outro item.

Contatos (WhatsApp, Instagram e endereço) também ficam no `index.html`; procure por `wa.me`, `instagram.com` e `Júlia da Costa`.

## Publicar na Netlify

Arraste a pasta do projeto em https://app.netlify.com/drop, ou conecte este repositório (sem comando de build, diretório de publicação `.`).
