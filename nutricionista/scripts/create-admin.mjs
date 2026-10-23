// Prepara um banco de produção vazio: configurações iniciais + conta do nutricionista.
// Uso: node scripts/create-admin.mjs "Nome" email@dominio.com.br
// Imprime um link de primeiro acesso (válido por 7 dias) para criar a senha.
import postgres from 'postgres'
import { createHash, randomBytes } from 'node:crypto'

const [name, emailArg] = process.argv.slice(2)
if (!process.env.DATABASE_URL || !name || !emailArg) {
  console.error('Uso: DATABASE_URL=... node scripts/create-admin.mjs "Nome" email@dominio.com.br')
  process.exit(1)
}
const email = emailArg.trim().toLowerCase()
const sql = postgres(process.env.DATABASE_URL, { max: 1 })

const templates = {
  confirmacao: 'Olá, {nome}! Sua consulta ({servico}) está confirmada para {data} às {hora}. Código: {codigo}.',
  lembrete: 'Olá, {nome}! Lembrete: sua consulta ({servico}) é amanhã, {data}, às {hora}.',
  cancelamento: 'Olá, {nome}. Sua consulta de {data} às {hora} foi cancelada. Fale conosco para escolher um novo horário.',
}
await sql`
  insert into settings (id, professional_name, templates, demo_banner)
  values (1, ${name}, ${sql.json(templates)}, false)
  on conflict (id) do nothing`

let [user] = await sql`select id, role from users where email = ${email}`
if (user && user.role !== 'admin') {
  console.error('Este e-mail já pertence a outro tipo de usuário.')
  process.exit(1)
}
if (!user) [user] = await sql`insert into users (email, name, role, email_verified_at) values (${email}, ${name}, 'admin', now()) returning id`

const token = randomBytes(32).toString('base64url')
const id = createHash('sha256').update(token).digest('hex')
await sql`insert into auth_tokens (id, user_id, type, expires_at) values (${id}, ${user.id}, 'convite', now() + interval '7 days')`
await sql.end()

console.log(`Administrador pronto: ${email}`)
console.log(`Crie a senha em: ${process.env.APP_URL ?? 'https://SEU_DOMINIO'}/redefinir-senha?token=${token}`)
