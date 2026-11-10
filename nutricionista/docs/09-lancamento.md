# Lançamento — do sistema de demonstração ao site do André no ar

Este guia leva o sistema ao ar no domínio próprio e com os dados reais do André Farion. São três partes:

1. Juntar as informações do consultório.
2. Preencher o perfil.
3. Publicar no servidor.

Os detalhes técnicos de servidor, backups e monitoramento estão em [03-publicacao.md](03-publicacao.md).

## 1. Informações necessárias

Tudo isto vai aparecer no site e nos PDFs. Nada aqui é senha.

| Informação | Onde aparece | Exemplo |
|---|---|---|
| WhatsApp (já preenchido: (41) 99155-1789) | "Falar no WhatsApp", avaliação por videochamada, botão flutuante, cobranças | (41) 99155-1789 |
| Instagram | Rodapé e contato | @andrefarion |
| E-mail de contato | Contato e política de privacidade | contato@andrefarion.com.br |
| E-mail para pedidos da LGPD | Política de privacidade | pode ser o mesmo |
| Biografia curta (3 a 5 frases) | Seção "Sobre" | Formação, tempo de atuação, público, o que valoriza |
| Especialidades e diferenciais | Seção "Sobre" | Reeducação alimentar, nutrição esportiva… |
| Foto profissional e logo (opcional) | Site, app e PDF | JPG ou PNG, boa luz, fundo neutro |
| Domínio desejado | Endereço do site | andrefarion.com.br |
| Hospedagem | Onde o sistema roda | VPS com Docker (recomendado) ou serviço gerenciado |

> **Nunca envie senhas, chaves ou códigos de acesso por chat ou e-mail.** Todas as senhas do sistema são geradas no próprio servidor (passo 3).

**Sobre a consultoria de treinos:** a prescrição de treino físico é atribuição do profissional de educação física (CREF). Se a consultoria incluir treino, informe no texto do serviço quem é o profissional responsável por essa parte.

## 2. Preencher o perfil

1. Copie o modelo:
   ```bash
   cp deploy/perfil.exemplo.json deploy/perfil.json
   ```
2. Troque todo texto que começa com `PREENCHER`. Os dias da semana vão escritos (`segunda`, `terca`, `quarta`…). Não há agendamento de consultas: o site leva a **Ver planos → Contratar**, e a avaliação por videochamada é combinada pelo WhatsApp. O bloco `agenda` guarda só o fuso horário. Os blocos `planos` e `planosIncluem` já vêm com os planos do material de divulgação (Mensal, Trimestral, Semestral e Anual); `"mostrarValoresPlanos": true` mostra os valores deles no site.
3. Confira antes de gravar. Este comando não precisa de banco:
   ```bash
   node scripts/aplicar-perfil.mjs deploy/perfil.json --conferir
   ```
   O comando aponta, campo por campo, o que falta ou está em formato errado. Ele também recusa dados de exemplo esquecidos, como `example.com`, "Rua Exemplo" ou o WhatsApp `5500000000000`.

O arquivo `deploy/perfil.json` só contém informações públicas (as que já aparecem no site), então pode ficar no Git.

## 3. Publicar

No servidor (Ubuntu com Docker; veja o passo a passo do servidor em [03-publicacao.md](03-publicacao.md)), dentro da pasta `nutricionista/`:

```bash
# 3.1 Senhas e chaves novas, geradas no próprio servidor (cria deploy/.env com permissão 600)
docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/gerar-segredos.mjs andrefarion.com.br contato@andrefarion.com.br

# 3.2 Subir tudo (banco, aplicação, HTTPS automático, lembretes e backup diário)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

# 3.3 Conta do André (imprime um link para ele criar a senha; ou use deploy/criar-admin.sql, ver docs/11)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec app node scripts/create-admin.mjs "André Farion" andre@andrefarion.com.br

# 3.4 Dados reais do consultório (também desliga a faixa de demonstração)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T app node scripts/aplicar-perfil.mjs - < deploy/perfil.json
```

Depois, no painel (**Configurações**), o André:

- envia a foto, o logo e a assinatura;
- revisa os textos;
- revisa a política de privacidade.

Para usar e-mail (recuperação de senha e confirmações):

1. Crie a chave em [resend.com](https://resend.com).
2. Confirme o domínio lá.
3. Cole a chave em `RESEND_API_KEY` no `deploy/.env`.
4. Repita o passo 3.2.

### Observações

- O banco de produção começa **vazio**: nenhum cliente ou plano de demonstração vai para o ar. Os dados fictícios existem só no ambiente local (`npm run setup`).
- `aplicar-perfil.mjs` pode ser rodado de novo quando os dados mudarem. Ele:
  - atualiza os serviços pelo nome;
  - desativa os planos que saíram do arquivo, sem apagar o histórico de pagamentos;
  - substitui os horários de atendimento e as perguntas frequentes.

  Ajustes feitos depois pelo painel nesses mesmos campos são sobrescritos. Escolha um caminho e mantenha.
- **Não gere os segredos de novo depois de publicar.** Trocar `DB_PASSWORD` impede o acesso ao banco existente. Trocar as chaves VAPID desliga as notificações de todos os celulares. Guarde uma cópia do `deploy/.env` num cofre de senhas.

## Checklist antes de divulgar

- [ ] `aplicar-perfil.mjs --conferir` sem pendências e perfil aplicado
- [ ] `aplicar-perfil.mjs --pendencias` sem pendências (biografia, e-mail, Instagram, foto e textos de exemplo); o quadro "Antes de publicar o site" sumiu do Início do painel
- [ ] Formações e certificações preenchidas (Configurações → Perfil)
- [ ] Senha do André criada pelo link e login testado no celular
- [ ] Foto profissional, logo e assinatura enviados
- [ ] Site abre em `https://` com cadeado; `https://DOMINIO/api/health` responde `{"ok":true}`
- [ ] Compra de teste feita pela seção **Planos** da página inicial (`/#planos`): Contratar → conta → anamnese
- [ ] App instalado no celular ("Adicionar à tela inicial") e notificação de teste recebida
- [ ] E-mail configurado; recuperação de senha e **link mágico** testados (o botão "Renovar meu plano" do e-mail de vencimento também)
- [ ] Mercado Pago ([14-mercado-pago.md](14-mercado-pago.md)):
  - [ ] aplicação "Farion" criada na conta do André;
  - [ ] webhook com o evento "Pagamentos" apontando para `https://DOMINIO/api/webhooks/mercadopago`;
  - [ ] `MERCADOPAGO_ACCESS_TOKEN` (produção) e `MERCADOPAGO_WEBHOOK_SECRET` no `deploy/.env`;
  - [ ] pagamento real de valor baixo aprovado, aparecendo como "Confirmado por mercadopago", e depois estornado;
  - [ ] "Simular notificação" no painel do Mercado Pago respondida com 200;
  - [ ] parcelas máximas e nome na fatura conferidos em Configurações → Integrações
  - [ ] se for usar a assinatura mensal: evento "Planos e assinaturas" marcado no mesmo webhook
- [ ] SEO ([16-seo-e-captacao.md](16-seo-e-captacao.md)): `APP_URL` com o domínio final; `https://DOMINIO/robots.txt` e `https://DOMINIO/sitemap.xml` abrem; site cadastrado no Google Search Console com o sitemap enviado; link do site testado no Depurador de compartilhamento da Meta (imagem verde aparece)
- [ ] Pixels: se for anunciar, IDs da Meta/Google em Configurações → Captação e pixels e aviso de cookies conferido; se não, deixar desligados
- [ ] Política de privacidade revisada por profissional jurídico
- [ ] Backup externo configurado e uma restauração testada ([03-publicacao.md](03-publicacao.md))
- [ ] Monitoramento de disponibilidade ativo (UptimeRobot ou similar)

## Qualidade antes de publicar (Parte 6)

O que é automático está em [19-qualidade.md](19-qualidade.md): Lighthouse ≥ 90 em desempenho e acessibilidade (`npm run lighthouse`) e os testes de ponta a ponta. O que só dá para conferir em aparelhos e contas reais fica nesta lista. Marque cada item no domínio final (`https://DOMINIO`), com `APP_URL` já apontando para ele.

### Celulares reais: instalação e notificações push

- [ ] **Android (Chrome):**
  - [ ] abrir `https://DOMINIO/paciente` com uma conta de cliente de teste e instalar pelo menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial");
  - [ ] o ícone verde aparece na tela inicial e o app abre em tela cheia, sem a barra do navegador;
  - [ ] **Mais → Notificações → Ativar notificações** e permitir ("Notificações ligadas neste aparelho");
  - [ ] fechar o app e bloquear a tela; no computador, o André manda uma mensagem a esse cliente pelo painel (ficha → Mensagens): a notificação "Mensagem de André" chega e, tocada, abre a conversa;
  - [ ] um lembrete de água ou de refeição chega no horário, com a tarefa periódica rodando a cada 5 minutos ([03-publicacao.md](03-publicacao.md)).
- [ ] **iPhone (iOS 16.4 ou mais novo; Ajustes → Geral → Sobre → Versão do iOS):**
  - [ ] abrir no **Safari** e tocar em Compartilhar → **Adicionar à Tela de Início** (no iPhone, o push só funciona com o app instalado);
  - [ ] abrir o app **pelo ícone**, e não pelo Safari, e ativar as notificações em Mais → Notificações (pelo Safari aparece o aviso "No iPhone, instale o app…");
  - [ ] a mensagem do André pelo painel chega como notificação com o app fechado;
  - [ ] o lembrete de refeição chega no horário;
  - [ ] em Ajustes → Notificações, o app "Farion" aparece com os alertas permitidos.
- [ ] Nos dois aparelhos: o **horário de silêncio** é respeitado (nenhum push entre 22h e 7h, ou no horário escolhido) e uma refeição marcada como feita antes da hora não gera push.
- [ ] Nos dois aparelhos: sem internet (modo avião), o app instalado ainda abre o **Plano**.

### Lembretes no calendário (.ics)

- [ ] **Google Agenda (Android ou computador):**
  - [ ] em **Mais → Notificações**, "Assinar por link" → **Criar link de assinatura** e copiar o link `https://…/lembretes/….ics`;
  - [ ] no Google Agenda do computador: Outras agendas → **+** → **Do URL**, colar e adicionar;
  - [ ] os eventos "Água · ver no app" e "Almoço · ver no app" aparecem nos horários certos (fuso de Brasília);
  - [ ] o **alarme toca no celular** no horário de um evento (deixe um para daqui a alguns minutos mudando o horário da água);
  - [ ] o Google atualiza assinaturas em algumas horas, não na hora: confira no dia seguinte que uma mudança de horário chegou sozinha.
- [ ] **Calendário do iPhone:**
  - [ ] em Mais → Notificações, tocar em **Adicionar lembretes ao meu calendário**, abrir o arquivo e tocar em "Adicionar tudo"; ou **Assinar no calendário do celular** (`webcal://`);
  - [ ] os eventos aparecem nos horários certos e o **alarme toca** com o app fechado e sem internet.
- [ ] Baixar o arquivo de novo **não duplica** eventos (o iPhone substitui os mesmos eventos).
- [ ] Depois de mudar o plano, aparece "Seus horários mudaram: atualize os lembretes do calendário".
- [ ] **Gerar um novo link** faz o link antigo parar de funcionar; "Cancelar o link de assinatura" também.
- [ ] Os eventos mostram só o nome da refeição e o horário, sem calorias, peso ou dados de saúde.

### Prévia do link no WhatsApp

- [ ] Mandar `https://DOMINIO` numa conversa do WhatsApp (de preferência para você mesmo):
  - [ ] a prévia mostra o **título**, a **descrição** e a **imagem verde** (1200×630);
  - [ ] repetir com `https://DOMINIO/planos` e com um post de Conteúdos (com capa, a imagem é a capa).
- [ ] O WhatsApp guarda a prévia em cache. Se uma mudança não aparecer, teste com `https://DOMINIO/?v=2` e use o [Depurador de compartilhamento da Meta](https://developers.facebook.com/tools/debug/) para atualizar.
- [ ] O botão **Chamar no WhatsApp** do app do cliente abre a conversa com o número do André e o texto pronto. Teste no modo escolhido em Configurações → Chat ("os dois", "só app" ou "só WhatsApp").

### Compra com o Mercado Pago em modo de teste

Antes do pagamento real de valor baixo (lista acima), faça o fluxo completo com as **credenciais de teste**:

- [ ] no [painel de desenvolvedores do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app), na aplicação "Farion", copiar o **Access Token de teste** e criar as **contas de teste** (um vendedor e um comprador) em "Contas de teste";
- [ ] num ambiente de homologação, ou temporariamente no servidor, colocar o token de teste em `MERCADOPAGO_ACCESS_TOKEN` e reiniciar (`docker compose up -d app`);
- [ ] com o webhook apontando para `https://DOMINIO/api/webhooks/mercadopago`, escolher um plano em `/planos`, criar uma conta de cliente nova e pagar entrando com o **comprador de teste**:
  - [ ] **cartão de teste aprovado**: titular `APRO`, um dos [cartões de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/cards). A anamnese é liberada na volta e a ficha mostra "Confirmado por mercadopago";
  - [ ] **cartão recusado** (titular `OTHE`): o acesso continua fechado, com a mensagem de pagamento não aprovado;
  - [ ] **Pix**: a tela "Aguardando pagamento" aparece e libera sozinha quando o Mercado Pago confirma (ou na próxima execução da tarefa periódica);
- [ ] **recibo:** em Meus dados → **Recibo (PDF)**, abrir e conferir o nome do cliente, o valor, o plano e o número, sem "nutricionista" ou CRN;
- [ ] no painel do Mercado Pago: **Webhooks → Simular notificação** responde 200;
- [ ] voltar o `MERCADOPAGO_ACCESS_TOKEN` para o de **produção** e reiniciar. Apagar as contas de cliente de teste em Clientes → ficha → Excluir.
