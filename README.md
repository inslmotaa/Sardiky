# Gregory Nascimento Zechmann · Advogado Trabalhista

Site one-page em um único arquivo HTML (CSS e JavaScript embutidos, sem frameworks e sem build), pronto para a Netlify.

```
index.html        Página completa: textos, estilos, scripts, SEO e JSON-LD
assets/           Imagem de compartilhamento (og-image.jpg), logo e ícones
netlify.toml      Publicação e cabeçalhos de segurança
```

## Onde editar

- **Contato**: no fim do `index.html`, no bloco `window.CONFIG` (WhatsApp só com números, Instagram sem @). Todos os botões usam esses dados.
- **Dados estruturados**: no `<head>`, bloco `application/ld+json` (telefone e Instagram). Atualize junto com o `window.CONFIG`.
- **Cores e fontes**: variáveis em `:root`, no início do `<style>`.
- **Textos**: direto no HTML; os pontos principais têm comentários com ✏️.
- **Logo**: `assets/logo.svg` e a cópia embutida em `<symbol id="i-logo">`, no início do `<body>`.

## Animações

Entradas e revelações ao rolar só são aplicadas com JavaScript ativo (classe `js` no `<html>`). Com "reduzir movimento" ativado no sistema, tudo aparece direto, sem animações.

## Ética (Provimento 205/2021 da OAB)

Mantenha o tom informativo: sem promessas de resultado, valores, "consulta grátis", depoimentos, casos ganhos, comparações ou apelos de urgência.

## Privacidade (LGPD)

Sem formulários e sem rastreamento. Se incluir analytics, adicione antes um aviso de cookies com consentimento.

## Publicar na Netlify

Conecte o repositório (sem comando de build, diretório `.`) ou arraste a pasta do projeto em https://app.netlify.com/drop. Envie a pasta `assets/` junto: a prévia de links no WhatsApp e no Instagram usa `assets/og-image.jpg`.
