# App do cliente e painel (Parte 4)

Check-ins periódicos, micronutrientes, base de alimentos completa com código de barras, diário de dias passados, vencimento e renovação (com assinatura opcional), recibo em PDF, WhatsApp padronizado, login por link mágico e exportação automática antes da exclusão.

## 1. Check-ins periódicos

- **Painel → ficha do cliente → aba Check-ins:** o coach escolhe a frequência (7, 14, 15, 21 ou 30 dias, ou desligado) e o primeiro prazo. Sugestão: a cada 15 dias, alinhado aos ajustes do plano.
- **O check-in** tem:
  - um questionário curto: quanto seguiu o plano, energia, fome e sono (1 a 5), treinos na semana, dificuldades e comentário;
  - peso e medidas (cintura, quadril, abdômen), que entram nos gráficos como "informados pelo cliente";
  - até 3 fotos opcionais e **privadas** (só o cliente e o coach veem; sem login, o endereço da foto responde 404).
- **Prazo:** o check-in abre 3 dias antes. Depois do prazo, fica **atrasado**.
- **Lembretes por push** (e aviso no app), uma vez cada: quando abre, no dia do prazo e no dia seguinte, se atrasou. Vêm da tarefa periódica (`/api/cron`).
- **No app:** cartão "Check-in aberto/atrasado" no Início, página **Check-in** (também em Mais) e o histórico com o comentário do coach.
- **No painel:**
  - **Acompanhamento** → quadro **Check-ins atrasados**, com dias de atraso e o botão "Lembrar pelo WhatsApp";
  - aba Check-ins → respostas, peso, medidas e fotos, mais "Marcar como visto" com um comentário para o cliente.
- Ao enviar, o próximo prazo é marcado na mesma cadência (prazo anterior + N dias, sem "escorregar").

## 2. Micronutrientes no editor de planos

- **No editor**, o quadro **Vitaminas e minerais** é recolhível e **começa fechado**. Uma coluna por refeição (a opção exibida) e o total do **dia**.
- **Nutrientes:** fibra, cálcio, ferro, magnésio, potássio, sódio, zinco, vitamina A (RAE), vitamina C, B1, B2, B3, B6 e colesterol. Valores da TACO 4ª ed. por 100 g (`foods.nutrients`).
- **Total parcial:** quando algum item não tem o dado analisado na tabela (receitas, itens em texto, "não analisado"), o total aparece com `*` e é parcial.
- **Para o cliente:** não aparece, a menos que o coach ligue **"Vitaminas e minerais no plano"** em Recursos do app (ficha → Resumo). Ligado, o plano do cliente ganha o mesmo quadro, também fechado, com o aviso de que é uma estimativa.

## 3. Base de alimentos completa e código de barras

- **Os 597 alimentos da TACO 4ª ed.** (`src/db/data/taco-4ed.json`), mais as medidas caseiras do IBGE, entram por padrão:
  - no `npm run setup` (seed);
  - no `npm run db:migrate`;
  - na publicação (`scripts/migrate.mjs`, ao subir o Docker);
  - no `deploy/alimentos.sql`.
  Não são só os 60 iniciais. Só importa quando falta; a reimportação preserva os ajustes feitos no painel.
- **Código de barras (Alimentos → Cadastrar alimento próprio):**
  1. **Ler com a câmera** (Chrome/Android, pelo leitor nativo do navegador) ou digitar os números.
  2. O sistema confere o dígito verificador (EAN-8, EAN-13, UPC-A, GTIN-14).
  3. Busca primeiro na base própria (avisa se o produto já está cadastrado) e depois no **Open Food Facts** (base aberta e gratuita).
  4. Os valores por 100 g preenchem o formulário. O sódio é convertido para mg e, sem kcal, a energia vem do kJ.
  5. **O coach confere com o rótulo e marca "Conferi os valores com o rótulo do produto"**: sem isso, nada é salvo.
  6. O código fica salvo no alimento e não pode ser repetido.
- Sem internet ou produto não encontrado: preencha pelo rótulo; o código lido vai junto.
- **Variável de teste:** `OPENFOODFACTS_API_BASE` aponta para um servidor falso (`tests/e2e/mp-falso.mjs`). Em produção, não defina.

## 4. Diário

- **Dias passados:** o cliente registra e **edita** até 365 dias atrás. Ele escolhe a data no campo "Registrar ou editar outro dia" ou pelas setas.
- **Edição:** registros "fora do plano" têm **Editar registro**. As refeições do plano já podiam ser alteradas.
- **Coach (ficha → Diário):** quadro **Consumo real × planejado** dos últimos 14 dias, com kcal, proteína, carboidrato e gordura (real / plano) e o % do planejado:
  - verde entre 80% e 115%;
  - amarelo abaixo de 80%;
  - vermelho acima de 115%.

## 5. Vencimento, renovação e assinatura

- **Término:** ao contratar pelo Mercado Pago, o acesso tem data de término. Uma renovação começa no dia seguinte ao término atual. O coach também pode definir ou limpar o término na ficha.
- **Avisos ao cliente:** **7 dias e 2 dias antes**, por push, aviso no app e **e-mail com o botão "Renovar meu plano"**.
- **Painel:**
  - **Início → fila de trabalho:** "Plano vencendo", com **WhatsApp** (mensagem pronta com o link de renovação) e **Renovar**;
  - **quadro Pagamentos:** "Vencem nesta semana".
- **Ao vencer:** a área do cliente mostra só **o histórico**: peso, planos anteriores em PDF, consultas, diário e check-ins, mais o botão **Renovar**. Ficam abertos:
  - Pagamento;
  - Mensagens;
  - Meus dados (recibos, cópia dos dados, excluir conta).
  Hoje, Plano, Diário e Check-in redirecionam para o histórico, e as ações de registro recusam. Ao renovar, tudo volta.
- **Assinatura mensal (opcional):**
  - **Como funciona:** usa o preapproval do Mercado Pago, sem mensalidade do sistema. Só aparece para o plano **Mensal**, no botão "Assinar: renova todo mês".
  - **Cobrança:** o cliente autoriza no Mercado Pago e a cobrança passa a ser mensal no cartão. Cada cobrança aprovada vira um pagamento no sistema e estende o acesso por um mês.
  - **Cancelamento:** em Meus dados ("Cancelar assinatura"). O acesso vale até o fim do período pago.
  - **Avisos:** quem tem assinatura ativa não recebe os avisos de renovação.
  - **Webhook:** no painel do Mercado Pago, além do evento "Pagamentos", marque **"Planos e assinaturas"** (o mesmo endereço `/api/webhooks/mercadopago`).

## 6. Recibo automático

- Todo pagamento **confirmado** tem recibo em PDF, gerado pelo próprio sistema (`pdf-lib`). O recibo traz:
  - número sequencial (atribuído na primeira emissão);
  - valor e valor por extenso;
  - descrição, data e forma de pagamento;
  - código da operação;
  - nome, título e CPF/CNPJ do responsável (Configurações) e contato.
- **Onde baixar:**
  - **Cliente:** Meus dados → Pagamentos e recibos;
  - **Coach:** Financeiro e ficha → Financeiro ("Recibo (PDF) nº 00001").
- **Acesso:** o cliente só baixa os próprios. A equipe precisa da permissão de financeiro.
- **Não é nota fiscal:** não há integração com emissor de NFS-e, e o rodapé do recibo diz isso.

## 7. WhatsApp sem custo

- **Nenhuma API paga.** Todos os botões de WhatsApp do painel usam um componente único (`WhatsAppButton`), que abre `wa.me` com o texto pronto para revisar e enviar.
- **Textos editáveis em Configurações → Mensagens → Mensagens do WhatsApp** (em branco = texto padrão):

| Mensagem | Onde aparece | Variáveis |
|---|---|---|
| Lembrete de consulta | Agenda → consulta | `{nome}` `{data}` `{hora}` `{servico}` `{link}` |
| Plano novo publicado | Plano publicado ("Avisar pelo WhatsApp") | `{nome}` `{link}` |
| Check-in pendente | Acompanhamento e aba Check-ins | `{nome}` `{data}` `{link}` |
| Plano vencendo | Início (fila e Pagamentos) | `{nome}` `{plano}` `{data}` `{link}` |
| Cobrança em aberto | Financeiro ("Cobrar pelo WhatsApp") | `{nome}` `{descricao}` `{valor}` `{data}` |
| Link de pagamento do plano | Ficha → Financeiro | `{nome}` `{link}` |
| Contato com o cliente | Ficha e Acompanhamento | `{nome}` |
| Resposta a interessado | Interessados | `{nome}` `{coach}` |

O WhatsApp do André, **(41) 99155-1789**, já vem configurado: no seed, no `perfil.exemplo.json` e na criação do banco de produção (`deploy/criar-admin.sql` e `scripts/create-admin.mjs`).

## 8. Login por link mágico

- **Na tela Entrar:** "Sem senha? Receba um link de acesso por e-mail". O link:
  - vale **15 minutos**;
  - é de **uso único**;
  - fica guardado só como resumo SHA-256.
- **Mesma resposta** para e-mail com ou sem conta, para não revelar quem tem cadastro. Há limite de pedidos por IP e por e-mail.
- **Confirmação de um clique:** ao abrir o link, a página pede um clique em "Entrar". Assim, leitores de e-mail que abrem links sozinhos não gastam o código.
- **Ao entrar:** o link confirma o e-mail e destrava a conta, se estiver bloqueada por tentativas. Fica registrado na auditoria (`login_link_magico`).
- **Formas de entrar:** senha, Google e link mágico convivem.

## 9. Exclusão de conta e anonimização com exportação automática

- **Antes de excluir a conta (pelo cliente) ou anonimizar (pelo coach),** o sistema gera a **exportação completa dos dados**: o mesmo JSON do "Baixar meus dados", agora com check-ins e pagamentos.
- **Onde fica:** um arquivo privado, guardado por **30 dias** para entregar ao titular, se ele pedir, e apagado sozinho depois (tarefa periódica).
- **Na auditoria** (`lgpd_exportacao_automatica`) ficam o motivo, o protocolo, o **resumo SHA-256** e o tamanho, nunca os dados em si.
- **Painel → Privacidade e auditoria → Exportações guardadas antes da exclusão:** lista e download, só com a permissão de configurações.

## 10. Banco de dados

Migração `drizzle/0021_app_do_cliente_e_painel.sql`:

- **tabela `checkins`:** prazo, situação, respostas, peso, medidas, fotos, medida gravada, revisão e comentário do coach;
- **`patients`:** `checkin_every_days`, `next_checkin_due`, `mp_preapproval_id`, `mp_preapproval_status`;
- **`foods.barcode`:** único;
- **`payments.receipt_number`:** único;
- **novo tipo de token:** `link_magico`;
- **recursos do app:** `micronutrientes` (desligado por padrão).

O `deploy/banco-de-dados.sql` foi gerado de novo (`npm run db:sql`).

## 11. Testes

- **Unitários** (`tests/unit/parte4.test.ts`):
  - código de barras e leitura do Open Food Facts;
  - soma de micronutrientes por refeição e dia;
  - estados e prazos do check-in;
  - avisos de renovação e acesso vencido;
  - referência da assinatura;
  - valor por extenso;
  - modelos e links do WhatsApp;
  - real × planejado.
- **Ponta a ponta** (`tests/e2e/parte4.spec.ts`):
  - micronutrientes no editor e no app;
  - código de barras com Open Food Facts simulado;
  - check-in completo (atrasado, envio com foto privada, revisão, frequência, texto do WhatsApp editado);
  - diário de 45 dias atrás com edição e real × planejado;
  - vencimento e área só com histórico;
  - recibo em PDF e isolamento;
  - link mágico de uso único;
  - assinatura mensal com o Mercado Pago simulado;
  - exclusão de conta com exportação guardada e auditada.
- **E-mails nos testes:** vão para um arquivo local (`EMAIL_TEST_OUTBOX`, só nos testes). Nada sai para a internet.
