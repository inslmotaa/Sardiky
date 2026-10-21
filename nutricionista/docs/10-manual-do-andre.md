# Manual do André — painel do nutricionista e app do cliente

O sistema tem duas áreas:

- o **painel do André**, em `/admin`, onde ele trabalha;
- o **app do cliente**, em `/paciente`, onde cada pessoa acompanha o que recebeu.

Os dados ficam num banco só, e cada área enxerga apenas o que lhe cabe.

Os dois entram pela mesma tela, `/login`, e o sistema leva cada um para a sua área. No celular, o cliente pode instalar o app pela opção "Adicionar à tela inicial".

## 1. Painel do André (`/admin`)

### Rotina de um novo cliente

1. **O contato chega pelo WhatsApp.** No site, os botões de agendar e o formulário de contato abrem a conversa com (41) 99155-1789.
2. **Cadastrar.** Em **Pacientes → Novo paciente**, informe nome, telefone e objetivo. Depois, na ficha, clique em **Liberar acesso**: o sistema gera um link de primeiro acesso para o cliente criar a senha. O link pode ser enviado pelo próprio WhatsApp.
3. **Anamnese.** Ela chega de dois jeitos:
   - automaticamente, pelo modelo escolhido em Configurações;
   - pelo Google Forms, se ele estiver ligado ao webhook (veja [08-fase-3.md](08-fase-3.md)).

   Restrições e alergias informadas aparecem em destaque no editor de planos.
4. **Avaliação.** Na ficha do cliente, aba **Avaliações e evolução**, registre peso, circunferências, dobras e bioimpedância. O percentual de gordura é calculado sozinho.
5. **Montar e enviar a alimentação.** Na ficha do cliente, aba **Planos alimentares → Novo plano**:
   - escolha os alimentos da base, com medidas caseiras, ou as receitas cadastradas;
   - as calorias e os macros são calculados enquanto você monta;
   - cada item pode ter substituições equivalentes sugeridas;
   - ao clicar em **Liberar para o paciente**, o plano aparece na hora no app do cliente, com notificação no celular. O PDF com sua assinatura fica disponível para os dois.
6. **Extras para o cliente:**
   - receitas e materiais educativos (PDF, vídeo, link);
   - suplementos e exames na aba **Prescrições**;
   - metas na aba **Metas**.

### Acompanhamento do dia a dia

- **Acompanhamento:** mostra quem está em dia, com dificuldade ou sem progresso, pela adesão dos últimos 7 dias. Quem está há 3 dias sem registrar gera um alerta.
- **Mensagens:** é o chat com cada cliente. Dá para responder a uma refeição do diário com foto, mandar áudio e usar respostas rápidas. Fora do horário configurado, o cliente recebe uma resposta automática.
- **Agenda:** consultas, confirmação de presença, link de videochamada e feriados.
- **Financeiro:** pagamentos, inadimplência e cobrança pelo WhatsApp. Os valores ficam só no painel e não aparecem no site.

### Configurações importantes

| Onde | O quê |
|---|---|
| Configurações → Perfil | CRN, biografia, foto, logo, WhatsApp, Instagram |
| Configurações → Perfil | **Botão "Agendar consulta" do site**: WhatsApp (padrão) ou agenda on-line |
| Configurações → Perfil | **Mostrar os valores no site** (desligado por padrão) |
| Configurações → Equipe | Convidar recepção ou outro nutricionista. Cada um pode ver só os próprios clientes. |
| Privacidade e auditoria | Quem acessou o quê, pedidos de exportação e exclusão de dados (LGPD) |

## 2. App do cliente (`/paciente`)

O cliente vê **somente os próprios dados**:

- **Hoje:** a próxima refeição, o que marcar como feito e o contador de água;
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
