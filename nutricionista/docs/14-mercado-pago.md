# Mercado Pago: pagamento dos planos (passo a passo)

O cliente escolhe o plano no site, cria a conta e paga pelo **Checkout Pro** do Mercado Pago: Pix, cartão em até 12x ou boleto. O dinheiro cai direto na **conta do André**. Com o pagamento aprovado, o sistema libera a área do cliente e a anamnese, e avisa o André.

Sem as duas chaves abaixo, nada muda: o botão de pagar vira **"Fale pelo WhatsApp para contratar"** e nenhuma área fica bloqueada.

```
MERCADOPAGO_ACCESS_TOKEN=     # credencial da aplicação (fica só no servidor)
MERCADOPAGO_WEBHOOK_SECRET=   # "assinatura secreta" das notificações
```

As duas chaves vão no arquivo `deploy/.env` do servidor (ou nas variáveis de ambiente da hospedagem). Nunca vão para o navegador, para o banco ou para os logs.

---

## 1. Criar a aplicação "Farion"

1. Entre com a **conta do André** em <https://www.mercadopago.com.br/developers/panel/app>.
2. Clique em **Criar aplicação**.
   - Nome: **Farion**.
   - Tipo de pagamento: **Pagamentos on-line**.
   - Produto: **Checkout Pro**.
   - Plataforma: **Não, estou usando uma plataforma própria / outra**.
3. Confirme. A aplicação aparece em **Suas integrações**.

## 2. Testar antes, com credenciais e usuários de teste

1. Dentro da aplicação, abra **Credenciais de teste** e copie o **Access Token** (começa com `TEST-`).
2. Em **Contas de teste**, crie dois usuários:
   - **Vendedor**: a "loja" de teste;
   - **Comprador**: quem vai pagar.
3. No ambiente de teste (um servidor de homologação ou o seu computador com o site acessível pela internet), coloque:

   ```
   MERCADOPAGO_ACCESS_TOKEN=TEST-...   # o token de teste
   MERCADOPAGO_WEBHOOK_SECRET=...      # passo 3 abaixo
   APP_URL=https://endereco-de-teste   # precisa ser público, para o Mercado Pago avisar o site
   ```

## 3. Configurar o webhook (notificações) e a assinatura secreta

1. Na aplicação, vá em **Webhooks → Configurar notificações**.
2. Em **URL** (modo de teste e, depois, de produção), coloque:
   `https://SEU-DOMINIO/api/webhooks/mercadopago`
3. Em **Eventos**, marque só **Pagamentos**.
4. Salve. Copie a **assinatura secreta** e coloque em `MERCADOPAGO_WEBHOOK_SECRET`.
5. Reinicie o sistema (`docker compose ... up -d`) para ele ler as chaves.

O sistema confere a assinatura (`x-signature`) de cada notificação. Notificação sem assinatura válida, ou com mais de 10 minutos, é recusada.

> **Antes de ir para produção:** confira o formato da assinatura em "Notificações → Webhooks → Validar origem da notificação", na documentação do Mercado Pago. Ela é a fonte oficial; a regra está em `src/lib/mercadopago-core.ts` (função `verifyMpSignature`).

## 4. Testar

Faça login no site como um cliente novo (crie uma conta em `/planos` → **Contratar**). Você cai em **Pagamento**: clique em **Pagar com Mercado Pago** e entre com o **comprador de teste**.

Use os cartões de teste da documentação ("Cartões de teste"). O nome do titular decide o resultado:

| Nome do titular | Resultado esperado no sistema |
|---|---|
| `APRO` | Aprovado: volta ao site, a anamnese abre e o André recebe "… pagou o plano …" |
| `OTHE` | Recusado: tela "Pagamento não aprovado" com o botão **Tentar de novo** |
| `CONT` | Pendente: tela "Aguardando pagamento", que se atualiza sozinha |

Depois:

- No painel, veja a ficha do cliente → **Financeiro**: o lançamento aparece como **Confirmado por mercadopago**, com a forma de pagamento e o link **Ver no Mercado Pago**.
- Em **Webhooks → Simular notificação**, envie uma notificação de pagamento. O sistema responde **200** quando a assinatura confere (e **401** quando não confere).
- Pagamentos de teste nem sempre disparam o webhook. Por isso o sistema também confere o pagamento:
  - na volta do Checkout (página de retorno);
  - a cada 5 minutos, pela tarefa agendada (`/api/cron`), que consulta as cobranças pendentes dos últimos 7 dias. As mais antigas viram "cancelado".

## 5. Ir para produção

1. Na aplicação, abra **Credenciais de produção** (pode pedir dados do negócio e ativação da conta).
2. Copie o **Access Token de produção** (começa com `APP_USR-`) para `MERCADOPAGO_ACCESS_TOKEN`.
3. Confira se o webhook de **produção** aponta para `https://SEU-DOMINIO/api/webhooks/mercadopago` e copie a assinatura secreta de produção para `MERCADOPAGO_WEBHOOK_SECRET`.
4. Reinicie o sistema e faça um pagamento real de valor baixo (um plano de teste, depois estorne no painel do Mercado Pago). Veja se o estorno também chega: o lançamento passa a **estornado** e o André é avisado. O cliente **não** é desativado sozinho: quem decide é o André.

---

## Como funciona no sistema

- **Cliente:** `/planos` → **Contratar** → cria a conta (ou entra) → **Pagamento** → Checkout Pro → volta ao site.
  - Aprovado: segue para a anamnese.
  - Pix ou boleto pendente: tela de espera.
  - Recusado: tentar de novo.
- **Enquanto não paga:** a área do cliente mostra a faixa **"Conclua o pagamento para começar"**, e só abrem Pagamento, Mensagens e Meus dados. Clientes cadastrados pelo André no painel não passam por isso.
- **Ao aprovar:**
  - o plano do cliente é ativado;
  - o período começa hoje, ou no dia seguinte ao término atual, se for uma renovação antes de vencer;
  - o período termina em início + meses do plano − 1 dia.
- **Renovação:**
  - faltando 7 dias para o término, a tela Hoje mostra **"Seu plano termina em X dias"** com o botão **Renovar**;
  - a tarefa agendada manda um lembrete por push e e-mail, uma única vez.
- **Painel, ficha do cliente → Financeiro:**
  - **Gerar link de pagamento**, com **Copiar link** e **Enviar pelo WhatsApp**;
  - **Liberar sem pagamento on-line**, para quem pagou por fora (exige a permissão Financeiro e fica na auditoria).
- **Financeiro:** resumo do mês com o recebido pelo Mercado Pago, o pendente e o estornado.
- **Início do painel:** bloco **Pagamentos**, com quem pagou hoje, Pix/boleto aguardando e planos vencendo em 7 dias.
- **Configurações → Integrações:** **Parcelas máximas no cartão** (1 a 12) e **Nome na fatura** (até 13 caracteres).
- **Segurança:**
  - o valor cobrado vem sempre do banco, nunca do navegador;
  - a confirmação nunca confia no corpo da notificação: o sistema busca o pagamento na API do Mercado Pago;
  - se o valor ou a moeda não baterem, nada é liberado, e o André é avisado;
  - o sistema **não guarda dados de cartão**.

### Arquivos

| Arquivo | O que faz |
|---|---|
| `src/lib/mercadopago-core.ts` | Regras puras: assinatura do webhook, tradução de status, conferência de valor, período do plano |
| `src/lib/mercadopago.ts` | Chamadas à API (preferência, pagamento, busca), só no servidor |
| `src/lib/pagamentos.ts` | Aplica o pagamento no banco (webhook, retorno e cron), libera o plano, avisa, concilia e lembra a renovação |
| `src/app/api/webhooks/mercadopago/route.ts` | Recebe as notificações |
| `src/app/paciente/pagamento/` | Telas de pagamento e de retorno do cliente |
| `tests/e2e/mp-falso.mjs` | Mercado Pago falso usado nos testes (ativado por `MERCADOPAGO_API_BASE`) |
