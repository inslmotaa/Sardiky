-- =====================================================================
-- Conta do André (nutricionista, perfil admin). Rode UMA vez no banco
-- de produção, depois de subir o sistema (as migrações rodam sozinhas).
--
--   docker compose -f deploy/docker-compose.yml --env-file deploy/.env \
--     exec -T db psql -U nutri -d nutri < deploy/criar-admin.sql
--
-- Não existe cadastro público de nutricionista: só este script (ou
-- scripts/create-admin.mjs, que faz o mesmo) cria contas de admin.
-- Nenhuma senha é escrita aqui: o resultado é um link de primeiro acesso,
-- válido por 7 dias, em que o André cria a própria senha.
-- =====================================================================

BEGIN;

-- >>> TROQUE AQUI: e-mail e nome do André <<<
\set admin_email 'andre@SEU-DOMINIO.com.br'
\set admin_name 'André Farion'
-- >>> TROQUE AQUI: endereço do site (o mesmo de APP_URL) <<<
\set site_url 'https://SEU-DOMINIO.com.br'

-- Configurações iniciais (só se ainda não existirem).
INSERT INTO settings (id, professional_name, templates, demo_banner)
VALUES (
  1, :'admin_name',
  '{"confirmacao":"Olá, {nome}! Sua consulta ({servico}) está confirmada para {data} às {hora}. Código: {codigo}.","lembrete":"Olá, {nome}! Lembrete: sua consulta ({servico}) é amanhã, {data}, às {hora}.","cancelamento":"Olá, {nome}. Sua consulta de {data} às {hora} foi cancelada. Fale conosco para escolher um novo horário."}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

-- Conta admin (e-mail já confirmado). Se o e-mail já existir como admin, reaproveita.
INSERT INTO users (email, name, role, email_verified_at)
VALUES (lower(:'admin_email'), :'admin_name', 'admin', now())
ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = true
WHERE users.role = 'admin';

-- Link de primeiro acesso: o banco guarda só o resumo (sha256) do código.
CREATE TEMP TABLE _convite AS
SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') AS codigo;

INSERT INTO auth_tokens (id, user_id, type, expires_at)
SELECT encode(sha256(convert_to(c.codigo, 'UTF8')), 'hex'), u.id, 'convite', now() + interval '7 days'
FROM _convite c JOIN users u ON u.email = lower(:'admin_email') AND u.role = 'admin';

-- Copie o link abaixo e abra no navegador para criar a senha.
SELECT :'site_url' || '/redefinir-senha?token=' || codigo AS link_de_primeiro_acesso
FROM _convite
WHERE EXISTS (SELECT 1 FROM users WHERE email = lower(:'admin_email') AND role = 'admin');

COMMIT;
