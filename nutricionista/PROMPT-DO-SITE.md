# Prompt do site — André Farion · Coach

> Estado do site na versão entregue em 23/10/2026 (commit 786fb9a). Cole este texto numa IA ou entregue a um desenvolvedor para recriar o mesmo site.

---

Crie um site completo, em português do Brasil, para **André Farion, Coach**, com três partes: o **site público**, a **área do cliente** e o **painel do coach**. O sistema precisa ser profissional, autêntico e animado, sem ficar carregado, e seguir a LGPD.

## 1. Identidade

- Nome: **André Farion**. Título: **Coach**. Não use "nutricionista", "CRN" nem monograma de iniciais (como "AF"). A foto do André só aparece quando ele enviar uma.
- Lema: "Mais que dieta, um estilo de vida."
- WhatsApp: **(41) 99155-1789** (link `https://wa.me/5541991551789`).
- O logo/nome no cabeçalho de todas as páginas leva para a página inicial (`/`).
- Paleta verde:
  - verde-escuro `#1f5a3a`
  - verde-principal `#2f8f57`
  - verde-claro `#6cc48a`
  - verde-menta `#e6f4ea`
  - off-white `#f7faf5`
- Tipografia: Fraunces nos títulos e Inter no texto.
- Animações com framer-motion: entrada suave ao rolar, títulos que surgem palavra por palavra, números que contam e botões com brilho. Tudo deve respeitar "reduzir movimento" do sistema; com essa preferência, as animações ficam paradas.
- **Frutas em SVG desenhadas no próprio código**: maçã, laranja, morango, abacate, banana, uva, limão e folha.
  - Flutuam devagar pelo site e se mexem levemente com o mouse (parallax).
  - No celular, esconda as frutas que ficariam por cima do texto.

## 2. Cabeçalho e rodapé

- **Cabeçalho fixo**, que fica sólido ao rolar a página.
  - No computador: logo, links Sobre / Como funciona / Planos / Dúvidas, "Entrar" (ou o menu do usuário logado) e o botão **"Agendar consulta"**.
  - No celular: um menu hambúrguer (☰) com os mesmos links, "Entrar na área do cliente" e "Agendar consulta". O menu fecha ao tocar em um link ou ao trocar de página.
- **Rodapé em colunas:**
  - marca, com texto curto e ícones de WhatsApp e Instagram;
  - Páginas: Início, Sobre, Como funciona, Planos, Dúvidas;
  - Área do cliente: Entrar, Criar conta, Política de privacidade;
  - Contato: WhatsApp, horário e modalidade;
  - linha final: "© ano André Farion. As informações deste site são educativas e não substituem o acompanhamento individual."
- **Botão flutuante do WhatsApp**, em todas as páginas.
- Faixa opcional de "Versão de demonstração", que pode ser ligada e desligada nas configurações.

## 3. Página inicial (`/`) — storytelling

### 3.1 Abertura

- Tela cheia, fundo verde, com frutas flutuando.
- Pequeno título: "Uma história sobre comer bem".
- Título principal: **"Comer bem não precisa ser ___."** A última palavra troca com animação de giro, em sequência: complicado → restritivo → sem graça → uma dieta da moda.
- Texto: "Esta é a história de muita gente que chega até aqui. Talvez seja a sua também."
- Ao rolar, o título desce e esmaece (parallax).

### 3.2 Quatro capítulos

- Cada capítulo aparece ao rolar. Junto dele há uma pequena cena ilustrada e duas frutas que "pulam" quando o capítulo fica ativo.

| Capítulo | Título | Texto | Cena e frutas |
|---|---|---|---|
| 1 · A rotina | "Segunda-feira, 7h. O dia já começou correndo." | "Café às pressas, almoço no intervalo possível, lanche esquecido. Sem perceber, a alimentação vai ficando para depois — e a energia também." | relógio; banana e laranja |
| 2 · As tentativas | "Você já tentou de tudo." | "Dieta da moda, cortar grupos inteiros de alimentos, contar cada caloria. Funciona por alguns dias, mas não cabe na vida real." | tentativas riscadas; limão e uva |
| 3 · A virada | "Até que o plano passa a ser seu." | "Uma avaliação cuidadosa da sua rotina, das suas preferências e do seu objetivo dá origem a um plano individualizado, com substituições para ter flexibilidade — e com as frutas de que você gosta." | prato equilibrado com "Vegetais e frutas"; morango e abacate |
| 4 · O caminho | "Acompanhamento que enxerga cada passo." | "Plano no celular, diário, mensagens e gráficos de evolução. A cada 15 dias a estratégia é revista, no seu ritmo." | gráfico de progresso; maçã e folha |

- Fecho da história: "Próximo capítulo — **A sua história começa na primeira consulta.**", com os botões **"Escrever o próximo capítulo"** (agendar) e **"Conhecer o André"**.

### 3.3 Apresentação

- Na seção `#apresentacao`, a apresentação vem em seguida, com fundo verde e frutas.
- Conteúdo:
  - acima do título, a palavra "Coach";
  - título "André Farion";
  - texto de apresentação;
  - botões **"Agendar consulta"** e **"Ver planos"**;
  - chips com os objetivos: Ganho de massa muscular, Emagrecimento saudável, Mais energia e disposição, Melhor qualidade de vida;
  - números de destaque animados.

### 3.4 Seções seguintes

1. **O método**, com o título "Um acompanhamento feito para durar":
   - 4 pilares em cartões: dieta personalizada atualizada a cada 15 dias, avaliação física presencial ou on-line, aplicativo com plano, diário, lembretes e mensagens, e ajustes conforme o progresso;
   - link para /sobre.
2. **Tudo no seu celular**, com o título "Seu plano sempre à mão, não preso na geladeira":
   - fundo menta;
   - lista do que o app oferece;
   - ilustração de um celular mostrando "Lanche da tarde" (banana, morangos, iogurte), o botão "Marcar como feita" e 8 copos de água (5 cheios).
3. **Como funciona**, com o título "Do primeiro contato ao acompanhamento". São 4 passos em fluxo, com link para /como-funciona:
   1. Escolha seu plano: mensal, trimestral, semestral ou anual.
   2. Crie sua conta e responda a anamnese no próprio site.
   3. Avaliação: conversa, avaliação física e definição de metas.
   4. Plano no app, com ajustes a cada 15 dias.
4. **Planos**: chamada curta, "De 1 a 12 meses, a partir de R$ 187,50/mês", com link para /planos.
5. **Depoimentos**, com o título "Quem já está no caminho". Mostre só os depoimentos que o cliente autorizou.
6. **Perguntas frequentes**: 3 perguntas, com link para /duvidas.
7. **Agendar consulta**: chamada final com botão.

## 4. Demais páginas do site

### Sobre (`/sobre`)

- Topo verde com o nome, o título "Coach" e a biografia.
- Seção "Como eu trabalho":
  - método: "Tudo começa por uma anamnese completa e uma avaliação física. A partir delas, definimos metas realistas e uma estratégia individual, revista a cada 15 dias conforme a sua evolução.";
  - diferenciais.
- Seção "Para quem é", com os 4 objetivos em chips.
- Chamada final "Vamos começar?".

### Como funciona (`/como-funciona`)

- Linha do tempo com 6 etapas, do primeiro contato ao acompanhamento contínuo.
- Seção "Incluso em todos os planos — O que você recebe", com a ilustração do celular:
  - Avaliação física: presencial ou online.
  - Anamnese completa: histórico de saúde, rotina e objetivos.
  - Dieta personalizada: atualizada a cada 15 dias.
  - Manipulados e ergogênicos: acompanhamento com orientações e ajustes individuais.

### Planos (`/planos`)

- Quatro cartões, com o valor mensal equivalente e a economia em relação ao plano mensal:

| Plano | Valor | Equivale a | Observação |
|---|---|---|---|
| Mensal | R$ 250,00 | — | — |
| Trimestral | R$ 637,50 | R$ 212,50/mês | — |
| Semestral | R$ 1.200,00 | R$ 200,00/mês | bônus exclusivos |
| Anual | R$ 2.250,00 | R$ 187,50/mês | destaque "Mais escolhido" e bônus exclusivos |

- Bônus exclusivos dos planos semestral e anual:
  - "Vale avaliação física" (avaliação completa sem custo adicional);
  - "Desconto em produtos selecionados" (até 15% em produtos do parceiro de suplementos e nutrição esportiva).
- Seção "O que cada plano inclui".
- Botão de cada plano: criar conta/agendar ou WhatsApp, conforme a configuração.

### Dúvidas (`/duvidas`)

- Perguntas em acordeão:
  - Como funciona a primeira consulta?
  - A consulta on-line tem a mesma qualidade?
  - Quanto tempo leva para ver resultados? (sem prometer resultado)
  - Posso remarcar minha consulta? (aviso de 24h)
  - Como meus dados são protegidos?
- No fim, o botão "Tirar dúvida pelo WhatsApp".

### Outras páginas

- **Privacidade (`/privacidade`)**: política LGPD completa, com:
  - quais dados são coletados e por quê;
  - base legal;
  - tempo de guarda;
  - direitos do titular;
  - contato e responsável pelos dados.
- **Agendar (`/agendar`)**: escolha de serviço, dia e horário, com página de confirmação.
- Configuração do agendamento: pelo **site** (padrão) ou direto pelo **WhatsApp**. Os preços de consultas avulsas ficam escondidos; os preços dos planos aparecem.

## 5. Contas e login

- **Entrar (`/login`, também `/entrar`)**: e-mail e senha, botão "Continuar com Google" e links "Esqueci minha senha" e "Criar conta".
  - Subtítulo: "Acesse a sua área para ver o plano, o diário e as mensagens."
  - O layout precisa funcionar bem no celular.
- **Criar conta (`/criar-conta`)**:
  - nome, e-mail, telefone e senha (mínimo 8 caracteres, com letras e números);
  - aceite da política de privacidade;
  - confirmação por e-mail (quando houver envio de e-mails configurado);
  - também é possível entrar pelo Google.
- **Recuperar e redefinir senha**, por link com validade.
- **Perfis**: administrador (André), equipe e cliente. O cliente vai para `/paciente` (ou `/app`); a equipe vai para `/admin` (ou `/painel`). Sem permissão, a pessoa é mandada ao login com um aviso.
- **Segurança**:
  - senhas com hash;
  - sessão em cookie httpOnly;
  - limite de tentativas;
  - registro de acessos (auditoria);
  - dados de saúde só para quem tem permissão.
- Conta inicial do André criada por um script SQL (`criar-admin.sql`). O script gera um link de primeiro acesso para ele criar a senha; nenhuma senha fica escrita no arquivo.

## 6. Área do cliente (`/paciente`)

- **Hub de entrada**, com:
  - saudação;
  - próxima consulta;
  - pendências, por exemplo "Responder anamnese";
  - atalhos para tudo.
- **Anamnese no site**:
  - formulário em etapas, com rascunho salvo automaticamente;
  - envio final;
  - o André vê as versões e baixa o PDF.
- **Plano**:
  - refeições por horário, com opções e substituições;
  - "Marcar como feita";
  - PDF do plano;
  - plano vindo do painel ou texto livre do coach.
- **Prescrições**: área de texto livre escrita pelo coach (suplementos e outras orientações).
- **Diário**: refeições, água (copos), humor e fotos.
- **Evolução**:
  - medidas e peso em gráficos;
  - fotos de evolução privadas;
  - metas.
- Mensagens com o coach (chat), formulários, receitas, materiais, lista de compras, calculadoras, consultas (com arquivo de calendário `.ics`) e notificações.
- **Meus dados** (LGPD): **"Baixar meus dados"** (exportação completa) e **"Excluir minha conta"**.
- Funciona como app (PWA), com uso off-line básico e notificações push.

## 7. Painel do coach (`/admin`)

- Início com avisos e resumo.
- Clientes:
  - ficha com abas (dados, anamnese com versões e PDF, plano, prescrição escrita, avaliações e composição corporal, diário, evolução, mensagens, financeiro);
  - cadastro de cliente com convite por link.
- Seções de acompanhamento e organização:
  - acompanhamento (quem precisa de atenção);
  - agenda (confirmar e remarcar, feriados, lembretes, videochamada);
  - planos alimentares (editor com cálculo e modelos);
  - banco de alimentos, receitas, materiais, formulários e calculadoras.
- Mensagens, interessados (contatos vindos do site), financeiro (planos e pagamentos) e relatórios (CSV).
- Privacidade (pedidos LGPD).
- **Configurações**, com:
  - nome e título;
  - biografia, método, diferenciais e objetivos;
  - "como funciona" e "incluso nos planos";
  - planos e valores;
  - WhatsApp, Instagram, horário e modalidade;
  - canal de agendamento (site ou WhatsApp);
  - mostrar ou ocultar preços;
  - faixa de demonstração;
  - logo e foto;
  - modelos de mensagem.

## 8. Técnica

- Next.js (App Router, React 19, TypeScript), PostgreSQL com Drizzle ORM e autenticação própria (sem serviço externo).
- Login com Google via OIDC.
- E-mails via Resend (opcional).
- Publicação com Docker Compose.
- Testes: unitários com Vitest e de ponta a ponta com Playwright, incluindo layout no celular sem rolagem horizontal.
- Também deve haver uma prévia estática em um único `index.html`.

## 9. Observação legal

Como o André atua como **coach**, prescrição de dieta individualizada e de suplementos/manipulados é atribuição de nutricionista ou médico. Os textos devem tratar o serviço como acompanhamento e orientação. O conteúdo de "prescrição" deve vir de profissional habilitado.
