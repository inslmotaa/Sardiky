# André Farion · Coach — site, app do cliente e painel

Site profissional, área do cliente (app instalável) e painel do coach André Farion.
Primeira versão utilizável, com **dados fictícios** (nenhum cliente real). O André é **coach**: nenhuma tela, PDF ou configuração mostra registro profissional, e o título é sempre Coach.

- **Site público:** abertura em storytelling animado, apresentação, Sobre com formações e foto vertical, serviços, planos com o botão **Contratar** (pagamento pelo Mercado Pago), depoimentos **com autorização** registrada e aprovados pelo coach, como funciona, dúvidas, contato com WhatsApp e o formulário curto **Quero saber mais** (com a origem UTM salva no interessado), **Conteúdos** (blog com editor no painel, rascunho/publicado e convite para agendar no fim de cada post), política de privacidade. **SEO:** `robots.txt` e `sitemap.xml` (painel, área do cliente e login fora do índice), título, descrição e canonical por página, Open Graph e Twitter Card com imagem gerada na identidade verde, dados estruturados (Person, ProfessionalService e FAQPage). **Pixels da Meta e do Google** desligados por padrão; ligados no painel, só carregam com o consentimento de cookies ([docs/16-seo-e-captacao.md](docs/16-seo-e-captacao.md)). **Modo escuro** automático, com chave manual no app do cliente. Antes de publicar, o Início do painel e `node scripts/aplicar-perfil.mjs --pendencias` listam os textos de exemplo que faltam trocar ([docs/15-conteudo-e-acabamento.md](docs/15-conteudo-e-acabamento.md)).
- **Parte 4 — app e painel** ([docs/17-app-e-painel.md](docs/17-app-e-painel.md)): **check-ins periódicos** com frequência por cliente, prazo, push e atrasados no Acompanhamento; **vitaminas e minerais** por refeição e dia no editor (opcional para o cliente); **597 alimentos da TACO** por padrão e cadastro por **código de barras** (câmera + Open Food Facts, com conferência manual); **diário** de dias passados com edição e **real × planejado** para o coach; **vencimento** com avisos 7 e 2 dias antes, renovação, área só com histórico ao vencer e **assinatura mensal** opcional; **recibo em PDF**; **WhatsApp sem custo** com textos editáveis; **login por link mágico**; **exportação automática** antes de excluir ou anonimizar.
- **Agendamento on-line:** horários livres calculados a partir do expediente, bloqueios e consultas existentes; nenhum horário pode ser reservado duas vezes.
- **App do cliente (celular primeiro, instalável):** tela **Hoje** com a próxima refeição e marcação feita/parcial/pulada, contador de água, registro rápido de peso; **Plano** com dias (treino/descanso), opções por refeição, substituições aprovadas e **PDF com a marca**; **Diário** por refeição (“segui o plano”, “segui em parte”, “comi outra coisa” com busca de alimentos, foto, fome, saciedade e humor); **Progresso** com constância semanal, metas, gráficos e fotos de evolução lado a lado; **chat** com fotos, PDF e áudio curto; **notificações push** (refeições, água, plano novo, mensagens, consultas) e plano disponível **sem internet**. O André escolhe, por cliente, se calorias, macros, diário, chat e calculadoras aparecem.
- **Gestão (Fase 3):** agenda com confirmação de presença, pedido de remarcação e avaliação da consulta pelo cliente, sala de videochamada gerada no Jitsi, feriados nacionais bloqueados com um clique e lembretes 24 h/2 h; **anamnese nativa** com seções, escala, envio de exames, consentimento e respostas que viram restrições na ficha (com alerta no editor de planos) e webhook para Google Forms/Tally; **receitas** com cálculo automático e vínculo ao plano; **materiais educativos**; **lista de compras** da semana gerada do plano; **prescrições** de suplementos e exames; pagamentos **atrasados** com cobrança pelo WhatsApp; **coaches que veem só os próprios clientes**; assinatura e logo no PDF e refeições padrão dos planos novos.
- **Painel:** **Acompanhamento** (quem está em dia, com dificuldade ou sem progresso, com mensagem rápida); **avaliações antropométricas** com dobras (Jackson-Pollock 3 e 7, Durnin-Womersley), bioimpedância, circunferências, massa magra e RCQ; editor de planos com **cálculo automático** (base de alimentos com medidas caseiras, metas de kcal e macros, sugestão de substituições equivalentes, desfazer/refazer, prévia no celular) e revisão obrigatória antes de ativar; base de alimentos (inclui cadastro por rótulo); calculadoras (porções, IMC, TMB/GET, macros, água, projeção); agenda dia/semana/mês, ficha do cliente, formulários, financeiro, relatórios CSV, equipe com permissões, LGPD e auditoria.

## Como rodar no computador

Requisitos: Node.js 20.9 ou superior.

```bash
cd nutricionista
npm install
npm run setup   # cria o banco local (PostgreSQL embutido) com dados fictícios
npm run dev     # abra http://localhost:3000
```

| Perfil | E-mail | Senha |
|---|---|---|
| Coach (administrador) | nutri@example.com | Nutri#Demo2026 |
| Equipe (recepção, sem dados clínicos) | recepcao@example.com | Equipe#Demo2026 |
| Paciente | paciente@example.com | Paciente#Demo2026 |
| Paciente 2 | lucas@example.com | Paciente#Demo2026 |

| Paciente 3 | helena@example.com | Paciente#Demo2026 |
| Coach 2 (vê só os próprios pacientes) | nutri2@example.com | Equipe#Demo2026 |

`npm run setup` apaga e recria os dados de demonstração (ele se recusa a rodar em produção). Em desenvolvimento, o banco embutido e os arquivos enviados ficam em `~/.consultorio-nutri/` — fora do projeto, para o servidor não recarregar a página a cada gravação. Se o banco local for corrompido (por exemplo, ao fechar o servidor à força), apague essa pasta e rode `npm run setup` de novo.

## Prévia em arquivo único

`previa/index.html` abre direto no navegador (dois cliques, sem instalar nada). Traz o site público e uma **demonstração local** do app do cliente (`#cliente`: Hoje, Plano, Diário, Progresso, Calculadoras) e do painel do André (`#andre`: clientes, editor de planos com cálculo e calculadoras). Inclui também o diário novo, a constância, as metas, o chat e o painel de Acompanhamento (`#andre/acompanhamento`). A demonstração usa **os mesmos componentes do sistema** (`previa/src/app.tsx`, empacotado com esbuild por `scripts/build-previa.mjs`), com os dados guardados só no navegador de quem abriu.

Para regerar após mudanças: `npm run build`, `ALLOW_PGLITE=1 npx next start -p 3100` (em outro terminal) e `python3 scripts/gerar-previa.py`.

## O que é real e o que é demonstrativo

| Funciona de verdade | Depende de configuração | Ainda não implementado (indicado na tela) |
|---|---|---|
| Login, permissões, agendamento, agenda, prontuário, planos com cálculo e PDF, base de alimentos, calculadoras, tela Hoje, água e peso, diário, acompanhamento, avaliações com dobras, fotos de evolução, chat ao vivo, app instalável com plano off-line, gráficos, formulários, financeiro, relatórios, LGPD, auditoria, uploads | E-mails (Resend), lembretes automáticos (`CRON_SECRET`, a cada 5 min), notificações push em produção (chaves VAPID) e **pagamento on-line pelo Mercado Pago** (Pix, cartão e boleto; `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET`, ver [docs/14-mercado-pago.md](docs/14-mercado-pago.md)) | Envio automático por WhatsApp (hoje: botão que abre a conversa com o texto pronto), criação automática de sala de vídeo (hoje: link colado na consulta) |

Os valores nutricionais da base inicial (`src/db/foods-taco.ts`, 60 alimentos) têm a Tabela TACO como referência, mas **precisam ser conferidos pelo André** com a tabela oficial antes do uso clínico.

## Problemas comuns

- **A página recarrega sem parar no `npm run dev`:** pare o servidor, apague `.next/dev` e rode de novo.
- **Erro de banco ao iniciar (ex.: `58P01`):** pare todos os servidores, apague `~/.consultorio-nutri` e rode `npm run setup`.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Versão de produção |
| `npm run typecheck` | Checagem de tipos |
| `npm test` | Testes de unidade (cálculos nutricionais, agenda, fuso, senhas, permissões, validações) |
| `npm run test:e2e` | Testes de ponta a ponta no navegador (fluxos e isolamento de dados) |
| `npm run db:generate` | Gera migração após alterar `src/db/schema.ts` |

## Documentação

- [Planejamento: arquitetura, mapa do site, MVP, banco de dados e fluxos](docs/01-planejamento.md)
- [Segurança, privacidade e LGPD](docs/02-seguranca-lgpd.md)
- [Publicação: domínio, hospedagem, backups, monitoramento e custos](docs/03-publicacao.md)
- [Lançamento: dados reais do André, segredos do servidor e checklist](docs/09-lancamento.md)
- [Manual do André: painel, app do cliente, banco de dados e LGPD](docs/10-manual-do-andre.md)
- [Site novo, contas de cliente, anamnese no site e hub do cliente (o que rodar no servidor)](docs/11-site-contas-anamnese.md)
- [SEO, Conteúdos (blog), captação com UTM e pixels com consentimento](docs/16-seo-e-captacao.md)
- [App do cliente e painel: check-ins, micronutrientes, código de barras, renovação, recibos, WhatsApp, link mágico](docs/17-app-e-painel.md)
- [Testes](docs/04-testes.md)
- [Fase 1 da plataforma: o que foi entregue e o que falta](docs/06-fase-1.md)
- [Fase 2 — Acompanhamento: o que foi entregue e o que falta](docs/07-fase-2.md)
- [Fase 3 — Gestão: o que foi entregue, webhook da anamnese e o que falta](docs/08-fase-3.md)
- [Próximos passos: informações do André, consultoria de dieta e treino, aplicativo](docs/05-proximos-passos.md)
