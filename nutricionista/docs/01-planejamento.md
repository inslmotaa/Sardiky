# Etapa 1 — Planejamento

Sistema para o consultório do nutricionista **André Farion**, com três ambientes: site público, área do paciente e painel administrativo.

## 1. Arquitetura recomendada

```
Navegador (celular / computador)
        │  HTTPS
        ▼
┌──────────────────────────────────────────────────────────┐
│ Next.js 16 (React 19, TypeScript) — uma única aplicação  │
│                                                          │
│  Páginas (Server Components)  ── leem dados no servidor   │
│  Server Actions               ── todas as gravações       │
│  Route Handlers               ── arquivos, CSV, cron, API │
│                                                          │
│  Camada de regras (src/lib)                              │
│   auth/ (sessão, senha, permissões)  scheduling (agenda)  │
│   booking (conflitos)  audit (trilha)  storage (arquivos) │
└───────────────┬───────────────────────┬──────────────────┘
                │ Drizzle ORM           │ disco privado / S3
                ▼                       ▼
        PostgreSQL 17            Arquivos (fotos, PDFs)
```

**Por que essa escolha**

| Necessidade | Escolha | Motivo |
|---|---|---|
| Front-end responsivo + back-end seguro | Next.js 16 (App Router) | Um único projeto; o código de servidor nunca vai para o navegador; Server Actions já trazem proteção contra CSRF (checagem de origem). |
| Banco estruturado | PostgreSQL + Drizzle ORM | Relacional, transações (impede agendamentos duplicados), barato e disponível em qualquer provedor. |
| Desenvolvimento sem instalar nada | PGlite (PostgreSQL embutido) | `npm run setup` cria o banco local automaticamente; em produção troca-se por `DATABASE_URL`. |
| Autenticação | Própria, com sessões no banco | Senhas com scrypt (parâmetros OWASP), cookie `httpOnly`/`SameSite`, bloqueio por tentativas, links de uso único. Sem custo e sem enviar dados de saúde a terceiros. |
| Validação | Zod no servidor + atributos HTML no cliente | Toda entrada é revalidada no servidor, mesmo que o navegador seja contornado. |
| Gráficos e PDF | SVG gerado no servidor; impressão do navegador | Sem bibliotecas pesadas; “Imprimir / salvar PDF” funciona em qualquer aparelho. |

**Sobre a especificação da plataforma (Supabase, Tailwind):** a especificação sugeria Supabase e Tailwind. Mantivemos a base já construída (Next.js + PostgreSQL + CSS próprio), que entrega o mesmo resultado sem refazer o site: o PostgreSQL é o mesmo banco usado pelo Supabase, e o isolamento entre pacientes que o Supabase faria com RLS é garantido na camada de servidor — toda consulta do paciente usa o `patientId` da sessão, nunca um valor vindo do navegador, e há testes de ponta a ponta que tentam abrir dados de outro paciente. Se no futuro o André quiser o Supabase, o esquema migra diretamente e as políticas RLS podem ser adicionadas como segunda camada.

Organização do código:

```
src/
  app/(site)        site público e agendamento
  app/(auth)        login, recuperação e definição de senha
  app/paciente      área do paciente
  app/admin         painel do nutricionista e da equipe
  app/api           saúde do sistema e tarefas agendadas
  app/arquivos      entrega protegida de arquivos
  actions/          Server Actions (gravações) — sempre checam permissão
  lib/              regras de negócio, autenticação, agenda, auditoria
  lib/nutricao      cálculos puros (porções, IMC, TMB/GET, macros, água, substituições), com testes
  components/nutri  editor e app do paciente: Hoje, Plano, calculadoras, barras de macros
  components/       componentes de interface reutilizáveis
  db/               esquema, migrações e dados fictícios
```

## 2. Mapa do site

**Público**
- `/` — abertura em storytelling, apresentação, especialidades, método, serviços e valores, como funciona, depoimentos autorizados, perguntas frequentes, contato (endereço, horários, modalidades, WhatsApp, redes sociais, formulário)
- `/agendar` — agendamento em 5 passos (serviço → modalidade → data → horário → dados)
- `/agendar/confirmado` — confirmação com código
- `/privacidade` — política de privacidade e tratamento de dados
- `/login`, `/recuperar-senha`, `/redefinir-senha` — acesso e primeiro acesso

**Área do paciente** (`/paciente`)
- Início: próxima consulta, plano atual, metas, evolução do peso, orientações, pendências, atalhos e avisos
- Plano alimentar (por refeição e horário, substituições, orientações, validade, versões anteriores, impressão/PDF)
- Diário alimentar (alimentos, horário, quantidade, foto opcional, fome/saciedade, adesão)
- Evolução (gráficos com data, metas, comparação entre avaliações, medidas informadas em casa)
- Mensagens (dúvidas, orientações destacadas, histórico)
- Formulários (anamnese, questionários, termos)
- Consultas (próximas, histórico, cancelamento com 24 h)
- Meus dados (cadastro, senha, documentos compartilhados, exportação, solicitações LGPD, consentimentos)

**Painel** (`/admin`)
- Início (indicadores do dia, pendências, retornos vencidos, formulários perto do prazo, mensagens, financeiro)
- Agenda (dia, semana, mês, lista; confirmar, cancelar, remarcar, bloquear horários, nova consulta, link de vídeo)
- Pacientes (busca e filtros por situação/etapa) e prontuário com abas: resumo e acesso, consultas, avaliações e evolução, planos, diário, anamnese e formulários, metas, notas clínicas privadas, documentos, mensagens, financeiro
- Planos alimentares (rascunhos, publicados, modelos; editor com histórico de versões)
- Formulários (construtor de modelos)
- Financeiro (lançamentos, pendências, descontos, pacotes, receita mensal) — módulo opcional
- Relatórios (atendimentos, faltas e cancelamentos, pacientes, evolução, receitas, pendências; exportação CSV)
- Interessados (contatos do site)
- Configurações (perfil, identidade visual, serviços e valores, horários e regras, mensagens, depoimentos e FAQ, equipe e permissões, integrações)
- Privacidade e auditoria (solicitações LGPD, anonimização, trilha de atividades)

## 3. Recursos do MVP e prioridades

| Prioridade | Recurso | Situação nesta versão |
|---|---|---|
| P0 | Autenticação, perfis e isolamento de dados | Implementado |
| P0 | Site público + agendamento sem conflitos | Implementado |
| P0 | Cadastro de pacientes e prontuário | Implementado |
| P0 | Editor de plano alimentar com revisão e publicação | Implementado |
| P1 | Área do paciente (plano, diário, evolução, mensagens, formulários) | Implementado |
| P1 | Avaliações, metas e gráficos | Implementado |
| P1 | LGPD: consentimentos, exportação, solicitações, anonimização, auditoria | Implementado |
| P2 | Financeiro (registros internos) e relatórios | Implementado |
| P2 | E-mails e lembretes automáticos | Implementado; **ativo só após configurar o Resend e a tarefa agendada** |
| P3 | WhatsApp automático, pagamento on-line, videochamada integrada | **Não implementado** — o sistema mostra como “não configurado” e oferece alternativa manual (link wa.me, registro interno, link da sala colado na consulta) |

## 4. Estrutura do banco de dados

Tabelas principais (detalhes em `src/db/schema.ts`):

| Grupo | Tabelas |
|---|---|
| Acesso | `users` (perfil admin/staff/patient, permissões da equipe), `sessions` (hash do token), `auth_tokens` (redefinição e convites, hash + validade + uso único) |
| Consultório | `settings` (registro único: perfil, identidade, regras de agenda, modelos de mensagem), `services`, `working_hours`, `time_blocks`, `packages`, `testimonials` (com data de autorização), `faqs`, `leads` |
| Atendimento | `patients`, `appointments` (snapshot de serviço/valor; status pendente → confirmada → realizada/faltou/cancelada), `measurements` (origem: profissional ou paciente), `goals`, `meal_plans` (JSON validado, versão, status rascunho/publicado/arquivado, autor da publicação), `diary_entries`, `messages`, `notifications`, `form_templates`, `form_assignments` (cópia dos campos + respostas), `clinical_notes` (privadas), `files` |
| Financeiro | `payments` (origem `manual` = registro interno × `provedor` = confirmado por gateway) |
| LGPD | `consents` (tipo + versão da política + data), `data_requests`, `audit_logs` |

Decisões importantes:
- Plano publicado é **imutável**: alterações geram nova versão; a anterior vai para o histórico.
- Formulário enviado guarda **cópia das perguntas**: editar o modelo não altera respostas antigas.
- Consulta guarda nome/valor do serviço do momento: mudar preços não reescreve o histórico.
- Medidas informadas pelo paciente ficam marcadas e aparecem com marcador diferente nos gráficos.

## 5. Fluxos de usuário

**Visitante → paciente**
1. Visitante agenda pelo site (consentimento registrado) → consulta fica *pendente* e o horário é reservado.
2. Equipe confirma no painel (paciente recebe aviso; e-mail se configurado; botão de WhatsApp com texto pronto).
3. Na consulta, o nutricionista vincula/cria o cadastro, registra a avaliação e envia a anamnese.
4. Libera o acesso: o sistema gera um link de primeiro acesso (7 dias, uso único); o paciente cria a própria senha.

**Plano alimentar**
1. Nutricionista cria rascunho (em branco, de modelo ou de versão anterior) → edita refeições, alimentos, medidas caseiras, substituições e orientações.
2. Publica marcando “Revisei e aprovo este plano” → versão anterior vai para o histórico → paciente é avisado.
3. Ajustes futuros: “Criar nova versão”.

**Acompanhamento**
Paciente registra diário e medidas, responde formulários e envia dúvidas → equipe vê no prontuário, comenta o diário, responde mensagens e ajusta metas → painel aponta retornos vencidos e prazos.

## 6. Funcionalidades futuras (já previstas na arquitetura)

- **App instalável (PWA):** já existe `manifest` com início em `/paciente`; falta service worker para uso off-line e notificações push.
- **Videoconferência:** campo `meetingUrl` na consulta; integração futura pode gerar a sala automaticamente (Google Meet/Zoom API).
- **Pagamentos on-line:** `payments.source = 'provedor'`, `provider`, `providerRef` já existem; falta o webhook do gateway (Mercado Pago, Asaas, Stripe).
- **E-mail/WhatsApp:** `lib/notify.ts` concentra os envios; acrescentar WhatsApp Business API como novo canal.
- **Dispositivos de atividade física:** nova tabela de métricas importadas com `source = 'dispositivo'`, nunca exibidas como medição profissional.
- **Múltiplos nutricionistas (plataforma):** adicionar `professional_id` (tenant) às tabelas e trocar o registro único de `settings` por um por profissional.
- **Assistente de IA:** somente para resumir registros e organizar informações para o nutricionista, com dados minimizados/pseudonimizados, contrato de operador compatível com a LGPD, registro na auditoria e **revisão obrigatória** — nunca diagnostica, nunca publica plano ou orientação sozinho (o fluxo de publicação já exige confirmação humana).
