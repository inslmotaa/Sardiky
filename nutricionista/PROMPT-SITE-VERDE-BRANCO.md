# Prompt — Site André Farion · Coach (branco e verde)

> Versão final, já com os conflitos entre os prompts anteriores resolvidos. Descreve o site que está no ar nesta versão.

Crie um site completo, em português do Brasil, para **André Farion, Coach**. São três partes: o **site público**, a **área do cliente** e o **painel do coach**. O visual deve ser minimalista, premium e limpo, transmitindo saúde, leveza e confiança, e o sistema deve seguir a LGPD. Nada de ícones genéricos de frutas nem emojis.

## Paleta (branco e verde)

| Uso | Cor |
|---|---|
| Fundo base (branco levemente quente) | `#F7F8F5` |
| Verde principal (verde-folha profundo): nome, títulos, botões | `#1F5E3B` |
| Verde claro de apoio: traço/cursor, ponto dos rótulos, preenchimentos | `#8DBF8B` |
| Texto secundário (cinza esverdeado, um tom mais escuro para passar no contraste) | `#5F6E64` |
| Texto principal | `#18271E` |
| Linhas finas | `rgb(31 94 59 / 0.15)` |
| Hover do botão verde | `#174A2E` |

## Tipografia

- **Nome e títulos:** Archivo, largura 125%, peso 800, com letter-spacing levemente negativo.
- **Rótulos pequenos, menus e botões:** Geist Mono, em caixa alta, com espaçamento largo.
- **Texto corrido:** Inter.
- As fontes ficam empacotadas no próprio site, sem chamar o Google, o que é melhor para a LGPD.

## Identidade

- O rótulo acima do nome mostra o título e o registro que estiverem nas Configurações. O padrão é "● COACH".
  - Se ele for nutricionista com CRN, basta preencher os dois campos e o rótulo vira "● NUTRICIONISTA · CRN …".
- Sem monograma de iniciais. A foto só aparece quando for enviada.
- Lema: "Mais que dieta, um estilo de vida."
- WhatsApp: (41) 99155-1789.
- O nome no cabeçalho sempre leva ao início.

## Site público

### 1. Hero (100svh): profissional, no estilo de software de nutrição (inspirado no DietSystem)

- **Sem o nome gigante.** O nome aparece só no menu ("ANDRÉ FARION —"); o rodapé também não repete o nome.
- **Duas colunas no computador:** texto à esquerda, vitrine da plataforma à direita. Em telas menores, a vitrine vai para baixo do texto.
- **Texto:**
  - rótulo mono "● COACH · ALIMENTAÇÃO, ROTINA E BEM-ESTAR" (o título vem das Configurações);
  - título: "Nutrição estratégica, **acompanhada de perto.**", com o final só no contorno verde;
  - texto de apoio: "Avaliação completa, plano individual e ajustes a cada 15 dias em uma plataforma própria: o André acompanha tudo pelo painel, e você segue o plano, registra as refeições e vê a sua evolução pelo app.";
  - botões: "Agendar consulta →" (pílula verde cheia) e "Conhecer a plataforma" (link sublinhado para /como-funciona);
  - destaques com ícone de check: Anamnese on-line, Plano no app, Ajustes a cada 15 dias, Dados protegidos (LGPD);
  - serviços em mono: Emagrecimento / Performance esportiva / Reeducação alimentar.
- **Vitrine da plataforma** (dados de exemplo, desenhada em HTML e CSS):
  - **Painel do coach**, numa janela de navegador:
    - menu lateral (Início, Clientes, Planos, Agenda, Mensagens, Financeiro);
    - indicadores que contam ao abrir: Clientes ativos 48, Adesão média 86%, Consultas hoje 6;
    - gráfico "Evolução · peso" que se desenha;
    - cartão "Plano alimentar" com as refeições, os horários, as kcal e a barra de macronutrientes.
  - **App do cliente**, num celular na frente da janela, flutuando devagar:
    - "Olá! Bom almoço" e a refeição de agora, com os itens sendo marcados um a um e o botão "Marcar como feita";
    - copos de água, anel de meta e as abas Hoje, Plano, Diário e Evolução.
  - No celular, o aparelho fica menor e à direita, e o painel mostra só o essencial.
- **Faixa de temas** logo abaixo do menu, passando devagar em mono: Proteínas ● Fibras ● Hidratação ● Vegetais ● Frutas da estação ● Grãos integrais ● Gorduras boas ● Rotina e sono.
- **Fundo de natureza, alimentos e bem-estar** (sem fundo líquido e sem batimentos), mais discreto na hero. É o mesmo do fecho da história, do bloco do Sobre (enquanto não houver foto) e do topo das páginas internas:
  - base clara com brilhos verde-claro;
  - um sol que "respira" num ciclo de 8 s (inspira e expira), com anéis finos;
  - alimentos em linha fina verde que sobem devagar, balançando e girando de leve: maçã, folha, cenoura, espiga, abacate, rodela de cítrico, coração e broto;
  - sementes que sobem pelo fundo;
  - grama na base, balançando com o vento e se afastando do mouse;
  - grão bem sutil por cima (SVG feTurbulence, cerca de 6%);
  - o fundo pausa fora da tela e fica parado com "reduzir movimento".
- **Nav:** "ANDRÉ FARION —" à esquerda e, à direita, em mono: / Sobre / Consultoria / Resultados / Contato / Entrar. No celular, vira um botão "Menu".

### 2. Storytelling

- **Abertura:** o título "Comer bem não precisa ser ___." com a palavra em contorno trocando: complicado → restritivo → sem graça → uma dieta da moda.
- **Quatro capítulos.** No computador, ficam em duas colunas:
  - à esquerda, painel fixo (sticky) com uma ilustração em linha fina que se desenha conforme a rolagem;
  - à direita, o texto do capítulo;
  - na lateral, uma linha de progresso com o nome de cada capítulo;
  - sem numeração (nada de 01, 02, 03…) em capítulos, seções, passos ou planos.

| Capítulo | Título | Ilustração |
|---|---|---|
| A rotina | "Segunda-feira, 7h. O dia já começou correndo." | relógio com os ponteiros girando |
| As tentativas | "Você já tentou de tudo." | três tentativas sendo riscadas |
| A virada | "Até que o plano passa a ser seu." | prato com setores Vegetais, Proteína e Carboidrato |
| O caminho | "Acompanhamento que enxerga cada passo." | gráfico subindo, com o rótulo "a cada 15 dias" |

- **Fecho,** com o fundo de natureza: "A sua história começa na primeira consulta." e os botões "Escrever o próximo capítulo →" e "Conhecer o André".

### 3. Seções numeradas

Cada seção abre com um rótulo mono sem número ("/ SOBRE") e é separada da anterior por uma linha fina.

- **/ Sobre:**
  - foto ou, enquanto não houver foto, um bloco com o fundo de natureza;
  - "Mais que dieta, um estilo de vida.", seguido de biografia, método e objetivos em mono.
- **/ Consultoria:**
  - 4 passos marcados com um traço verde, sem número: Escolha seu plano, Responda a anamnese, Avaliação e metas, Plano no app;
  - 4 planos em cartões de borda fina:
    - Mensal R$ 250;
    - Trimestral R$ 637,50 (R$ 212,50/mês);
    - Semestral R$ 1.200 (R$ 200/mês);
    - Anual R$ 2.250 (R$ 187,50/mês), com o selo "MAIS ESCOLHIDO";
  - bônus no Semestral e no Anual;
  - a lista do que está incluso em todos.
- **/ Resultados:**
  - números que contam ao aparecer: 15 dias entre revisões, até 12 meses, 100% individual, e também clientes e anos de experiência, quando configurados;
  - depoimentos, só os autorizados;
  - o aviso "Resultados variam de pessoa para pessoa."
- **/ Contato:** WhatsApp, Instagram, horário e modalidade, com a pílula de agendar.

### 4. Rodapé

- Colunas: lema e redes, Seções, Páginas, Área do cliente e Contato.
- O aviso de que as informações são educativas.
- Na última linha: **"SITE POR TIMELESS ●"**, com as letras de TIMELESS alternando entre sólidas e vazadas. O link fica em `TIMELESS_URL`, em `src/lib/constants.ts`.

### 5. Páginas internas e telas de acesso

- Sobre, Como funciona, Planos (com tabela de comparação) e Dúvidas usam o mesmo topo com o fundo de natureza e o mesmo estilo.
- Privacidade e Agendar seguem as fontes e as cores do site.
- Entrar e Criar conta seguem o mesmo visual.

## Área do cliente e painel do coach

Continuam como no sistema atual:
- **Área do cliente:** hub, anamnese em etapas, plano, prescrição escrita, diário, evolução, mensagens, receitas, lista de compras, consultas e "Meus dados" (baixar e excluir).
- **Painel do coach:** clientes, anamnese com versões e PDF, planos, agenda, financeiro, relatórios, privacidade e configurações.

## Técnica

- Next.js 16 com React 19, TypeScript, PostgreSQL e Drizzle, e autenticação própria.
- Os efeitos do site ficam em JavaScript puro, em `src/lib/site-fx.ts`, e são usados no site e na prévia em arquivo único.
- Testes com Vitest e Playwright, que conferem também o layout no celular sem rolagem horizontal.

## Observação legal

Como coach, o André não prescreve dieta individualizada nem suplementos ou manipulados: isso cabe a nutricionista ou médico. A frase da hero sobre "nutrição baseada em evidência" e "planos alimentares" foi mantida como pediu o prompt. Vale revisar com o André.
