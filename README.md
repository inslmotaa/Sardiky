# Gregory Nascimento Zechmann · Advogado Trabalhista

Site one-page em HTML, CSS e JavaScript puros (sem build), pronto para a Netlify.

```
index.html        Página única (textos, SEO e dados estruturados)
css/style.css     Estilos — cores e fontes no topo, em :root
js/config.js      WhatsApp, mensagem padrão e Instagram
js/main.js        Menu, item ativo, links de contato e ano do rodapé
assets/           Foto, favicon, ícones e imagem de compartilhamento
netlify.toml      Publicação e cabeçalhos de segurança
```

## Antes de publicar

1. **Contato — `js/config.js`**: preencha `whatsapp` (só números: 55 + DDD + número) e `instagram` (usuário, sem @). Todos os botões, o rodapé e o botão flutuante usam esses dados.
2. **Dados estruturados — `index.html`**: no bloco `application/ld+json` do `<head>`, troque `[TELEFONE]` (ex.: `+55-41-99999-8888`) e `[INSTAGRAM]`.
3. **Placeholders**: procure por `[FORMAÇÃO ACADÊMICA]`, `[ESPECIALIZAÇÕES]` e `[CIDADE DE ATENDIMENTO]` no `index.html`. Eles aparecem destacados com borda tracejada até serem trocados. Ao preencher, remova o `<span class="placeholder">` em volta do texto.
4. **Foto**: salve a foto profissional como `assets/gregory.webp`, retrato 4:5 (ex.: 720×900 px). Se usar outro tamanho, ajuste `width`/`height` nas duas tags `<img>`. Para converter: `cwebp -q 82 foto.jpg -o assets/gregory.webp` ou squoosh.app.
5. **Imagem de compartilhamento**: `assets/og-image.jpg` (1200×630) aparece no WhatsApp e nas redes. É JPG porque alguns aplicativos não leem WebP nessa prévia.
6. **Logo**: `assets/logo.svg` é uma versão vetorial da logo GNZ. Ela também está embutida no `index.html` (`<symbol id="i-logo">`, no início do `<body>`), que é a cópia usada no cabeçalho, no contato e no rodapé. Se trocar a logo, atualize os dois e o `assets/favicon.svg`.
7. **Textos**: estão no `index.html`; os pontos de edição têm comentários com ✏️.

## Ética (Provimento 205/2021 da OAB)

Mantenha o tom informativo. Não acrescente promessas de resultado, valores ou honorários, "consulta grátis", depoimentos, casos ganhos, comparações com outros advogados nem apelos de urgência.

## Privacidade (LGPD)

A página não tem formulários nem rastreamento. Se for incluir analytics depois, adicione antes um aviso de cookies com consentimento.

## Publicar na Netlify

Conecte o repositório (sem comando de build, diretório `.`) ou arraste a pasta em https://app.netlify.com/drop. Depois, aponte o domínio `gregoryadv.com.br` em *Domain settings*.
