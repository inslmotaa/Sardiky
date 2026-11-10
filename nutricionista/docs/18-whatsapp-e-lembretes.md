# Conversa pelo WhatsApp e lembretes gratuitos (Parte 5)

Tudo aqui é gratuito: nenhuma API paga de WhatsApp. Os lembretes automáticos continuam saindo pela notificação push, o canal principal (gratuita e sem limite). A Parte 5 acrescenta dois canais, também gratuitos: o calendário do celular e um resumo por e-mail. Eles usam a mesma lógica de horários e o mesmo agendador (`/api/cron`).

## 1. Conversar com o coach: chat do app ou WhatsApp

- **Onde o cliente vê:** em **Mensagens**, no Início ("Falar com o coach") e em **Mais**, as duas opções aparecem lado a lado:
  - **"Conversar pelo app"**, o chat que já existia;
  - **"Chamar no WhatsApp"**, que abre `https://wa.me/<WhatsApp do Perfil>` com o texto pronto.
- **Texto pronto:** editável em **Configurações → Chat**. Padrão: "Oi, {coach}! Aqui é {nome}, cliente da consultoria. ", onde {coach} é o primeiro nome do coach e {nome} o do cliente.
- **Modo:**
  - **Configurações → Chat → "Como o cliente fala com você":** os dois (padrão), só pelo app ou só pelo WhatsApp.
  - **Por cliente:** em **Ficha → Resumo → Recursos do app → "Conversa com o coach"**. O padrão das Configurações é o "Padrão", e a ficha vale sobre ele.
  - O chat do app ainda depende do recurso "Mensagens" ligado.
- **Fora do horário de atendimento do chat:** o botão do WhatsApp continua funcionando e mostra embaixo a frase da resposta automática.
- **Registro:** cada toque em "Chamar no WhatsApp" fica registrado (só data e hora, no máximo um por minuto) e aparece na **aba Mensagens da ficha** como "Cliente abriu conversa pelo WhatsApp". O conteúdo não é gravado: fica só no WhatsApp.

## 2. Lembretes no calendário do celular (.ics)

- **Botão:** **Mais → Notificações → "Adicionar lembretes ao meu calendário"** (arquivo `/paciente/lembretes.ics`). Ele gera eventos recorrentes com alarme:
  - **Refeições do plano ativo**, no horário de cada uma. Título "Almoço · ver no app", com link para `/paciente/plano`. Planos com dias diferentes (treino × descanso) viram eventos por dia da semana.
  - **Água**, no intervalo escolhido (a cada 1 a 4 horas), só dentro da janela definida e fora do horário de silêncio.
- **Funciona** no iPhone e no Android (e no Google Agenda e no Outlook). O alarme toca com o app fechado ou sem internet e não depende do servidor.
- **Não duplica:**
  - o UID é fixo por cliente, tipo e posição;
  - baixar de novo **substitui** os eventos;
  - horários que deixaram de existir saem como cancelados.
- **Aviso:** quando o plano ou as preferências mudam de horário, o app mostra "Seus horários mudaram: atualize os lembretes do calendário", no Início e em Notificações.
- **Assinatura por link** (atualiza sozinha): "Assinar por link" gera um endereço `webcal://…/lembretes/<código>.ics`. No Google Agenda, use "Adicionar calendário → Por URL" com o link https. Regras do link:
  - o código é secreto e o banco guarda só o resumo SHA-256;
  - ele aparece uma única vez;
  - gerar outro link revoga o anterior, e "Cancelar o link de assinatura" revoga na hora;
  - link revogado responde 404.
- **Privacidade:** o arquivo traz só o nome da refeição e o horário. Nada de calorias, peso ou dados de saúde.

## 3. Resumo do dia por e-mail

- **Opcional e desligado por padrão.** O cliente liga em **Notificações → Por e-mail → "Resumo do dia às 7h"**. O e-mail traz:
  - as refeições de hoje com os horários;
  - a meta de água;
  - o link do plano.
- **Um e-mail por dia, no máximo.** Não há e-mail a cada refeição ou copo de água: estouraria o limite gratuito.
- **Consentimento:** registrado em `consents` (tipo `lembretes_email`) ao ligar e revogado ao desligar.
- **Descadastro de um clique:** todo resumo tem o link `/descadastrar/<código>` e o cabeçalho `List-Unsubscribe` (com `List-Unsubscribe-Post` para o descadastro automático do provedor).
- **Horário:** sai na primeira execução da tarefa periódica a partir das 7h, fora do horário de silêncio. Se o servidor estiver parado, sai até as 11h.

### Cota gratuita do Resend (100 por dia, 3.000 por mês)

- **Contador:** todo e-mail passa pelo mesmo contador (`email_log`: só categoria, sucesso e data; sem destinatário nem conteúdo).
- **Essenciais têm prioridade e reservam 40 por dia:** recuperação de senha, confirmação de conta, link de acesso, convites e vencimento.
- **O resumo do dia usa só o que sobra:**
  - até 60 por dia (100 − 40);
  - no mês, para antes de comer a reserva dos dias que faltam (3.000 − 40 × dias restantes).
- **Perto do limite** (80% do dia, 90% do mês ou o resumo já pausado):
  - o resumo não é enviado e o push continua;
  - o **Início do painel** mostra "Limite gratuito de e-mail quase atingido".
- **Plano pago do Resend:** ajuste `EMAIL_DAILY_LIMIT` e `EMAIL_MONTHLY_LIMIT` no `deploy/.env`.
- **Sem `RESEND_API_KEY`:** nada quebra. Nenhum e-mail sai e os lembretes seguem por push e calendário.

## 4. WhatsApp nos lembretes

Não há lembretes automáticos pelo WhatsApp: isso só seria possível pela API paga da Meta. O WhatsApp fica:

- no botão "Chamar no WhatsApp" do cliente;
- nos botões do painel (Parte 4, item 7).

## 5. Regras gerais

- **Preferências por tipo e canal:**
  - por tipo: refeições, água, plano, mensagens, pesagem e lembretes (check-in, vencimento);
  - por canal: **push ligado por padrão**, **resumo por e-mail desligado**, calendário quando o cliente baixa ou assina.
- **Horário de silêncio:** vale para tudo (push, calendário e e-mail).
- **Sem repetição:** a tabela `reminder_log` impede o mesmo lembrete duas vezes. **Refeição já marcada como feita no app antes do horário não gera push.**
- **Falha num canal:**
  - fica registrada;
  - o resumo tenta no máximo 2 vezes;
  - não derruba os outros canais (o cron segue com push, check-ins e pagamentos).

## 6. Banco de dados

Migração `drizzle/0022_whatsapp_e_lembretes.sql`:

- `settings.chat_mode` (padrão `ambos`);
- `patients.chat_mode` (vazio = padrão);
- tabela `contact_events` (toques no WhatsApp);
- tabela `reminder_channels` (link do calendário em SHA-256, versão baixada dos horários, código de descadastro);
- tabela `email_log` (contador da cota);
- `notification_prefs.emailResumo`, desligado por padrão.

## 7. Testes

- **Unitários** (`tests/unit/parte5.test.ts`):
  - modo do chat (padrão, ficha, sem número) e texto pronto;
  - cota de e-mail (reserva dos essenciais, para antes de 100/dia, mês);
  - horário de silêncio e "refeição marcada não gera push";
  - .ics válido (CRLF, linhas ≤ 75 octetos, VTIMEZONE, RRULE, VALARM, sem dados de saúde), UID fixo ao baixar de novo e cancelamento de horários antigos.
- **Ponta a ponta** (`tests/e2e/parte5.spec.ts`):
  - as duas opções no app e o toque registrado na ficha;
  - frase fora do horário e texto editado;
  - modo global e por cliente;
  - .ics sem duplicar e aviso de horários mudados;
  - link webcal novo revoga o anterior, e cancelar revoga;
  - resumo das 7h com relógio de teste (uma vez por dia) e descadastro de um clique.
