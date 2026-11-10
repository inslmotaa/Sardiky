# Entrega das Partes 1 a 8

Resumo para publicar a versão atual: arquivos alterados em cada parte, migrações e o que rodar no servidor, variáveis novas do `.env` e o que ficou pendente. A lista completa de arquivos está no fim do documento.

## 1. Arquivos alterados por parte

| Parte | O que mudou | Novos | Alterados | Removidos | Principais arquivos |
|---|---|---|---|---|---|
| 1 | CRN e registro profissional removidos de banco, telas, PDFs e docs | 3 | 35 | 0 | `drizzle/0018_remover_registro.sql`, `src/lib/plan-pdf.ts`, `src/lib/anamnese-pdf.ts`, `src/app/admin/configuracoes/page.tsx`, `scripts/aplicar-perfil.mjs` |
| 2 | Textos de exemplo, números da seção Resultados, Sobre com formações, depoimentos com autorização, modo escuro | 15 | 28 | 0 | `drizzle/0019_depoimentos_e_formacoes.sql`, `src/app/(site)/page.tsx`, `src/app/(site)/sobre/page.tsx`, `src/lib/depoimentos.ts`, `src/actions/admin/testimonials.ts`, `src/app/dark-theme.css` |
| 3 | Sitemap, robots, Open Graph, JSON-LD, Conteúdos (blog), "Quero saber mais" com UTM, pixels com consentimento | 28 | 34 | 0 | `drizzle/0020_conteudos_e_captacao.sql`, `src/lib/seo.ts`, `src/lib/jsonld.ts`, `src/lib/pixels.ts`, `src/app/(site)/conteudos/`, `src/app/admin/conteudos/` |
| 4 | Check-ins, vitaminas e minerais, código de barras, diário de dias passados, vencimento e renovação, recibo, link mágico | 22 | 65 | 0 | `drizzle/0021_app_do_cliente_e_painel.sql`, `src/lib/checkins.ts`, `src/lib/pagamentos.ts`, `src/lib/openfoodfacts.ts`, `src/app/paciente/checkin/` |
| 5 | Conversa pelo app ou WhatsApp, lembretes no calendário (.ics), resumo diário por e-mail dentro da cota grátis | 21 | 26 | 0 | `drizzle/0022_whatsapp_e_lembretes.sql`, `src/lib/whatsapp.ts`, `src/lib/lembretes-ics.ts`, `src/lib/email-cota.ts`, `src/lib/email-quota.ts` |
| 6 | Lighthouse ≥ 90, e2e de qualidade, checklist manual | 6 | 19 | 0 | `scripts/lighthouse.mjs`, `tests/e2e/qualidade.spec.ts`, `src/app/layout.tsx` (fontes), `docs/19-qualidade.md` |
| 7 | Meu corpo, fotos do corpo e do prato, linha do tempo de evolução e relatório em PDF | 22 | 37 | 0 | `drizzle/0023_fotos_e_perfil_fisico.sql`, `src/lib/corpo-server.ts`, `src/lib/image-meta.ts`, `src/app/paciente/meu-corpo/`, `src/lib/zip.ts` |
| 8 | Uma única seção de planos (`/#planos`) e fim das consultas avulsas | 8 | 93 | 15 | `drizzle/0024_sem_consultas_nas_notificacoes.sql`, `src/components/SiteBlocks.tsx`, `next.config.ts`, `src/app/admin/page.tsx`, `src/app/paciente/depoimento/page.tsx`, `tests/e2e/planos-sem-consultas.spec.ts` |

A Parte 8 inclui a correção "uma única seção de planos". Os arquivos removidos nela são a agenda, o agendamento e as telas de consulta: `src/lib/booking.ts`, `src/lib/scheduling.ts`, `src/lib/feriados.ts`, `src/actions/admin/appointments.ts`, `src/app/admin/agenda/`, `src/app/paciente/consultas/`, `src/app/(site)/agendar/`, `src/app/(site)/planos/`, `src/components/BookingLink.tsx` e os testes deles.

## 2. Migrações novas e o que rodar no servidor

| Migração | Parte | O que faz | Apaga dados? |
|---|---|---|---|
| `0018_remover_registro.sql` | 1 | Remove a coluna `settings.registry` (o antigo CRN). | Sim, só essa coluna. |
| `0019_depoimentos_e_formacoes.sql` | 2 | Tabela `testimonials`; coluna `settings.credentials` (formações). | Não |
| `0020_conteudos_e_captacao.sql` | 3 | Tabela `posts`; UTM e origem em `leads`; `meta_pixel_id`, `google_tag_id` e `pixels_enabled` em `settings`. | Não |
| `0021_app_do_cliente_e_painel.sql` | 4 | Tabela `checkins`; código de barras em `foods`; check-in e assinatura em `patients`; número do recibo em `payments`; tipo de token `link_magico`. | Não |
| `0022_whatsapp_e_lembretes.sql` | 5 | Tabelas `contact_events`, `email_log` e `reminder_channels`; `chat_mode` em `settings` e `patients`; novo padrão de `notification_prefs`. | Não |
| `0023_fotos_e_perfil_fisico.sql` | 7 | Tabelas `height_logs` e `photo_sets`; `professional_reaction` em `diary_entries`. | Não |
| `0024_sem_consultas_nas_notificacoes.sql` | 8 | Tira "consultas" do valor padrão de `notification_prefs`. | Não |

Nenhuma migração apaga as tabelas de consultas (`appointments`, `services`, `working_hours`, `time_blocks`). Os dados antigos continuam no banco e saem na exportação de dados do cliente (LGPD).

**No servidor (Docker, como em [09-lancamento.md](09-lancamento.md)):**

```bash
# 1. Cópia do banco antes de atualizar (a 0018 remove uma coluna)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T db pg_dump -U nutri -d nutri -Fc > antes-da-atualizacao.dump

# 2. Código novo (git pull ou a pasta "projeto" do zip) e, se quiser, as variáveis novas do item 3 em deploy/.env

# 3. Subir de novo: o app aplica as migrações pendentes sozinho ao iniciar (scripts/migrate.mjs)
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

# 4. Conferir que subiu
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs app --tail 30
```

Em instalação nova, nada muda: o mesmo `up -d --build` aplica todas as migrações. Para quem cria o banco direto pelo SQL, `deploy/banco-de-dados.sql` já está na versão 0024.

Para atualizar o perfil do André, `scripts/aplicar-perfil.mjs` não aceita mais `servicos`, `site.agendamento` nem horários de atendimento. Use `deploy/perfil.exemplo.json` como modelo e rode `--conferir` antes.

## 3. Variáveis novas do `.env`

Só duas variáveis são novas, ambas opcionais:

| Variável | Para que serve | Se ficar vazia |
|---|---|---|
| `EMAIL_DAILY_LIMIT` | Máximo de e-mails por dia | Vale 100, o limite do plano grátis do Resend. Os e-mails essenciais (senha, confirmação, link de acesso, vencimento) reservam 40 por dia; o resumo diário usa só o que sobra. |
| `EMAIL_MONTHLY_LIMIT` | Máximo de e-mails por mês | Vale 3.000, o limite do plano grátis do Resend. Perto do fim, o resumo diário para antes dos essenciais. |

Só faz sentido preenchê-las se o André contratar um plano maior no Resend. Elas estão em `.env.example`, no `deploy/.env` criado por `scripts/gerar-segredos.mjs` e no `docker-compose.yml`.

**Pixels não são variáveis do `.env`.** O ID do Pixel da Meta, o ID do Google (GA4 ou Google Ads) e a chave que liga os pixels ficam no painel, em Configurações → Captação e pixels, e são gravados no banco. Vazios ou desligados (o padrão), o site não carrega nenhum script de terceiros nem mostra o aviso de cookies. Ligados, o aviso aparece e nada é carregado antes do "Aceitar".

**Nenhuma das novidades exige serviço pago:**

- **E-mail:** plano grátis do Resend, com a cota respeitada pelo próprio sistema. Sem `RESEND_API_KEY`, nenhum e-mail sai e o painel mostra a integração como "não configurada".
- **Pixels da Meta e do Google:** gratuitos e opcionais.
- **Open Food Facts (código de barras):** gratuito, sem chave nem cadastro.
- **Lembretes no calendário (.ics):** gerados pelo próprio sistema.
- **Notificações push:** usam as chaves VAPID que o próprio sistema gera.
- **Conversa pelo WhatsApp:** abre um link `wa.me`, sem API paga.
- **Mercado Pago:** já existia antes da Parte 1. Não tem mensalidade, só a tarifa por venda; vazio, o botão vira "Falar no WhatsApp".

## 4. O que ficou pendente e por quê

1. **Checklist manual de [09-lancamento.md](09-lancamento.md#qualidade-antes-de-publicar-parte-6).** Precisa de aparelhos e contas reais, que o ambiente de testes não tem:
   - celulares Android e iPhone (iOS 16.4+ para o push);
   - assinatura do calendário no Google e no iPhone;
   - prévia do link no WhatsApp;
   - compra de teste no Mercado Pago com credenciais de teste.
2. **Dados reais do André.** O `scripts/aplicar-perfil.mjs --conferir` recusa o perfil enquanto houver campos de exemplo. Faltam:
   - biografia, Instagram e e-mails;
   - fotos e preços;
   - o domínio.
3. **Credenciais.** Ninguém além do André pode criá-las:
   - `RESEND_API_KEY`;
   - `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`;
   - opcionalmente o login com Google e os IDs dos pixels.
4. **Tabelas antigas de consultas.** Continuam no banco, sem uso, porque a Parte 8 pediu migração não destrutiva e a exportação LGPD ainda mostra o histórico. Uma limpeza futura só deve vir depois de decidir quanto tempo guardar esse histórico.
5. **`index.html` na raiz do repositório.** É de outro site ("Fonseca Team") e não foi alterado. A prévia deste projeto está em `previa/index.html` e na raiz do zip de entrega.
6. **Pull request.** O código está no branch `claude/wizardly-darwin-nv38en`; o pull request só será aberto quando for pedido.
7. **Nota de desempenho no Lighthouse.** Varia de 1 a 3 pontos entre medições, porque é uma simulação. A última ficou entre 92 e 95, com acessibilidade 100 ([19-qualidade.md](19-qualidade.md)).

## Lista completa de arquivos por parte

Caminhos relativos à pasta do projeto.

### Parte 1: CRN e registro profissional removidos

38 arquivos: 3 novos, 35 alterados, 0 removidos.


**(raiz)**

- `PROMPT-HERO-STORYTELLING.md` (alterado)
- `PROMPT-SITE-VERDE-BRANCO.md` (alterado)
- `README.md` (alterado)

**deploy**

- `deploy/banco-de-dados.sql` (alterado)

**docs**

- `docs/02-seguranca-lgpd.md` (alterado)
- `docs/03-publicacao.md` (alterado)
- `docs/04-testes.md` (alterado)
- `docs/05-proximos-passos.md` (alterado)
- `docs/06-fase-1.md` (alterado)
- `docs/07-fase-2.md` (alterado)
- `docs/08-fase-3.md` (alterado)
- `docs/09-lancamento.md` (alterado)
- `docs/10-manual-do-andre.md` (alterado)
- `docs/11-site-contas-anamnese.md` (alterado)
- `docs/13-banco-de-dados.md` (alterado)

**drizzle**

- `drizzle/0018_remover_registro.sql` (novo)
- `drizzle/meta/0018_snapshot.json` (novo)
- `drizzle/meta/_journal.json` (alterado)

**previa**

- `previa/index.html` (alterado)

**scripts**

- `scripts/aplicar-perfil.mjs` (alterado)

**src/actions**

- `src/actions/admin/settings.ts` (alterado)

**src/app**

- `src/app/(site)/layout.tsx` (alterado)
- `src/app/(site)/page.tsx` (alterado)
- `src/app/(site)/privacidade/page.tsx` (alterado)
- `src/app/admin/configuracoes/page.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/evolution.tsx` (alterado)
- `src/app/admin/pacientes/[id]/anamnese/pdf/route.ts` (alterado)
- `src/app/admin/planos/[id]/page.tsx` (alterado)
- `src/app/admin/planos/[id]/pdf/route.ts` (alterado)
- `src/app/paciente/meus-dados/page.tsx` (alterado)
- `src/app/paciente/plano/pdf/route.ts` (alterado)

**src/db**

- `src/db/schema.ts` (alterado)
- `src/db/seed.ts` (alterado)

**src/lib**

- `src/lib/anamnese-pdf.ts` (alterado)
- `src/lib/plan-pdf.ts` (alterado)

**tests/e2e**

- `tests/e2e/coach-sem-registro.spec.ts` (novo)
- `tests/e2e/helpers.ts` (alterado)

**tests/unit**

- `tests/unit/lancamento.test.ts` (alterado)

### Parte 2: Conteúdo e acabamento do site

43 arquivos: 15 novos, 28 alterados, 0 removidos.


**(raiz)**

- `README.md` (alterado)

**deploy**

- `deploy/banco-de-dados.sql` (alterado)

**docs**

- `docs/04-testes.md` (alterado)
- `docs/09-lancamento.md` (alterado)
- `docs/10-manual-do-andre.md` (alterado)
- `docs/13-banco-de-dados.md` (alterado)
- `docs/15-conteudo-e-acabamento.md` (novo)

**drizzle**

- `drizzle/0019_depoimentos_e_formacoes.sql` (novo)
- `drizzle/meta/0019_snapshot.json` (novo)
- `drizzle/meta/_journal.json` (alterado)

**previa**

- `previa/index.html` (alterado)

**scripts**

- `scripts/aplicar-perfil.mjs` (alterado)
- `scripts/pendencias.d.mts` (novo)
- `scripts/pendencias.mjs` (novo)

**src/actions**

- `src/actions/admin/lgpd.ts` (alterado)
- `src/actions/admin/settings.ts` (alterado)
- `src/actions/admin/testimonials.ts` (novo)
- `src/actions/patient.ts` (alterado)

**src/app**

- `src/app/(site)/page.tsx` (alterado)
- `src/app/(site)/privacidade/page.tsx` (alterado)
- `src/app/(site)/site.css` (alterado)
- `src/app/(site)/sobre/page.tsx` (alterado)
- `src/app/admin/configuracoes/page.tsx` (alterado)
- `src/app/admin/page.tsx` (alterado)
- `src/app/app-theme.css` (alterado)
- `src/app/dark-theme.css` (novo)
- `src/app/globals.css` (alterado)
- `src/app/layout.tsx` (alterado)
- `src/app/paciente/consultas/page.tsx` (alterado)
- `src/app/paciente/mais/page.tsx` (alterado)
- `src/app/paciente/meus-dados/exportar/route.ts` (alterado)
- `src/app/paciente/meus-dados/page.tsx` (alterado)

**src/db**

- `src/db/schema.ts` (alterado)

**src/lib**

- `src/lib/depoimentos.ts` (novo)
- `src/lib/formacoes.ts` (novo)
- `src/lib/site-fx.ts` (alterado)
- `src/lib/tema.ts` (novo)

**tests/e2e**

- `tests/e2e/conteudo-site.spec.ts` (novo)
- `tests/e2e/public.spec.ts` (alterado)

**tests/unit**

- `tests/unit/contraste.test.ts` (novo)
- `tests/unit/depoimentos.test.ts` (novo)
- `tests/unit/formacoes.test.ts` (novo)
- `tests/unit/pendencias.test.ts` (novo)

### Parte 3: SEO, Conteúdos (blog) e captação

62 arquivos: 28 novos, 34 alterados, 0 removidos.


**(raiz)**

- `README.md` (alterado)
- `next.config.ts` (alterado)

**deploy**

- `deploy/banco-de-dados.sql` (alterado)

**docs**

- `docs/04-testes.md` (alterado)
- `docs/09-lancamento.md` (alterado)
- `docs/10-manual-do-andre.md` (alterado)
- `docs/16-seo-e-captacao.md` (novo)

**drizzle**

- `drizzle/0020_conteudos_e_captacao.sql` (novo)
- `drizzle/meta/0020_snapshot.json` (novo)
- `drizzle/meta/_journal.json` (alterado)

**previa**

- `previa/index.html` (alterado)

**scripts**

- `scripts/gerar-previa.py` (alterado)

**src/actions**

- `src/actions/admin/posts.ts` (novo)
- `src/actions/admin/settings.ts` (alterado)
- `src/actions/public.ts` (alterado)

**src/app**

- `src/app/(auth)/criar-conta/confirme/page.tsx` (alterado)
- `src/app/(auth)/layout.tsx` (alterado)
- `src/app/(auth)/login/page.tsx` (alterado)
- `src/app/(auth)/recuperar-senha/page.tsx` (alterado)
- `src/app/(auth)/redefinir-senha/page.tsx` (alterado)
- `src/app/(site)/agendar/confirmado/page.tsx` (alterado)
- `src/app/(site)/agendar/page.tsx` (alterado)
- `src/app/(site)/como-funciona/page.tsx` (alterado)
- `src/app/(site)/conteudos/[slug]/page.tsx` (novo)
- `src/app/(site)/conteudos/page.tsx` (novo)
- `src/app/(site)/duvidas/page.tsx` (alterado)
- `src/app/(site)/layout.tsx` (alterado)
- `src/app/(site)/page.tsx` (alterado)
- `src/app/(site)/planos/page.tsx` (alterado)
- `src/app/(site)/privacidade/page.tsx` (alterado)
- `src/app/(site)/site.css` (alterado)
- `src/app/(site)/sobre/page.tsx` (alterado)
- `src/app/admin/configuracoes/page.tsx` (alterado)
- `src/app/admin/conteudos/[id]/page.tsx` (novo)
- `src/app/admin/conteudos/page.tsx` (novo)
- `src/app/admin/interessados/page.tsx` (alterado)
- `src/app/admin/layout.tsx` (alterado)
- `src/app/layout.tsx` (alterado)
- `src/app/opengraph-image.tsx` (novo)
- `src/app/paciente/layout.tsx` (alterado)
- `src/app/robots.ts` (novo)
- `src/app/sitemap.ts` (novo)
- `src/app/twitter-image.tsx` (novo)

**src/components**

- `src/components/Captacao.tsx` (novo)
- `src/components/JsonLd.tsx` (novo)
- `src/components/Markdown.tsx` (novo)
- `src/components/Pixels.tsx` (novo)
- `src/components/PostCta.tsx` (novo)

**src/db**

- `src/db/schema.ts` (alterado)
- `src/db/seed.ts` (alterado)

**src/lib**

- `src/lib/constants.ts` (alterado)
- `src/lib/conteudos.ts` (novo)
- `src/lib/jsonld.ts` (novo)
- `src/lib/markdown.ts` (novo)
- `src/lib/og.tsx` (novo)
- `src/lib/pixels.ts` (novo)
- `src/lib/posts.ts` (novo)
- `src/lib/seo-server.ts` (novo)
- `src/lib/seo.ts` (novo)
- `src/lib/utm.ts` (novo)

**tests/e2e**

- `tests/e2e/seo-captacao.spec.ts` (novo)

**tests/unit**

- `tests/unit/seo-captacao.test.ts` (novo)

### Parte 4: App do cliente e painel

87 arquivos: 22 novos, 65 alterados, 0 removidos.


**(raiz)**

- `README.md` (alterado)
- `playwright.config.ts` (alterado)

**deploy**

- `deploy/alimentos.sql` (alterado)
- `deploy/banco-de-dados.sql` (alterado)
- `deploy/criar-admin.sql` (alterado)

**docs**

- `docs/04-testes.md` (alterado)
- `docs/09-lancamento.md` (alterado)
- `docs/10-manual-do-andre.md` (alterado)
- `docs/17-app-e-painel.md` (novo)

**drizzle**

- `drizzle/0021_app_do_cliente_e_painel.sql` (novo)
- `drizzle/meta/0021_snapshot.json` (novo)
- `drizzle/meta/_journal.json` (alterado)

**previa**

- `previa/index.html` (alterado)

**scripts**

- `scripts/create-admin.mjs` (alterado)

**src/actions**

- `src/actions/admin/lgpd.ts` (alterado)
- `src/actions/admin/nutrition.ts` (alterado)
- `src/actions/admin/settings.ts` (alterado)
- `src/actions/auth.ts` (alterado)
- `src/actions/checkins.ts` (novo)
- `src/actions/pagamento.ts` (alterado)
- `src/actions/patient.ts` (alterado)

**src/app**

- `src/app/(auth)/login/link/page.tsx` (novo)
- `src/app/(auth)/login/page.tsx` (alterado)
- `src/app/admin/acompanhamento/page.tsx` (alterado)
- `src/app/admin/agenda/[id]/page.tsx` (alterado)
- `src/app/admin/alimentos/page.tsx` (alterado)
- `src/app/admin/configuracoes/page.tsx` (alterado)
- `src/app/admin/interessados/page.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/checkins.tsx` (novo)
- `src/app/admin/pacientes/[id]/_tabs/diary.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/finance.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/summary.tsx` (alterado)
- `src/app/admin/pacientes/[id]/page.tsx` (alterado)
- `src/app/admin/page.tsx` (alterado)
- `src/app/admin/planos/[id]/page.tsx` (alterado)
- `src/app/admin/privacidade/page.tsx` (alterado)
- `src/app/api/cron/route.ts` (alterado)
- `src/app/api/webhooks/mercadopago/route.ts` (alterado)
- `src/app/app-theme.css` (alterado)
- `src/app/arquivos/[id]/route.ts` (alterado)
- `src/app/paciente/checkin/page.tsx` (novo)
- `src/app/paciente/diario/page.tsx` (alterado)
- `src/app/paciente/encerrado/page.tsx` (novo)
- `src/app/paciente/layout.tsx` (alterado)
- `src/app/paciente/mais/page.tsx` (alterado)
- `src/app/paciente/meus-dados/exportar/route.ts` (alterado)
- `src/app/paciente/meus-dados/page.tsx` (alterado)
- `src/app/paciente/pagamento/page.tsx` (alterado)
- `src/app/paciente/pagamento/retorno/page.tsx` (alterado)
- `src/app/paciente/page.tsx` (alterado)
- `src/app/paciente/plano/[id]/page.tsx` (alterado)
- `src/app/paciente/plano/page.tsx` (alterado)
- `src/app/recibos/[id]/route.ts` (novo)

**src/components**

- `src/components/PatientPlanPage.tsx` (alterado)
- `src/components/PaymentLinkTool.tsx` (alterado)
- `src/components/PaymentsTable.tsx` (alterado)
- `src/components/PlanEditor.tsx` (alterado)
- `src/components/WhatsAppButton.tsx` (novo)
- `src/components/nutri/DiaryDay.tsx` (alterado)
- `src/components/nutri/FoodCreateForm.tsx` (novo)
- `src/components/nutri/MicrosPanel.tsx` (novo)
- `src/components/nutri/PatientPlan.tsx` (alterado)

**src/db**

- `src/db/migrate.ts` (alterado)
- `src/db/schema.ts` (alterado)
- `src/db/seed.ts` (alterado)

**src/lib**

- `src/lib/auth/patient-gate.ts` (alterado)
- `src/lib/checkin-rules.ts` (novo)
- `src/lib/checkins.ts` (novo)
- `src/lib/constants.ts` (alterado)
- `src/lib/extenso.ts` (novo)
- `src/lib/foods.ts` (alterado)
- `src/lib/lgpd-export.ts` (novo)
- `src/lib/mercadopago-core.ts` (alterado)
- `src/lib/mercadopago.ts` (alterado)
- `src/lib/notify.ts` (alterado)
- `src/lib/nutricao/index.ts` (alterado)
- `src/lib/openfoodfacts.ts` (novo)
- `src/lib/pagamentos.ts` (alterado)
- `src/lib/recibo-pdf.ts` (novo)
- `src/lib/renovacao.ts` (novo)
- `src/lib/storage.ts` (alterado)
- `src/lib/tabela-nutricional.ts` (alterado)
- `src/lib/whatsapp.ts` (novo)

**tests/e2e**

- `tests/e2e/alimentos.spec.ts` (alterado)
- `tests/e2e/mp-falso.mjs` (alterado)
- `tests/e2e/parte4.spec.ts` (novo)

**tests/unit**

- `tests/unit/parte4.test.ts` (novo)

### Parte 5: WhatsApp e lembretes gratuitos

47 arquivos: 21 novos, 26 alterados, 0 removidos.


**(raiz)**

- `README.md` (alterado)
- `playwright.config.ts` (alterado)

**deploy**

- `deploy/banco-de-dados.sql` (alterado)

**docs**

- `docs/04-testes.md` (alterado)
- `docs/10-manual-do-andre.md` (alterado)
- `docs/18-whatsapp-e-lembretes.md` (novo)

**drizzle**

- `drizzle/0022_whatsapp_e_lembretes.sql` (novo)
- `drizzle/meta/0022_snapshot.json` (novo)
- `drizzle/meta/_journal.json` (alterado)

**previa**

- `previa/index.html` (alterado)

**src/actions**

- `src/actions/admin/nutrition.ts` (alterado)
- `src/actions/admin/settings.ts` (alterado)
- `src/actions/lembretes.ts` (novo)
- `src/actions/push.ts` (alterado)

**src/app**

- `src/app/admin/configuracoes/page.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/messages.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/summary.tsx` (alterado)
- `src/app/admin/page.tsx` (alterado)
- `src/app/api/cron/route.ts` (alterado)
- `src/app/app-theme.css` (alterado)
- `src/app/descadastrar/[token]/route.ts` (novo)
- `src/app/descadastrar/ok/page.tsx` (novo)
- `src/app/lembretes/[token]/route.ts` (novo)
- `src/app/paciente/layout.tsx` (alterado)
- `src/app/paciente/lembretes.ics/route.ts` (novo)
- `src/app/paciente/mais/page.tsx` (alterado)
- `src/app/paciente/mensagens/page.tsx` (alterado)
- `src/app/paciente/notificacoes/page.tsx` (alterado)
- `src/app/paciente/page.tsx` (alterado)
- `src/app/paciente/whatsapp/route.ts` (novo)

**src/components**

- `src/components/CalendarLinkTool.tsx` (novo)
- `src/components/ContactOptions.tsx` (novo)

**src/db**

- `src/db/schema.ts` (alterado)

**src/lib**

- `src/lib/chat-mode.ts` (novo)
- `src/lib/contact-options.ts` (novo)
- `src/lib/email-cota.ts` (novo)
- `src/lib/email-quota.ts` (novo)
- `src/lib/lembretes-ics.ts` (novo)
- `src/lib/lembretes.ts` (novo)
- `src/lib/notify.ts` (alterado)
- `src/lib/push.ts` (alterado)
- `src/lib/quiet.ts` (novo)
- `src/lib/reminders.ts` (alterado)
- `src/lib/resumo-email.ts` (novo)
- `src/lib/seo.ts` (alterado)

**tests/e2e**

- `tests/e2e/parte5.spec.ts` (novo)

**tests/unit**

- `tests/unit/parte5.test.ts` (novo)

### Parte 6: Qualidade (Lighthouse, e2e, checklist)

25 arquivos: 6 novos, 19 alterados, 0 removidos.


**(raiz)**

- `.gitignore` (alterado)
- `README.md` (alterado)
- `package-lock.json` (alterado)
- `package.json` (alterado)

**docs**

- `docs/04-testes.md` (alterado)
- `docs/09-lancamento.md` (alterado)
- `docs/19-qualidade.md` (novo)

**previa**

- `previa/index.html` (alterado)

**scripts**

- `scripts/fonte-archivo.py` (novo)
- `scripts/gerar-previa.py` (alterado)
- `scripts/lighthouse.mjs` (novo)

**src/app**

- `src/app/(site)/planos/page.tsx` (alterado)
- `src/app/(site)/site.css` (alterado)
- `src/app/fonts.ts` (novo)
- `src/app/fonts/archivo-latin-wght400-800-wdth100-125.woff2` (novo)
- `src/app/globals.css` (alterado)
- `src/app/layout.tsx` (alterado)

**src/components**

- `src/components/motion.tsx` (alterado)
- `src/components/nutri/DiaryDay.tsx` (alterado)
- `src/components/nutri/PatientPlan.tsx` (alterado)

**src/lib**

- `src/lib/checkins.ts` (alterado)
- `src/lib/email-quota.ts` (alterado)
- `src/lib/notify.ts` (alterado)
- `src/lib/site-fx.ts` (alterado)

**tests/e2e**

- `tests/e2e/qualidade.spec.ts` (novo)

### Parte 7: Meu corpo, fotos e evolução

59 arquivos: 22 novos, 37 alterados, 0 removidos.


**(raiz)**

- `README.md` (alterado)
- `next.config.ts` (alterado)

**deploy**

- `deploy/banco-de-dados.sql` (alterado)

**docs**

- `docs/04-testes.md` (alterado)
- `docs/10-manual-do-andre.md` (alterado)
- `docs/20-corpo-e-fotos.md` (novo)

**drizzle**

- `drizzle/0023_fotos_e_perfil_fisico.sql` (novo)
- `drizzle/meta/0023_snapshot.json` (novo)
- `drizzle/meta/_journal.json` (alterado)

**src/actions**

- `src/actions/admin/corpo.ts` (novo)
- `src/actions/admin/patients.ts` (alterado)
- `src/actions/anamnese.ts` (alterado)
- `src/actions/checkins.ts` (alterado)
- `src/actions/corpo.ts` (novo)
- `src/actions/patient.ts` (alterado)

**src/app**

- `src/app/admin/acompanhamento/page.tsx` (alterado)
- `src/app/admin/configuracoes/page.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/diary.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/evolution.tsx` (alterado)
- `src/app/admin/pacientes/[id]/evolucao/pdf/route.ts` (novo)
- `src/app/admin/pacientes/[id]/page.tsx` (alterado)
- `src/app/globals.css` (alterado)
- `src/app/paciente/checkin/page.tsx` (alterado)
- `src/app/paciente/enviar/page.tsx` (alterado)
- `src/app/paciente/evolucao/page.tsx` (alterado)
- `src/app/paciente/evolucao/pdf/route.ts` (novo)
- `src/app/paciente/meu-corpo/fotos/page.tsx` (novo)
- `src/app/paciente/meu-corpo/page.tsx` (novo)
- `src/app/paciente/meus-dados/exportar/route.ts` (alterado)
- `src/app/paciente/meus-dados/page.tsx` (alterado)
- `src/app/paciente/page.tsx` (alterado)

**src/components**

- `src/components/BodyCard.tsx` (novo)
- `src/components/BodyPhotoCapture.tsx` (novo)
- `src/components/DiaryList.tsx` (alterado)
- `src/components/Evolution.tsx` (alterado)
- `src/components/EvolutionOverview.tsx` (novo)
- `src/components/form.tsx` (alterado)
- `src/components/nutri/DiaryDay.tsx` (alterado)
- `src/components/nutri/ProgressPhotos.tsx` (alterado)
- `src/components/nutri/TodayView.tsx` (alterado)

**src/db**

- `src/db/schema.ts` (alterado)

**src/lib**

- `src/lib/corpo-server.ts` (novo)
- `src/lib/corpo.ts` (novo)
- `src/lib/diary.ts` (alterado)
- `src/lib/evolucao-pdf.ts` (novo)
- `src/lib/evolucao.ts` (novo)
- `src/lib/image-compress.ts` (novo)
- `src/lib/image-meta.ts` (novo)
- `src/lib/lgpd-export.ts` (alterado)
- `src/lib/photos.ts` (alterado)
- `src/lib/reminders.ts` (alterado)
- `src/lib/storage-usage.ts` (novo)
- `src/lib/storage.ts` (alterado)
- `src/lib/zip.ts` (novo)

**tests/e2e**

- `tests/e2e/fase2.spec.ts` (alterado)
- `tests/e2e/nutricao.spec.ts` (alterado)
- `tests/e2e/parte4.spec.ts` (alterado)
- `tests/e2e/parte7.spec.ts` (novo)

**tests/unit**

- `tests/unit/parte7.test.ts` (novo)

### Parte 8: Planos numa única seção e sem consultas avulsas

116 arquivos: 8 novos, 93 alterados, 15 removidos.


**(raiz)**

- `.env.example` (alterado)
- `README.md` (alterado)
- `next.config.ts` (alterado)

**deploy**

- `deploy/banco-de-dados.sql` (alterado)
- `deploy/docker-compose.yml` (alterado)
- `deploy/perfil.exemplo.json` (alterado)

**docs**

- `docs/01-planejamento.md` (alterado)
- `docs/02-seguranca-lgpd.md` (alterado)
- `docs/04-testes.md` (alterado)
- `docs/07-fase-2.md` (alterado)
- `docs/08-fase-3.md` (alterado)
- `docs/09-lancamento.md` (alterado)
- `docs/10-manual-do-andre.md` (alterado)
- `docs/11-site-contas-anamnese.md` (alterado)
- `docs/16-seo-e-captacao.md` (alterado)
- `docs/18-whatsapp-e-lembretes.md` (alterado)
- `docs/19-qualidade.md` (alterado)
- `docs/21-planos-sem-consultas.md` (novo)
- `docs/22-entrega.md` (novo)

**drizzle**

- `drizzle/0024_sem_consultas_nas_notificacoes.sql` (novo)
- `drizzle/meta/0024_snapshot.json` (novo)
- `drizzle/meta/_journal.json` (alterado)

**previa**

- `previa/index.html` (alterado)
- `previa/src/app.tsx` (alterado)

**scripts**

- `scripts/aplicar-perfil.mjs` (alterado)
- `scripts/gerar-previa.py` (alterado)
- `scripts/gerar-segredos.mjs` (alterado)
- `scripts/lighthouse.mjs` (alterado)

**src/actions**

- `src/actions/admin/appointments.ts` (removido)
- `src/actions/admin/finance.ts` (alterado)
- `src/actions/admin/settings.ts` (alterado)
- `src/actions/patient.ts` (alterado)
- `src/actions/public.ts` (alterado)
- `src/actions/push.ts` (alterado)

**src/app**

- `src/app/(auth)/criar-conta/page.tsx` (alterado)
- `src/app/(site)/agendar/confirmado/page.tsx` (removido)
- `src/app/(site)/agendar/page.tsx` (removido)
- `src/app/(site)/como-funciona/page.tsx` (alterado)
- `src/app/(site)/conteudos/[slug]/page.tsx` (alterado)
- `src/app/(site)/layout.tsx` (alterado)
- `src/app/(site)/page.tsx` (alterado)
- `src/app/(site)/planos/page.tsx` (removido)
- `src/app/(site)/privacidade/page.tsx` (alterado)
- `src/app/(site)/site.css` (alterado)
- `src/app/(site)/sobre/page.tsx` (alterado)
- `src/app/admin/agenda/[id]/page.tsx` (removido)
- `src/app/admin/agenda/nova/page.tsx` (removido)
- `src/app/admin/agenda/page.tsx` (removido)
- `src/app/admin/configuracoes/page.tsx` (alterado)
- `src/app/admin/conteudos/[id]/page.tsx` (alterado)
- `src/app/admin/conteudos/page.tsx` (alterado)
- `src/app/admin/layout.tsx` (alterado)
- `src/app/admin/pacientes/[id]/_tabs/appointments.tsx` (removido)
- `src/app/admin/pacientes/[id]/page.tsx` (alterado)
- `src/app/admin/pacientes/page.tsx` (alterado)
- `src/app/admin/page.tsx` (alterado)
- `src/app/admin/privacidade/page.tsx` (alterado)
- `src/app/admin/relatorios/csv/route.ts` (alterado)
- `src/app/admin/relatorios/page.tsx` (alterado)
- `src/app/api/cron/route.ts` (alterado)
- `src/app/paciente/anamnese/page.tsx` (alterado)
- `src/app/paciente/consultas/[id]/agenda.ics/route.ts` (removido)
- `src/app/paciente/consultas/page.tsx` (removido)
- `src/app/paciente/depoimento/page.tsx` (novo)
- `src/app/paciente/encerrado/page.tsx` (alterado)
- `src/app/paciente/mais/page.tsx` (alterado)
- `src/app/paciente/meus-dados/page.tsx` (alterado)
- `src/app/paciente/notificacoes/page.tsx` (alterado)
- `src/app/paciente/page.tsx` (alterado)

**src/components**

- `src/components/BookingLink.tsx` (removido)
- `src/components/HeroArt.tsx` (alterado)
- `src/components/PatientPlanPage.tsx` (alterado)
- `src/components/PaymentForm.tsx` (alterado)
- `src/components/PostCta.tsx` (alterado)
- `src/components/SiteBlocks.tsx` (alterado)
- `src/components/SiteChrome.tsx` (alterado)
- `src/components/StartCtas.tsx` (novo)
- `src/components/nutri/TodayView.tsx` (alterado)

**src/db**

- `src/db/schema.ts` (alterado)
- `src/db/seed.ts` (alterado)

**src/lib**

- `src/lib/auth/permissions.ts` (alterado)
- `src/lib/auth/tokens.ts` (alterado)
- `src/lib/booking.ts` (removido)
- `src/lib/constants.ts` (alterado)
- `src/lib/corpo-server.ts` (alterado)
- `src/lib/email-cota.ts` (alterado)
- `src/lib/feriados.ts` (removido)
- `src/lib/format.ts` (alterado)
- `src/lib/forms.ts` (alterado)
- `src/lib/ics.ts` (novo)
- `src/lib/jsonld.ts` (alterado)
- `src/lib/lembretes-ics.ts` (alterado)
- `src/lib/pagamentos.ts` (alterado)
- `src/lib/pixels.ts` (alterado)
- `src/lib/push.ts` (alterado)
- `src/lib/reminders.ts` (alterado)
- `src/lib/reports.ts` (alterado)
- `src/lib/scheduling.ts` (removido)
- `src/lib/seo.ts` (alterado)
- `src/lib/whatsapp.ts` (alterado)

**tests/e2e**

- `tests/e2e/conteudo-site.spec.ts` (alterado)
- `tests/e2e/fase3.spec.ts` (alterado)
- `tests/e2e/fase4.spec.ts` (alterado)
- `tests/e2e/pagamento.spec.ts` (alterado)
- `tests/e2e/parte4.spec.ts` (alterado)
- `tests/e2e/planos-sem-consultas.spec.ts` (novo)
- `tests/e2e/public.spec.ts` (alterado)
- `tests/e2e/qualidade.spec.ts` (alterado)
- `tests/e2e/seo-captacao.spec.ts` (alterado)
- `tests/e2e/workflows.spec.ts` (alterado)

**tests/unit**

- `tests/unit/fase3.test.ts` (alterado)
- `tests/unit/lancamento.test.ts` (alterado)
- `tests/unit/parte4.test.ts` (alterado)
- `tests/unit/scheduling.test.ts` (removido)
- `tests/unit/security.test.ts` (alterado)
- `tests/unit/seo-captacao.test.ts` (alterado)
