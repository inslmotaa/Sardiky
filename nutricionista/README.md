# Consultório André Farion · Sistema de nutrição

Site profissional, área do paciente e painel administrativo para o nutricionista André Farion.
Primeira versão utilizável, com **dados fictícios** (nenhum paciente real).

- **Site público:** abertura em storytelling animado, apresentação, serviços e valores, como funciona, depoimentos autorizados, dúvidas, contato com WhatsApp e formulário, política de privacidade.
- **Agendamento on-line:** horários livres calculados a partir do expediente, bloqueios e consultas existentes; nenhum horário pode ser reservado duas vezes.
- **App do paciente (celular primeiro, instalável):** tela **Hoje** com a próxima refeição e marcação feita/parcial/pulada, contador de água, registro rápido de peso; **Plano** com dias (treino/descanso), opções por refeição, substituições aprovadas e **PDF com a marca**; **Diário** por refeição (“segui o plano”, “segui em parte”, “comi outra coisa” com busca de alimentos, foto, fome, saciedade e humor); **Progresso** com constância semanal, metas, gráficos e fotos de evolução lado a lado; **chat** com fotos, PDF e áudio curto; **notificações push** (refeições, água, plano novo, mensagens, consultas) e plano disponível **sem internet**. O André escolhe, por paciente, se calorias, macros, diário, chat e calculadoras aparecem.
- **Painel:** **Acompanhamento** (quem está em dia, com dificuldade ou sem progresso, com mensagem rápida); **avaliações antropométricas** com dobras (Jackson-Pollock 3 e 7, Durnin-Womersley), bioimpedância, circunferências, massa magra e RCQ; editor de planos com **cálculo automático** (base de alimentos com medidas caseiras, metas de kcal e macros, sugestão de substituições equivalentes, desfazer/refazer, prévia no celular) e revisão obrigatória antes de ativar; base de alimentos (inclui cadastro por rótulo); calculadoras (porções, IMC, TMB/GET, macros, água, projeção); agenda dia/semana/mês, prontuário, formulários, financeiro, relatórios CSV, equipe com permissões, LGPD e auditoria.

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
| Nutricionista (administrador) | nutri@example.com | Nutri#Demo2026 |
| Equipe (recepção, sem dados clínicos) | recepcao@example.com | Equipe#Demo2026 |
| Paciente | paciente@example.com | Paciente#Demo2026 |
| Paciente 2 | lucas@example.com | Paciente#Demo2026 |

| Paciente 3 | helena@example.com | Paciente#Demo2026 |

`npm run setup` apaga e recria os dados de demonstração (ele se recusa a rodar em produção). Em desenvolvimento, o banco embutido e os arquivos enviados ficam em `~/.consultorio-nutri/` — fora do projeto, para o servidor não recarregar a página a cada gravação. Se o banco local for corrompido (por exemplo, ao fechar o servidor à força), apague essa pasta e rode `npm run setup` de novo.

## Prévia em arquivo único

`previa/index.html` abre direto no navegador (dois cliques, sem instalar nada). Traz o site público e uma **demonstração local** do app do cliente (`#cliente`: Hoje, Plano, Diário, Progresso, Calculadoras) e do painel do André (`#andre`: clientes, editor de planos com cálculo e calculadoras). Inclui também o diário novo, a constância, as metas, o chat e o painel de Acompanhamento (`#andre/acompanhamento`). A demonstração usa **os mesmos componentes do sistema** (`previa/src/app.tsx`, empacotado com esbuild por `scripts/build-previa.mjs`), com os dados guardados só no navegador de quem abriu.

Para regerar após mudanças: `npm run build`, `ALLOW_PGLITE=1 npx next start -p 3100` (em outro terminal) e `python3 scripts/gerar-previa.py`.

## O que é real e o que é demonstrativo

| Funciona de verdade | Depende de configuração | Ainda não implementado (indicado na tela) |
|---|---|---|
| Login, permissões, agendamento, agenda, prontuário, planos com cálculo e PDF, base de alimentos, calculadoras, tela Hoje, água e peso, diário, acompanhamento, avaliações com dobras, fotos de evolução, chat ao vivo, app instalável com plano off-line, gráficos, formulários, financeiro (registros internos), relatórios, LGPD, auditoria, uploads | E-mails (Resend), lembretes automáticos (`CRON_SECRET`, a cada 5 min) e notificações push em produção (chaves VAPID) | Envio automático por WhatsApp (hoje: botão que abre a conversa com o texto pronto), pagamento on-line, criação automática de sala de vídeo (hoje: link colado na consulta) |

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
- [Testes](docs/04-testes.md)
- [Fase 1 da plataforma: o que foi entregue e o que falta](docs/06-fase-1.md)
- [Fase 2 — Acompanhamento: o que foi entregue e o que falta](docs/07-fase-2.md)
- [Próximos passos: informações do André, consultoria de dieta e treino, aplicativo](docs/05-proximos-passos.md)
