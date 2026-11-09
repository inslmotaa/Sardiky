# Banco de dados (PostgreSQL em SQL)

O sistema usa **PostgreSQL**. Todo o banco está em SQL puro, em dois arquivos na pasta `deploy/`:

| Arquivo | O que tem |
|---|---|
| `deploy/banco-de-dados.sql` | Todas as tabelas, tipos, índices e chaves, mais o registro das migrações |
| `deploy/alimentos.sql` | Base de alimentos: TACO 4ª ed. completa (597), itens complementares e 7.771 medidas caseiras do IBGE |
| `deploy/criar-admin.sql` | Conta do André (admin) com link de primeiro acesso |

## Criar o banco do zero (sem Docker)

```bash
createdb nutri
psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/banco-de-dados.sql
psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/alimentos.sql
psql "postgresql://USUARIO:SENHA@HOST:5432/nutri" -f deploy/criar-admin.sql   # edite o e-mail e o site antes
```

Depois, aponte o sistema para o banco com `DATABASE_URL=postgresql://USUARIO:SENHA@HOST:5432/nutri`.

Com Docker (`deploy/docker-compose.yml`), esses passos não são necessários: ao subir, o sistema cria as mesmas tabelas sozinho (migrações em `drizzle/`) e carrega os alimentos. Só o `criar-admin.sql` continua valendo.

## Como os arquivos são mantidos

- O esquema vive em `src/db/schema.ts`. Cada mudança gera uma migração em `drizzle/` (`npx drizzle-kit generate --name ...`).
- `npm run db:sql` gera de novo os dois arquivos SQL a partir do esquema e das tabelas de alimentos.
- `banco-de-dados.sql` já registra as migrações que contém (`drizzle.__drizzle_migrations`). Assim, ao subir, o sistema aplica só as que vierem depois.
- O teste `tests/unit/banco-sql.test.ts` cria um banco a partir dos arquivos SQL e outro pelas migrações, e confere que os dois têm exatamente as mesmas tabelas e colunas. Também confere que a base de alimentos está completa e que rodar `alimentos.sql` de novo não duplica nada.

## Tabelas principais

| Tabela | Para quê |
|---|---|
| `users`, `sessions`, `auth_tokens` | Contas (cliente, coach, equipe), login, convites e redefinição de senha |
| `patients` | Ficha do cliente: plano contratado, início e término (opcional), recursos do app |
| `anamneses` | Anamnese respondida no app (versões e rascunho) |
| `appointments`, `services`, `working_hours`, `time_blocks` | Agenda e consultas on-line |
| `meal_plans` | Planos alimentares: rascunho, publicado e histórico (sem data de validade) |
| `meal_logs`, `water_logs`, `diary_entries` | O que o cliente marca e registra no dia |
| `measurements`, `progress_photos`, `goals` | Avaliações, fotos de evolução e metas |
| `files` | Arquivos privados: exames, fotos e documentos |
| `foods`, `household_measures`, `measure_refs` | TACO 4ª ed. e medidas caseiras |
| `messages`, `notifications`, `push_subscriptions` | Chat e avisos |
| `packages`, `payments` | Planos de acompanhamento e financeiro |
| `testimonials` | Depoimentos: texto, nota, data e forma da autorização, aprovação do coach e fotos de antes e depois com autorização específica (migração `0019_depoimentos_e_formacoes`) |
| `consents`, `data_requests`, `audit_logs` | LGPD e trilha de auditoria |
| `settings` | Configurações: nome do site, nome e título do coach (sempre Coach), contato, textos e link do formulário de anamnese. Sem registro profissional: a coluna `registry` saiu na migração `0018_remover_registro` |
