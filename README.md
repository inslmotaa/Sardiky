# Logtech Seguros — Site institucional

Site one-page da **Logtech Seguros** (corretora especialista em seguros para transportadoras), criado a partir do perfil [@logtechseguros](https://www.instagram.com/logtechseguros/).

É um site estático, sem build: basta abrir `index.html` ou publicar a pasta em qualquer hospedagem (GitHub Pages, Netlify, Vercel, Hostinger…).

## Estrutura

```
index.html              página completa
assets/css/style.css    identidade visual e layout responsivo
assets/js/main.js       menu, animações e formulário → WhatsApp
assets/img/logo.png           logo original (texto escuro, para fundos claros)
assets/img/logo-white.png     logo original (texto branco, para fundos escuros)
assets/img/logo-mark.png      símbolo (estrada em "L")
assets/img/logo-wordmark*.png  "LOGTECH SEGUROS" (escuro e branco)
assets/img/favicon.png, apple-touch-icon.png
assets/img/og-image.png imagem de compartilhamento (WhatsApp, LinkedIn…)
assets/img/instagram/   miniaturas dos posts do Instagram
assets/img/cliente-avatar.jpg  foto do cliente do depoimento
assets/video/           depoimento em vídeo (MP4 + WebM) e capa
```

## Seções

Início (com chamada para o depoimento) · Sobre · Seguros (Carga, Frota & Pesados, RC, Veículos Leves, Empresarial, Vida) · Diferenciais · Como funciona · Depoimento em vídeo · Seguradoras e parceiros · Instagram · Dúvidas frequentes · Contato com formulário de cotação.

## Identidade

| Cor | Hex | Uso |
| --- | --- | --- |
| Azul estrada | `#3B89E6` | cor principal (tirada do logo) |
| Azul claro | `#95CAFD` | detalhes e destaques |
| Marinho | `#071328` | fundos escuros |

Fontes: Montserrat (títulos, com espaçamento largo como no logo) e Inter (textos).

## Antes de publicar — confira

- **Telefones e endereço** (seção Contato e rodapé): `(41) 99166-6745`, `(41) 98499-2244` e `Rua Eng. Júlio César de Souza Araújo, 181 — Curitiba/PR` vieram de buscas na internet e precisam ser confirmados.
- **Número de registro SUSEP** da corretora: incluir no rodapé.
- **WhatsApp direto no formulário**: em `assets/js/main.js`, preencha `whatsappNumber` (ex.: `"5541991666745"`) para o formulário abrir a conversa já com a mensagem digitada. Vazio, ele usa o link da bio (`wa.me/message/QX25ZWUYGF2OM1`) e copia a mensagem para o usuário colar.
- **Depoimento**: o cliente aparece como "Matheus, transportador de Goiânia (GO)", conforme o vídeo. Confirme o nome e a autorização de uso da imagem.
- **Parceiros**: a faixa lista Bradesco Seguros (citada no vídeo), Yelum Seguros e Grupo SVD (posts do Instagram). Ajuste se necessário.
- **Fotos**: as miniaturas do Instagram foram recortadas de um print e têm baixa resolução. Para mais nitidez, substitua os arquivos em `assets/img/instagram/` pelas imagens originais (mesmo nome).
