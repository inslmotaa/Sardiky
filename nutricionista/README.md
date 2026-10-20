# Consultório André Farion · Sistema de nutrição

Site profissional, área do paciente e painel administrativo para o nutricionista André Farion.
Primeira versão utilizável, com **dados fictícios** (nenhum paciente real).

- **Site público:** abertura em storytelling animado, apresentação, serviços e valores, como funciona, depoimentos autorizados, dúvidas, contato com WhatsApp e formulário, política de privacidade.
- **Agendamento on-line:** horários livres calculados a partir do expediente, bloqueios e consultas existentes; nenhum horário pode ser reservado duas vezes.
- **Área do paciente:** plano alimentar com substituições (imprimível/PDF), diário alimentar com foto, evolução em gráficos, metas, mensagens, formulários, consultas, exportação de dados.
- **Painel:** agenda dia/semana/mês, prontuário completo, editor de planos com revisão obrigatória e versões, formulários configuráveis, financeiro, relatórios CSV, equipe com permissões, LGPD e auditoria.

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

`npm run setup` apaga e recria os dados de demonstração (ele se recusa a rodar em produção). Em desenvolvimento, o banco embutido e os arquivos enviados ficam em `~/.consultorio-nutri/` — fora do projeto, para o servidor não recarregar a página a cada gravação. Se o banco local for corrompido (por exemplo, ao fechar o servidor à força), apague essa pasta e rode `npm run setup` de novo.

## Prévia em arquivo único

`previa/index.html` abre direto no navegador (dois cliques, sem instalar nada). Traz o site público e uma **demonstração local** da área do cliente (`#cliente`) e do painel do André (`#andre`), onde ele cadastra clientes, monta as refeições e publica o plano. Nessa prévia os dados ficam só no navegador de quem abriu. Para regerar após mudanças: `npm run build`, `ALLOW_PGLITE=1 npx next start -p 3100` e `python3 scripts/gerar-previa.py`.

## O que é real e o que é demonstrativo

| Funciona de verdade | Depende de configuração | Ainda não implementado (indicado na tela) |
|---|---|---|
| Login, permissões, agendamento, agenda, prontuário, planos, diário, gráficos, mensagens internas, formulários, financeiro (registros internos), relatórios, LGPD, auditoria, uploads | E-mails e lembretes automáticos (Resend + `CRON_SECRET`) | Envio automático por WhatsApp (hoje: botão que abre a conversa com o texto pronto), pagamento on-line, criação automática de sala de vídeo (hoje: link colado na consulta) |

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm start` | Versão de produção |
| `npm run typecheck` | Checagem de tipos |
| `npm test` | Testes de unidade (agenda, fuso, senhas, permissões, validações) |
| `npm run test:e2e` | Testes de ponta a ponta no navegador (fluxos e isolamento de dados) |
| `npm run db:generate` | Gera migração após alterar `src/db/schema.ts` |

## Documentação

- [Planejamento: arquitetura, mapa do site, MVP, banco de dados e fluxos](docs/01-planejamento.md)
- [Segurança, privacidade e LGPD](docs/02-seguranca-lgpd.md)
- [Publicação: domínio, hospedagem, backups, monitoramento e custos](docs/03-publicacao.md)
- [Testes](docs/04-testes.md)
- [Próximos passos: informações do André, consultoria de dieta e treino, aplicativo](docs/05-proximos-passos.md)
