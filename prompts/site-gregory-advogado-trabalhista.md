# Prompt: site do advogado trabalhista Gregory N. Zechmann

Prompt pronto para colar em uma IA geradora de sites (Claude, Lovable, v0, Bolt etc.).
Base: conteúdo do site https://gregoryadv.com.br/.

```
Você é um designer e desenvolvedor front-end sênior, especializado em sites para escritórios de advocacia de alto padrão. Crie um site institucional one-page extremamente profissional, moderno e sofisticado para um advogado trabalhista. O site deve transmitir autoridade, confiança, seriedade e proximidade, e ter como objetivo principal levar o visitante a iniciar uma conversa pelo WhatsApp. Todo o conteúdo em português do Brasil.

═══════════════════════════════
1. DADOS DO ADVOGADO (use exatamente estes dados)
═══════════════════════════════
- Nome completo: Gregory Nascimento Zechmann
- Nome curto (logo/header): Gregory N. Zechmann
- Cargo: Advogado Trabalhista
- OAB: OAB/PR 93.853
- WhatsApp: (41) 98766-0899
- Link do WhatsApp (usar em TODOS os botões de contato):
  https://wa.me/5541987660899?text=Ol%C3%A1%2C%20Gregory%21%20Encontrei%20seu%20site%20e%20gostaria%20de%20conversar%20sobre%20uma%20quest%C3%A3o%20trabalhista.
  (mensagem: "Olá, Gregory! Encontrei seu site e gostaria de conversar sobre uma questão trabalhista.")
- Instagram: @gregoryz.adv → https://www.instagram.com/gregoryz.adv
- Domínio: https://gregoryadv.com.br
- Público-alvo: trabalhadores (empregados) que tiveram, ou suspeitam ter tido, direitos trabalhistas desrespeitados. Linguagem clara e acessível, sem "juridiquês".

Centralize todos esses dados em um único arquivo de configuração (ex.: js/config.js) para que telefone, links e textos fixos possam ser trocados em um só lugar.

═══════════════════════════════
2. IDENTIDADE VISUAL
═══════════════════════════════
- Estilo: advocacia premium, elegante e minimalista. Nada de clichês como martelo, balança genérica de banco de imagens, colunas gregas ou tons "jurídicos antigos".
- Paleta:
  • Azul-marinho profundo #0B1D33 (base, hero, CTA final, rodapé)
  • Dourado sóbrio/champagne #C9A961 (destaques, ícones, linhas finas, palavras em itálico)
  • Off-white #F7F5F0 (fundos claros das seções)
  • Grafite #2B2B2B (textos)
  Defina as cores como variáveis CSS em :root e garanta contraste AA (o dourado não deve ser usado em texto pequeno sobre fundo claro).
- Tipografia: serifada elegante para títulos (Playfair Display ou Cormorant Garamond) + sans-serif limpa para textos (Inter ou Manrope), via Google Fonts com display=swap.
- Muito espaço em branco, grid bem alinhado, cantos levemente arredondados (8–12px), sombras sutis, filetes dourados finos como separadores.
- Ícones de linha finos e consistentes (Lucide) para cada área de atuação.
- Microinterações suaves: fade-in ao rolar (IntersectionObserver), hover elegante nos cards e botões, transições discretas. Respeite prefers-reduced-motion.
- Mobile-first: a maior parte do tráfego virá do celular e do Instagram.

═══════════════════════════════
3. ESTRUTURA E SEÇÕES (nesta ordem)
═══════════════════════════════

▸ HEADER (fixo ao rolar; ganha fundo com leve blur/opacidade após o topo)
- Logo à esquerda: "Gregory N. Zechmann" com subtítulo "Advogado Trabalhista".
- Menu: Início · Áreas de atuação · Sua situação · Sobre · Contato
- Botão de destaque à direita: "WhatsApp".
- No mobile: menu hambúrguer acessível + botão de WhatsApp sempre visível.

▸ HERO
- Linha superior pequena: "Advogado Trabalhista · OAB/PR 93.853"
- Nome: "Gregory Nascimento Zechmann"
- Título principal (único H1 da página): "Seus direitos trabalhistas foram respeitados?" — com a palavra "respeitados?" em itálico e na cor dourada.
- Subtítulo: "Entenda seus direitos e saiba quais caminhos podem ser tomados no seu caso."
- Botões: [Falar no WhatsApp] (primário, dourado) e [Instagram] (secundário, outline).
- Foto profissional do advogado em proporção retrato (placeholder elegante em assets/gregory.jpg, com fallback para monograma "GZ" se a imagem não existir).
- Fundo: azul-marinho com gradiente discreto ou textura sutil.

▸ ÁREAS DE ATUAÇÃO
- Rótulo pequeno: "Áreas de atuação"
- Título: "Como posso ajudar?"
- Grid de cards (3 colunas no desktop, 2 no tablet, 1 no mobile), cada um com ícone, título e descrição curta e informativa de 1–2 linhas:
  1. Demissão e verbas rescisórias
  2. Horas extras
  3. FGTS
  4. Rescisão indireta
  5. Assédio moral
  6. Acidente de trabalho
  7. Insalubridade e periculosidade
  8. Reconhecimento de vínculo empregatício
  9. Direitos trabalhistas em geral
- Abaixo do grid: "Quer entender se o seu caso se enquadra?" + botão [Falar no WhatsApp].

▸ IDENTIFIQUE SUA SITUAÇÃO
- Rótulo: "Identifique sua situação"
- Título: "Está passando por uma situação no trabalho?"
- Checklist visual (ícone de check dourado em cada item):
  • Foi demitido e não recebeu corretamente?
  • Está trabalhando sem registro?
  • Não recebeu horas extras?
  • Seu FGTS não foi depositado?
  • Sofreu assédio no ambiente de trabalho?
  • Teve problemas após um acidente de trabalho?
- Texto: "Converse com um advogado e entenda quais são as possibilidades para o seu caso."
- Botão: [Falar com Gregory]

▸ COMO FUNCIONA O ATENDIMENTO (3 passos numerados, com linha conectando os passos)
  1. Você entra em contato pelo WhatsApp e explica brevemente o que aconteceu.
  2. Seu caso é analisado de forma individualizada.
  3. Você recebe orientação sobre os caminhos possíveis.

▸ SOBRE O ADVOGADO
- Rótulo: "Sobre o advogado"
- Título: "Gregory Nascimento Zechmann"
- Subtítulo: "Advogado Trabalhista · OAB/PR 93.853"
- Texto: "Atuação voltada à orientação e defesa dos direitos trabalhistas, com atendimento individualizado e análise das particularidades de cada caso."
- Layout em duas colunas: foto profissional + texto (empilhado no mobile).
- Placeholders claramente marcados (ex.: [FORMAÇÃO ACADÊMICA], [ESPECIALIZAÇÕES], [CIDADE DE ATENDIMENTO]) — NÃO inventar essas informações.

▸ PERGUNTAS FREQUENTES (acordeão acessível, com <details>/<summary> ou ARIA)
5–6 perguntas informativas e genéricas, por exemplo:
- Qual o prazo para entrar com uma ação trabalhista?
- O que é rescisão indireta?
- Trabalhei sem carteira assinada. Tenho direitos?
- Como saber se meu FGTS foi depositado?
- Quais documentos devo reunir antes de conversar com um advogado?
- O atendimento pode ser feito online?
Respostas objetivas, educativas, corretas perante a legislação vigente (CLT) e sem prometer resultados.

▸ CONTATO / CTA FINAL
- Título: "Fale diretamente com Gregory"
- Texto: "Explique brevemente o que aconteceu e entre em contato para buscar orientação sobre o seu caso."
- Botões: [WhatsApp] e [Instagram]
- Fundo azul-marinho com detalhes dourados, visual de fechamento forte.

▸ RODAPÉ
- "Gregory Nascimento Zechmann — Advogado Trabalhista · OAB/PR 93.853"
- Ícones de WhatsApp e Instagram.
- Aviso legal: "As informações apresentadas nesta página possuem caráter informativo e não substituem uma consulta jurídica individualizada."
- © [ano atual, gerado via JavaScript] Gregory Nascimento Zechmann. Todos os direitos reservados.

▸ BOTÃO FLUTUANTE
- Botão de WhatsApp flutuante no canto inferior direito, visível em todas as seções, com animação sutil de pulso (desativada com prefers-reduced-motion) e aria-label "Falar no WhatsApp".

═══════════════════════════════
4. REGRAS OBRIGATÓRIAS (Código de Ética e Disciplina da OAB / Provimento 205/2021)
═══════════════════════════════
- Tom informativo, sóbrio e discreto. Nada de linguagem mercantilista ou sensacionalista.
- PROIBIDO: prometer resultados ("ganhe sua causa", "garantimos", "100% de sucesso"), divulgar valores ou honorários, oferecer "consulta grátis" como chamariz, citar valores de indenização, usar depoimentos de clientes, listar casos ganhos ou números de processos, comparar-se com outros advogados, usar expressões de urgência ("últimas vagas", "não perca").
- Não inventar dados (anos de experiência, número de clientes, prêmios, formação, endereço). Onde faltar informação, usar placeholders claramente marcados entre colchetes.

═══════════════════════════════
5. REQUISITOS TÉCNICOS
═══════════════════════════════
- HTML5 semântico, CSS e JavaScript puros (sem framework e sem etapa de build), organizados em index.html, css/style.css, js/config.js, js/main.js e assets/.
- One-page com rolagem suave entre as seções via menu e destaque do item ativo conforme a rolagem.
- Performance alta: imagens em WebP com width/height definidos, loading="lazy" (exceto a foto do hero), fontes com preconnect, JS com defer. Meta: 90+ no PageSpeed mobile.
- SEO:
  • <html lang="pt-BR">
  • Title: "Gregory Nascimento Zechmann | Advogado Trabalhista | OAB/PR 93.853"
  • Meta description: "Advogado trabalhista. Entenda seus direitos e fale com Gregory pelo WhatsApp."
  • Canonical: https://gregoryadv.com.br/
  • Um único H1, hierarquia correta de H2/H3, alt text descritivo em todas as imagens.
  • JSON-LD Schema.org do tipo "Attorney"/"LegalService" com nome, OAB, telefone, URL, Instagram (sameAs) e área de atuação "Direito do Trabalho".
  • Open Graph e Twitter Card (og:title, og:description, og:image 1200×630, og:locale pt_BR) para pré-visualização bonita no WhatsApp e Instagram.
- Acessibilidade: contraste AA, navegação completa por teclado, foco visível, link "Pular para o conteúdo", aria-labels nos botões de ícone.
- Favicon e apple-touch-icon com o monograma "GZ" em dourado sobre azul-marinho.
- Privacidade (LGPD): sem formulários que coletem dados e sem scripts de rastreamento; se for adicionado analytics no futuro, prever aviso de cookies.
- netlify.toml com publish = "." e cabeçalhos de segurança básicos (X-Content-Type-Options, Referrer-Policy).
- Código limpo, comentado nos pontos de edição e pronto para deploy no Netlify.
- Entregue também um README curto explicando onde trocar foto, dados de contato e textos.
```
