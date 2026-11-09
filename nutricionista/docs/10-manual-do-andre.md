# Manual do André — painel do coach e app do cliente

O sistema tem duas áreas:

- o **painel do André**, em `/admin`, onde ele trabalha;
- o **app do cliente**, em `/paciente`, onde cada pessoa acompanha o que recebeu.

Os dados ficam num banco só, e cada área enxerga apenas o que lhe cabe.

Os dois entram pela mesma tela, `/login`, e o sistema leva cada um para a sua área. O botão **Mostrar** ao lado da senha ajuda a conferir o que foi digitado no celular. No site, o botão verde **Entrar** do cabeçalho abre as duas opções: **Entrar** (quem já tem conta) e **Criar conta**. No fim de cada área (cliente, painel e telas de acesso) há o botão **Voltar para a página principal**. No celular, o cliente pode instalar o app pela opção "Adicionar à tela inicial".

O André é **coach**: o título é sempre Coach, e nenhuma tela, PDF ou configuração mostra registro profissional. O nome do site e do app é **Farion** (cabeçalho, aba do navegador e ícone instalado). Ele é alterado em **Configurações → Perfil → Nome do site**. A apresentação, a página Sobre, o PDF do plano e as mensagens continuam com o nome do André.

## 1. Painel do André (`/admin`)

### Rotina de um novo cliente

1. **O cliente se cadastra pelo site.** Escolhe um plano em `/planos` (ou clica em "Agendar consulta"), cria a conta e já começa pela anamnese, em etapas. O André recebe "Novo cadastro pelo site" e "Nova anamnese recebida" em **Início → Avisos**.
2. **Ou o André cadastra.** Em **Clientes → Novo cliente**, informe nome, telefone e objetivo. Depois, na ficha, clique em **Liberar acesso**: o sistema gera um link de primeiro acesso, que pode ser enviado pelo WhatsApp. No primeiro acesso, o cliente preenche a anamnese.
3. **Anamnese.** Depois de fechar o plano e criar a conta, o cliente escolhe como responder: **aqui no app** (em etapas, recomendado) ou **pelo formulário** (Google Forms do André, link em **Configurações → Planos, anamnese e PDF**). Quem usa o formulário clica em **Já enviei o formulário**: o André recebe o aviso e as respostas ficam no Google Forms. Na ficha do cliente, aba **Anamnese**, ficam as respostas por etapa, o histórico de versões, **Exportar PDF** e **Pedir reavaliação**. Restrições e alergias informadas aparecem em destaque no editor de planos.
4. **Avaliação.** Na ficha do cliente, aba **Avaliações e evolução**, registre peso, circunferências, dobras e bioimpedância. O percentual de gordura é calculado sozinho.
5. **Plano contratado.** Na ficha (aba **Resumo**), escolha o **Plano contratado** (Mensal, Trimestral, Semestral ou Anual) e o **Início do acompanhamento**. **Não há prazo automático**: o acompanhamento segue até você decidir. Se quiser, preencha **Término (opcional)**; vazio = sem prazo. No **Início** do painel, o quadro **Planos para enviar ou renovar** lista quem ainda não tem plano alimentar no app e quem tem término marcado para os próximos 15 dias.
6. **Montar e enviar a alimentação.** Na ficha do cliente, aba **Planos alimentares → Novo plano**:
   - escolha os alimentos da base, com medidas caseiras, ou as receitas cadastradas;
   - as calorias e os macros são calculados enquanto você monta;
   - cada item pode ter substituições equivalentes sugeridas;
   - marque **Revisei e aprovo este plano** e clique em **Ativar no app do cliente**: o plano aparece na hora no app, com notificação no celular. O PDF com sua assinatura fica disponível para os dois;
   - dá para enviar **só uma parte**, por exemplo só o café da manhã: as refeições ainda sem alimentos não vão para o cliente, e o sistema avisa quais ficaram de fora. Para completar depois, use **Criar nova versão**;
   - cada plano novo do cliente continua a numeração (versão 1, 2, 3…), e a versão anterior vai para o histórico;
   - **o plano alimentar não tem data de validade**: fica ativo até você publicar outra versão ou clicar em **Encerrar plano** (o cliente é avisado e o plano fica no histórico dele).
7. **Extras para o cliente:**
   - receitas e materiais educativos (PDF, vídeo, link);
   - prescrições na aba **Prescrições**. Em **Escrever prescrição**, o André digita livremente: suplementos, manipulados, ergogênicos, alimentos, quantidades, horários e orientações. As quebras de linha são mantidas no app do cliente e no PDF. Há também os tipos Suplemento, Manipulado, Ergogênico, Fitoterápico, Alimentação, Exame e Outro, com dose, horário e duração opcionais. Cada prescrição pode ser editada (o cliente é avisado) ou encerrada;
   - metas na aba **Metas**.

### Pagamento dos planos (Mercado Pago)

Com o Mercado Pago configurado ([14-mercado-pago.md](14-mercado-pago.md)), o fluxo é o seguinte:

- **Quem se cadastra pelo site:** escolhe o plano em `/planos` (botão **Contratar**) e paga pelo Mercado Pago, com Pix, cartão em até 12x ou boleto. Só depois do pagamento aprovado a área do cliente e a anamnese abrem. Você recebe o aviso "… pagou o plano …".
- **Clientes que você mesmo cadastra:** não passam por isso.
- **Na ficha do cliente → Financeiro:**
  - **Gerar link de pagamento** (com **Copiar link** e **Enviar pelo WhatsApp**);
  - **Liberar sem pagamento on-line**, para quem pagou por fora.
- **Período do plano:** o pagamento aprovado define o período sozinho, do início a início + meses − 1 dia. Na renovação antes de vencer, o novo período começa no dia seguinte ao término atual.
- **Estorno:** o lançamento vira "estornado" e você é avisado. O cliente continua ativo até você decidir.

### Fila de trabalho (Início)

O quadro **O que precisa de você** mostra, nesta ordem, cada item com um botão que leva direto à tela certa:

1. **Montar plano:** pagou e respondeu a anamnese, mas ainda não tem plano alimentar.
2. **Plano vencendo:** termina em até 7 dias (ou já terminou). O botão leva ao Financeiro, para renovar.
3. **Com dificuldade:** baixa adesão nos últimos 7 dias. O botão leva ao diário.
4. **Mensagem:** conversas não lidas.

Logo abaixo fica o bloco **Pagamentos**, com quem pagou hoje, Pix/boleto aguardando e planos que terminam em 7 dias.

### Antes de publicar, depoimentos e formações

- **Antes de publicar o site** (Início): lista o que ainda é texto de exemplo (biografia, e-mail, Instagram, foto, "(Texto de exemplo — …)"). Cada item tem **Ajustar**.
- **Formações e certificações** (Configurações → Perfil): uma por linha, `Curso | Instituição | Ano`. Aparecem na página Sobre, ao lado da foto vertical.
- **Depoimentos** (Configurações → Depoimentos e dúvidas):
  - quando o cliente marca "autorizo publicar" na avaliação da consulta, o depoimento chega aqui como **Aguardando aprovação**, e só vai ao site depois de **Aprovar e publicar**;
  - depoimentos recebidos por fora pedem a data e a forma da autorização;
  - fotos de antes e depois só com a **autorização específica** das fotos (data, forma e a confirmação marcada);
  - o cliente pode retirar a autorização quando quiser.

### Check-ins, renovação, recibos e WhatsApp

- **Check-ins:** na ficha do cliente, aba **Check-ins**, escolha a frequência (ex.: a cada 15 dias). O cliente responde um questionário curto com peso, medidas e fotos opcionais. Quem atrasa aparece em **Acompanhamento → Check-ins atrasados**, com o botão de WhatsApp. Leia as respostas na aba e clique em **Marcar como visto** (o comentário aparece para o cliente).
- **Vitaminas e minerais:** no editor de planos, abra o quadro **Vitaminas e minerais** (fica fechado). Para mostrar ao cliente, ligue o recurso na ficha → Recursos do app.
- **Produto industrializado:** em Alimentos, leia o código de barras com a câmera do celular ou digite os números. Confira os valores com o rótulo, marque a confirmação e salve.
- **Diário:** a aba Diário da ficha mostra **Consumo real × planejado** dos últimos 14 dias.
- **Vencimento:** o Início mostra quem vence na semana, com WhatsApp e mensagem pronta. O cliente recebe avisos 7 e 2 dias antes. Ao vencer, o app dele mostra só o histórico e o botão Renovar.
- **Recibos:** todo pagamento confirmado tem **Recibo (PDF)** no Financeiro e em Meus dados do cliente. Não é nota fiscal.
- **Textos do WhatsApp:** em Configurações → Mensagens. Os botões abrem o WhatsApp com o texto pronto; você revisa e envia.

### Conversa pelo WhatsApp e lembretes

- **Configurações → Chat:** escolha se o cliente fala com você pelo app, pelo WhatsApp ou pelos dois (padrão) e edite a mensagem pronta do botão "Chamar no WhatsApp". Para um cliente específico, use a ficha → Resumo → Recursos do app.
- Cada vez que o cliente toca em "Chamar no WhatsApp", a aba Mensagens da ficha mostra "Cliente abriu conversa pelo WhatsApp" (só a hora; o conteúdo fica no seu WhatsApp).
- Os lembretes de água e refeição saem por notificação (push). O cliente pode também colocá-los no calendário do celular e ligar um resumo diário por e-mail às 7h. Se o Início mostrar "Limite gratuito de e-mail quase atingido", os e-mails essenciais continuam; só o resumo fica pausado.

### Conteúdos, interessados e pixels

- **Conteúdos do site** (menu Gestão): escreva textos para o blog em `/conteudos`. Título, resumo, capa, texto em Markdown simples, **Rascunho** ou **Publicado** e a data (data futura = agendado). Rascunho não aparece no site; o botão **Pré-visualizar** mostra como vai ficar. Todo post termina com o convite para agendar ou contratar.
- **Interessados:** quem preencheu "Quero saber mais" ou o contato, com a **origem** (ex.: "instagram / bio · campanha novembro"). Use links com UTM nas divulgações: `https://SEU-SITE/?utm_source=instagram&utm_medium=bio&utm_campaign=novembro`.
- **Configurações → Captação e pixels:** pixels da Meta e do Google, **desligados por padrão**. Ligados, o site pede o consentimento de cookies e só carrega os pixels para quem aceitar, apenas nas páginas públicas. Detalhes em [16-seo-e-captacao.md](16-seo-e-captacao.md).

### Acompanhamento do dia a dia

- **Acompanhamento:** mostra quem está em dia, com dificuldade ou sem progresso, pela adesão dos últimos 7 dias. Quem está há 3 dias sem registrar gera um alerta.
- **Mensagens:** é o chat com cada cliente. Dá para responder a uma refeição do diário com foto, mandar áudio e usar respostas rápidas. Fora do horário configurado, o cliente recebe uma resposta automática.
- **Agenda:** consultas, confirmação de presença, link de videochamada e feriados.
- **Financeiro:** pagamentos, inadimplência e cobrança pelo WhatsApp.
- **Planos de acompanhamento** (Mensal R$ 250, Trimestral R$ 637,50, Semestral R$ 1.200 e Anual R$ 2.250):
  - são editados em **Financeiro → Planos de acompanhamento**: nome, meses, valor total, selo de destaque e benefícios exclusivos;
  - o valor por mês, o desconto e o "de R$ …" aparecem sozinhos no site;
  - o botão de cada plano abre o WhatsApp com o nome do plano;
  - os valores das consultas continuam fora do site.

### Configurações importantes

| Onde | O quê |
|---|---|
| Configurações → Perfil | Nome do site (Farion), seu nome e o título (sempre Coach), biografia, foto, logo, WhatsApp, Instagram |
| Configurações → Perfil | **Botão "Agendar consulta" do site**: agenda on-line com conta do cliente (padrão) ou WhatsApp |
| Configurações → Perfil | **Mostrar os valores das consultas no site** (desligado por padrão) |
| Configurações → Perfil | **Mostrar os valores dos planos** (ligado) e a lista **Todos os planos incluem** |
| Configurações → Captação e pixels | Pixels da Meta e do Google (desligados por padrão) e exemplo de link com UTM |
| Configurações → Equipe | Convidar recepção ou outro coach. Cada um pode ver só os próprios clientes. |
| Privacidade e auditoria | Quem acessou o quê, pedidos de exportação e exclusão de dados (LGPD) |

## 2. App do cliente (`/paciente`)

O cliente vê **somente os próprios dados**:

- **Hoje:** primeiro o que comer (a próxima refeição em destaque e as refeições do dia com feita/parcial/pulei), depois a água, a consulta, os avisos, o acompanhamento, o peso e a dica da semana. Faltando 7 dias para o fim do plano, aparece **Renovar**;
- **Plano:** o seletor **Seg · Ter · … · Dom** abre o dia certo (hoje fica marcado), cada aba mostra os dias que cobre (ex.: "Dia de treino · Seg, Qua, Sex") e a visão **Semana** resume a semana com as kcal. O PDF traz a mesma tabela;
- **Meu perfil** (a bolinha com as iniciais, no topo, ou **Mais → Meu perfil**):
  - plano contratado, vigência e dias restantes, com o botão **Renovar o plano** quando estiver perto do fim;
  - o coach, a etapa, o objetivo e a próxima consulta;
  - o plano alimentar ativo, com as refeições do dia, **Ver plano completo**, **Baixar PDF** e **Lista de compras**;
  - **Aparência**: automático (segue o celular), claro ou escuro;
  - cadastro, troca de senha e privacidade (LGPD);
- **Fotos e exames** (em **Mais**), tudo opcional:
  - foto da refeição, pelo diário;
  - fotos do corpo (frente, lado e costas), em Progresso;
  - exames em PDF ou foto, que aparecem na ficha em **Documentos e exames** com o aviso "Exame enviado pelo cliente".
  O André liga ou desliga as fotos do corpo e os exames por cliente em **Recursos do app do cliente**;
- **Plano:** opções, quantidades, substituições e o PDF;
- **Diário:** foto e anotações de cada refeição;
- **Progresso:** peso, medidas, fotos de evolução e metas;
- **Mensagens:** o chat com o André;
- **Mais:**
  - lista de compras gerada do plano;
  - receitas e materiais;
  - consultas: confirmar presença, pedir remarcação, entrar na videochamada e avaliar o atendimento;
  - notificações;
  - os próprios dados (LGPD): baixar uma cópia ou pedir exclusão.

## 3. Banco de dados e LGPD

**Um banco, duas áreas com acesso separado.** Existe um único banco PostgreSQL. A separação não depende de dois bancos: ela é feita em cada consulta ao banco, assim:

- o painel exige login de equipe e permissão para cada módulo;
- no app do cliente, o sistema usa o cliente da sessão logada, nunca um número vindo da tela ou do endereço. Por isso, um cliente não consegue abrir dados de outro, mesmo alterando o link.

Ter dois bancos separados obrigaria a copiar o plano, as mensagens e o diário de um para o outro. Isso duplica os dados pessoais e cria mais pontos de vazamento, o contrário do que a LGPD pede.

Outras proteções já ativas:

| Exigência | Como o sistema atende |
|---|---|
| Senhas | Nunca guardadas em texto: só o resumo criptográfico (scrypt). Login com bloqueio após tentativas erradas. |
| Arquivos (fotos, exames) | Pasta privada, entregues só depois de conferir quem pede |
| Mínimo necessário | O contato do site vai direto para o WhatsApp e não guarda nada no servidor |
| Consentimento | Registrado com data no primeiro acesso e na anamnese |
| Direitos do titular | O cliente baixa os próprios dados e pode pedir exclusão pelo app |
| Rastreabilidade | Registro de auditoria das ações sensíveis no painel |
| Retenção | Dados de interessados apagados automaticamente após o prazo configurado |
| Transporte | Somente HTTPS, com cabeçalhos de segurança |
| Cópias | Backup diário do banco e dos arquivos (copie para fora do servidor; veja [03-publicacao.md](03-publicacao.md)) |

Mais detalhes em [02-seguranca-lgpd.md](02-seguranca-lgpd.md).

**Sobre o WhatsApp:** as conversas pelo WhatsApp ficam no celular do André e nos servidores da Meta, fora deste sistema. Evite pedir exames e dados de saúde por lá. Para isso, use a anamnese, o chat e o envio de arquivos do app, que ficam no banco protegido.

## Como o painel está organizado

O menu lateral tem quatro grupos, do que se usa todo dia ao que se configura uma vez:

- **Dia a dia:** Início (resumo do dia), Agenda, Clientes, Mensagens e Acompanhamento (quem está em dia ou precisa de atenção).
- **Planos e conteúdo:** Planos alimentares, Alimentos, Receitas, Materiais, Formulários e Calculadoras.
- **Gestão:** Financeiro, Relatórios e Interessados (contatos vindos do site).
- **Sistema:** Configurações e Privacidade e auditoria.

O atendimento é 100% on-line: as consultas são por videochamada e o link é gerado ao confirmar a consulta. No app, o cliente encontra no topo do "Hoje" os atalhos Meu plano, Registrar refeição, Meu progresso e Falar com o coach.

## Alimentos e tabela nutricional

A base de alimentos é a **TACO 4ª ed. completa** (597 alimentos, Unicamp). Em **Alimentos**, busque pelo nome e abra a ficha do alimento para ver:

- a tabela nutricional inteira (energia, macronutrientes, minerais e vitaminas), por 100 g ou por medida caseira;
- as medidas caseiras do alimento e as **sugestões do IBGE** (clique em "Usar" para adicionar);
- o fator de cocção e se o alimento aparece nos planos.

Para produtos de marca, use **Cadastrar alimento próprio** com os dados do rótulo. No editor de planos, o cartão **Vitaminas e minerais** mostra o total do dia. Detalhes e fontes em `docs/12-tabelas-de-alimentos.md`.
