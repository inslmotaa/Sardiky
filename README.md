# Gregory Nascimento | Advocacia

Site institucional estático (HTML, CSS e JS puros), pronto para publicar no Netlify.

## Como editar os dados de contato

Abra `script.js` e altere o objeto `CONFIG` no topo do arquivo:
WhatsApp (somente números, com 55 + DDD), telefone, e-mail, OAB, endereço,
horário e Instagram. O site inteiro é atualizado automaticamente.

## Foto do advogado

Coloque a foto como `foto.jpg` na raiz e, em `index.html` (seção "Sobre"),
troque o bloco `about__placeholder` pela tag `<img class="about__photo" ...>`
indicada no comentário.

## Publicar no Netlify

Publish directory: `/` (raiz) — não há etapa de build.
