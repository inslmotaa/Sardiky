# Prompt — Site André Farion (hero + storytelling)

Crie a página de um site para o nutricionista **André Farion**: a hero, um storytelling animado logo abaixo, as seções Sobre, Consultoria, Resultados e Contato, e o rodapé. Tudo no mesmo estilo visual da hero.

---

## FORMATO
- Um único arquivo HTML com CSS e JavaScript embutidos, sem frameworks.
- Fontes do Google Fonts:
  - uma sans-serif bem larga e pesada para o nome (ex.: Archivo com largura 125% e peso 800);
  - uma monoespaçada para rótulos pequenos (ex.: Geist Mono).
- Responsivo: funcionar bem de 400px (celular) até 1440px+, sem rolagem horizontal.

## PALETA (branco e verde)
- Fundo base: branco levemente quente (#F7F8F5)
- Verde principal: verde-folha profundo (#1F5E3B)
- Verde claro de apoio: #8DBF8B
- Texto secundário: cinza esverdeado (#6B7A70)
- Linhas finas: verde com 15% de opacidade

---

## 1. HERO

### Fundo: shader WebGL "liquid" claro
- Um `<canvas>` ocupando todo o fundo da hero, atrás de tudo.
- Fragment shader com fbm (ruído fractal) e domain warping. Ele gera uma superfície líquida que se move devagar e de forma orgânica, como leite ou seda escorrendo.
- Calcule as normais da superfície e aplique luz especular suave, para parecer líquido de verdade e não só um gradiente.
- Cores: base quase branca, sombras em verde-claro muito suave, reflexos brancos brilhantes e um toque sutil de verde nos vales. Tudo bem claro e limpo, nada escuro.
- O líquido reage ao mouse: deforma levemente onde o cursor passa, com movimento suavizado (easing).
- Escureça um pouco o terço de baixo e as bordas (vinheta leve) para o texto ficar legível.
- Por cima, uma textura de grão bem sutil (SVG feTurbulence, opacidade ~6%).
- Performance:
  - renderize a ~55% da resolução;
  - pause quando a aba não estiver visível ou a hero sair da tela;
  - use um frame estático se o usuário tiver "prefers-reduced-motion" ativo;
  - se não houver WebGL, use um gradiente claro de fallback.

### Nome (wordmark) no estilo do logo
- "ANDRÉ FARION" gigante, em caixa alta, ancorado embaixo à esquerda da hero.
- Mistura de preenchido e contorno: "ANDRÉ" preenchido em verde principal e "FARION" só com contorno verde fino (-webkit-text-stroke). Outra opção é alternar letras como no logo TMLSS (algumas sólidas, algumas vazadas).
- Logo depois do nome, um traço horizontal curto em verde claro, como um cursor, piscando devagar.
- O nome se ajusta por JavaScript para ocupar exatamente a largura disponível: o script mede o texto e recalcula o font-size no resize e quando as fontes carregarem.
- No hover, as letras vazadas ganham um preenchimento verde bem transparente.
- Acima do nome, um rótulo pequeno em mono: um ponto verde + "NUTRICIONISTA · CRN [número]".

### Topo (nav)
- À esquerda: "AF" ou "ANDRÉ FARION" pequeno, com o traço verde.
- À direita, em mono caixa alta: / Sobre  / Consultoria  / Resultados  / Contato. Os links rolam suavemente até as seções da página.
- No celular, os links viram um botão "Menu".

### Linha inferior (abaixo do nome, separada por uma linha fina)
- Uma frase curta: "Nutrição baseada em evidência, pensada para a sua rotina. Planos alimentares que você consegue seguir de verdade."
- Serviços em mono: Emagrecimento / Performance esportiva / Reeducação alimentar
- Botão em pílula com borda verde: "Agendar consulta →".
  - No hover, preenche de verde e o texto fica branco.
  - O link aponta para o formulário de anamnese. Deixe um placeholder `href="#anamnese"` fácil de trocar.
- No celular, essa linha empilha em uma coluna.

### Detalhes da hero
- Altura mínima de 100svh.
- Foco visível no teclado (outline verde).
- Visual minimalista, premium e limpo, transmitindo saúde, leveza e confiança. Nada de ícones genéricos de frutas ou emojis.

---

## 2. STORYTELLING (logo abaixo da hero)

Uma história contada em capítulos enquanto a pessoa rola a página. A linguagem visual é a mesma da hero: fundo #F7F8F5, verde principal, rótulos em mono, títulos na sans larga e pesada, linhas finas, sem ícones de frutas nem emojis.

### Abertura
- Rótulo mono: "● UMA HISTÓRIA SOBRE COMER BEM".
- Título grande: "Comer bem não precisa ser ___." A última palavra troca com uma animação suave de subir e sumir, em sequência: complicado → restritivo → sem graça → uma dieta da moda. A palavra que troca fica em contorno verde (text-stroke), como "FARION".
- Texto: "Esta é a história de muita gente que chega até aqui. Talvez seja a sua também."

### Quatro capítulos
- **Layout no computador:** duas colunas.
  - À esquerda, um painel fixo (position: sticky) com um número gigante vazado ("01", "02"…) e uma ilustração em linha fina verde.
  - A ilustração se desenha conforme a rolagem: anime `stroke-dasharray`/`stroke-dashoffset` ligado ao progresso do scroll.
  - À direita, os textos dos capítulos passam.
- **Layout no celular:** uma coluna, com a ilustração acima de cada texto.
- Uma linha vertical fina na lateral enche de verde conforme o progresso da história. Ao lado dela, 4 marcadores mono que se acendem no capítulo ativo.
- Cada capítulo entra com fade + leve subida, linha por linha (IntersectionObserver).

Os capítulos:

1. **CAPÍTULO 01 — A ROTINA**
   - Título: "Segunda-feira, 7h. O dia já começou correndo."
   - Texto: "Café às pressas, almoço no intervalo possível, lanche esquecido. Sem perceber, a alimentação vai ficando para depois — e a energia também."
   - Ilustração: um relógio em linha fina, com os ponteiros girando rápido.
2. **CAPÍTULO 02 — AS TENTATIVAS**
   - Título: "Você já tentou de tudo."
   - Texto: "Dieta da moda, cortar grupos inteiros de alimentos, contar cada caloria. Funciona por alguns dias, mas não cabe na vida real."
   - Ilustração: três linhas em mono ("DIETA DA MODA", "CORTAR CARBOIDRATO", "CONTAR CALORIAS") que vão sendo riscadas uma a uma.
3. **CAPÍTULO 03 — A VIRADA**
   - Título: "Até que o plano passa a ser seu."
   - Texto: "Uma avaliação cuidadosa da sua rotina, das suas preferências e do seu objetivo dá origem a um plano individualizado, com substituições para ter flexibilidade."
   - Ilustração: um prato visto de cima, em linha fina, dividido em setores que se preenchem com verde claro, com rótulos mono (PROTEÍNA, CARBOIDRATO, VEGETAIS).
4. **CAPÍTULO 04 — O CAMINHO**
   - Título: "Acompanhamento que enxerga cada passo."
   - Texto: "Plano no celular, diário, mensagens e gráficos de evolução. A cada 15 dias a estratégia é revista, no seu ritmo."
   - Ilustração: um gráfico de linha subindo, desenhado da esquerda para a direita, com pontos que aparecem em sequência.

### Fecho
- Rótulo mono: "PRÓXIMO CAPÍTULO".
- Título: "A sua história começa na primeira consulta."
- Botões:
  - "Escrever o próximo capítulo →": a mesma pílula da hero, apontando para `#anamnese`;
  - "Conhecer o André": link de texto com sublinhado animado, levando para `#sobre`.
- Ao fundo do fecho, reaproveite o shader líquido (mesmo canvas ou um segundo, com as mesmas regras de performance) para "fechar" a história com o mesmo clima da hero.

---

## 3. SEÇÕES SEGUINTES

As seções seguem o mesmo estilo.
- Cada uma abre com um rótulo mono numerado, por exemplo "/ 01 — SOBRE".
- Os títulos usam a sans larga.
- As seções são separadas por linhas finas.
- A entrada é suave ao rolar.

### / Sobre (`#sobre`)
- Espaço para uma foto em retrato. Enquanto não houver foto, use um bloco com o fundo líquido e as iniciais vazadas.
- Texto de apresentação (placeholder fácil de trocar).
- Método: "Tudo começa por uma anamnese completa e uma avaliação física. A partir delas, definimos metas realistas e uma estratégia individual, revista a cada 15 dias conforme a sua evolução."
- Lista em mono com os objetivos: Ganho de massa muscular / Emagrecimento saudável / Mais energia e disposição / Melhor qualidade de vida.

### / Consultoria (`#consultoria`)
- Como funciona, em 4 passos numerados em linha (empilham no celular):
  1. Escolha seu plano
  2. Responda a anamnese
  3. Avaliação e metas
  4. Plano no app, ajustado a cada 15 dias
- Planos em 4 cartões com bordas finas:
  - Mensal: R$ 250
  - Trimestral: R$ 637,50 (R$ 212,50/mês)
  - Semestral: R$ 1.200 (R$ 200/mês)
  - Anual: R$ 2.250 (R$ 187,50/mês), com o selo mono "MAIS ESCOLHIDO"
- Os cartões Semestral e Anual listam os bônus: vale avaliação física e até 15% de desconto em produtos parceiros.
- Incluso em todos: avaliação física (presencial ou online), anamnese completa e dieta personalizada atualizada a cada 15 dias.
- Cada cartão tem a pílula "Escolher plano →" apontando para `#anamnese`.

### / Resultados (`#resultados`)
- Números grandes que contam ao aparecer na tela (placeholders).
- 3 depoimentos curtos, com nome e objetivo em mono. Use placeholders e marque-os como exemplo.
- Aviso discreto: "Resultados variam de pessoa para pessoa."

### / Contato (`#contato`)
- WhatsApp (41) 99155-1789, com link `https://wa.me/5541991551789`.
- Instagram, horário de atendimento e modalidade (presencial e on-line).
- A pílula "Agendar consulta →" outra vez.

---

## 4. RODAPÉ
- Linha fina no topo.
- O wordmark "ANDRÉ FARION" de novo, menor, com a mesma mistura de preenchido e vazado.
- Links em mono: / Sobre / Consultoria / Resultados / Contato / Política de privacidade.
- "© [ano] André Farion. As informações deste site são educativas e não substituem o acompanhamento individual."
- **Bem embaixo, como última linha da página:** o crédito de quem fez o site, em mono pequeno, cinza esverdeado:
  - Texto: "SITE POR TIMELESS ●". "TIMELESS" fica no estilo do logo TMLSS: letras alternando sólidas e vazadas, em verde principal.
  - Link com `href="#"` como placeholder, fácil de trocar pelo site da TIMELESS.

---

## DETALHES GERAIS
- Rolagem suave nos links internos.
- Tudo com foco visível no teclado (outline verde) e contraste legível.
- Com "prefers-reduced-motion":
  - sem animações de entrada;
  - o shader fica em frame estático;
  - as ilustrações do storytelling já aparecem desenhadas.
- Sem rolagem horizontal em nenhuma largura.
- Visual minimalista, premium e limpo, transmitindo saúde, leveza e confiança. Nada de ícones genéricos de frutas ou emojis.
