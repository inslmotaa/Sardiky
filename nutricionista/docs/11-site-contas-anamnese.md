# Site novo, contas de cliente, anamnese no site e hub do cliente

Este documento descreve o que mudou nesta etapa e o que fazer no servidor.

## Pedido × sistema real

O pedido citava React + Tailwind + Supabase. O sistema já em funcionamento usa:

- Next.js (React) com CSS próprio;
- banco PostgreSQL próprio;
- login próprio.

Para cumprir "mantenha a stack e tudo o que já funciona", cada item foi feito nessa base:

| Pedido | Como ficou |
|---|---|
| Tokens no `tailwind.config` | Variáveis CSS em `src/app/globals.css` (`--verde-escuro`, `--verde-principal`, `--verde-claro`, `--verde-menta`, `--off-white`). |
| framer-motion | Usado de fato (`src/components/motion.tsx`, `PlanCard.tsx`). |
| Supabase Auth (e-mail/senha, Google, recuperar senha) | Login próprio: senhas com scrypt e sessões com token guardado como hash. "Entrar com Google" usa OpenID Connect com PKCE (`src/lib/auth/google.ts`). |
| Tabela `profiles` com `role` | Tabela `users` (role `patient` / `admin` / `staff`) + `patients` (ficha), com o plano escolhido em `patients.package_id`. |
| Row Level Security | O app acessa o banco por um único usuário de servidor. A regra é aplicada em cada consulta, no servidor: o paciente é sempre o da sessão, nunca um número vindo da tela. Os testes automáticos verificam que um paciente não abre dados, arquivos, anamnese nem agenda de outro. |
| SQL no Supabase | Migrações em `drizzle/`, aplicadas sozinhas quando o sistema sobe. Só a conta do André é criada à mão (ver abaixo). |
| Rotas `/app/*` e `/painel/*` | Endereços curtos que levam a `/paciente/*` e `/admin/*` (as rotas existentes continuam). |
| `/entrar`, `/nova-senha` | Levam a `/login` e `/redefinir-senha`. `/criar-conta` e `/recuperar-senha` são as próprias páginas. |

## O que mudou

### Site público

- **Logo + nome**: em todas as áreas (site, cliente, painel), é um único link para `/`, com `aria-label="Ir para a página inicial"`. Na própria página principal, rola suavemente ao topo.
- **Página principal enxuta**, só com:
  1. hero (nome, Nutricionista, CRN, abordagem, "Agendar consulta" e "Ver planos");
  2. bloco "Agendar consulta";
  3. rodapé com privacidade, planos, área do cliente, WhatsApp e CRN.

  Saíram: storytelling, serviços, planos, app, como funciona, depoimentos, FAQ e formulário de contato. Sem foto, aparece o monograma "AF".
- **Agendar consulta**: visitante vai para `/criar-conta?next=/agendar`; quem está conectado vai para `/agendar`. A opção "Agendar pelo WhatsApp" continua em Configurações. Ela agora vem desligada por padrão.
- **`/planos`**:
  - cards com os planos e valores atuais;
  - selo "Mais escolhido" no plano marcado com destaque em Financeiro (o Anual);
  - tabela de comparação com checks;
  - "Quero este plano" leva a `/criar-conta?plano=<id>`, ou a `/agendar?plano=<id>` para quem está conectado.
- **Animações**:
  - formas verdes desfocadas no hero, em loop lento;
  - título palavra por palavra;
  - fade-up ao rolar, com 0,1 s entre cards;
  - botões com elevação, sombra verde e brilho; "Agendar consulta" pulsa a cada 4 s;
  - cards de plano com inclinação e borda verde; o destacado tem borda em gradiente animada;
  - folhas e frutas em SVG com parallax do mouse;
  - cabeçalho com blur ao rolar.

  Com "reduzir movimento", loops e parallax ficam desligados.
- **Contadores** ("+X pacientes atendidos", "X anos de experiência") só aparecem com números reais preenchidos em Configurações. Os campos vêm vazios, marcados `[PREENCHER]`.
- **Cabeçalho**: "Planos" no menu; quando logado, um avatar com menu (Minha área / Sair) substitui "Entrar".

### Contas

- **Cadastro público de cliente** com:
  - nome, e-mail, WhatsApp com máscara, senha (mínimo de 8 caracteres, com letras e números) e confirmação;
  - aceite obrigatório da Política de privacidade, registrado com data e versão.
- **Confirmação de e-mail**: exigida quando o envio de e-mail (Resend) está configurado. Sem ele (demonstração), a conta já nasce confirmada.
- **Primeiro acesso**: vai para `/paciente/anamnese` enquanto a anamnese não foi enviada; depois, para `/paciente`.
- **"Entrar com Google"**: aparece quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` estão definidos. No cadastro, só funciona depois de marcar a caixa da política.
- **Sem permissão para a área**: leva a `/entrar` (paciente no painel, equipe na área do cliente), com aviso e botão para a área certa.
- **Sem cadastro público de nutricionista**: a conta do André é criada pelo SQL ou pelo script abaixo.

### Anamnese no site (substitui o Google Forms)

- **Formulário em `/paciente/anamnese`**:
  - 6 etapas de perguntas mais revisão e envio, com barra de progresso;
  - validação com zod e salvamento a cada etapa ("Salvar e sair");
  - anexo de exames em PDF ou foto, na área privada.
- **Tabela `anamneses`**: paciente, respostas (jsonb), status (`rascunho` / `enviada`), versão e datas.
- **Ao enviar**:
  - tela de agradecimento com "Agendar consulta";
  - aviso "Nova anamnese recebida" no painel (quadro **Avisos** no Início) e por push;
  - nascimento, sexo, altura, objetivo e restrições vão para a ficha; o peso entra na evolução.
- **Painel, ficha do paciente, aba "Anamnese"**:
  - respostas por etapa e histórico de versões;
  - "Exportar PDF";
  - "Pedir reavaliação", que cria uma nova versão já preenchida com as respostas anteriores.
- **Links do formulário externo removidos.** O webhook de formulário externo continua disponível, para quem ainda usar.

### Hub do cliente (`/paciente`)

- **Topo**: saudação com nome e data, mais a "frase do dia" (editável em Configurações). Banner verde fixo "Falta só sua anamnese para começarmos" enquanto ela não for enviada.
- **Acompanhamento**: plano contratado, dias até a próxima consulta e as etapas (Conta criada → Anamnese → Consulta → Plano alimentar → Acompanhamento), com a atual em verde.
- **Próxima consulta**: "Adicionar à agenda" (arquivo .ics) e "Remarcar"; sem consulta, mostra "Agendar consulta".
- **Plano de hoje**: próxima refeição. Sem plano liberado, mostra "Seu plano está sendo preparado pelo André", com ilustração.
- **Água**: copos clicáveis e anel de progresso animado.
- **Peso**: mini gráfico e registro.
- **Atalhos**: Anamnese, Meu plano, Diário, Progresso, Mensagens e Materiais.
- **Dica da semana**: editável em Configurações.
- **Estados vazios**: sempre com ilustração, frase e ação.

### LGPD

- **`/privacidade` reescrita**:
  - dados coletados e finalidade (saúde como dado sensível);
  - quem acessa (só o André);
  - onde ficam e por quanto tempo;
  - direitos de acesso, correção e exclusão;
  - contato.
  
  `[E-MAIL DE CONTATO]` e `[CPF/CNPJ DO RESPONSÁVEL]` aparecem até serem preenchidos em Configurações.
- **Perfil do cliente**:
  - "Baixar meus dados": JSON com a anamnese incluída;
  - "Excluir minha conta": encerra o acesso na hora e registra o pedido. O prontuário é anonimizado em Privacidade quando o prazo de guarda permitir.

### Correções feitas no caminho

- **Avisos do painel**: o painel registrava avisos, mas não os exibia. Agora aparecem em **Início → Avisos**.
- **Links de e-mail**: um link de confirmação de e-mail poderia ser aceito na tela de nova senha. Agora cada link só vale para a sua finalidade.

## O que rodar no servidor

1. **Atualizar o código e subir.** As migrações `0006` e `0007` rodam sozinhas:
   ```bash
   git pull
   docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
   ```
2. **Conta do André** (uma vez). Edite as 3 linhas marcadas em `deploy/criar-admin.sql` (e-mail, nome e endereço do site) e rode:
   ```bash
   docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T db psql -U nutri -d nutri < deploy/criar-admin.sql
   ```
   O resultado é um link de primeiro acesso, válido por 7 dias, para ele criar a senha. Alternativa equivalente: `node scripts/create-admin.mjs`.
3. **Opcional, "Entrar com Google"**:
   - crie um cliente OAuth "Aplicativo da Web" no Google Cloud;
   - cadastre o retorno `https://SEU-DOMINIO/api/auth/google/callback`;
   - preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `deploy/.env` e suba de novo.
4. **Opcional, confirmação de e-mail no cadastro**: preencha `RESEND_API_KEY` e `EMAIL_FROM`.
5. **Em Configurações**, preencha:
   - CPF/CNPJ do responsável e e-mail de contato (Política de privacidade);
   - números dos contadores, se quiser mostrá-los;
   - frase do dia e dica da semana.
