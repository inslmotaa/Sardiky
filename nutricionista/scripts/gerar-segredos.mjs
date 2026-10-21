// Gera o arquivo deploy/.env de produção com senhas e chaves novas, direto no servidor.
// Uso (na pasta nutricionista/):
//   node scripts/gerar-segredos.mjs andrefarion.com.br contato@andrefarion.com.br
// Sem Node instalado no servidor:
//   docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/gerar-segredos.mjs DOMINIO EMAIL
// Nunca envie este arquivo por e-mail ou chat e nunca o coloque no Git (já está no .gitignore).
import { existsSync, writeFileSync } from 'node:fs'
import { generateKeyPairSync, randomBytes } from 'node:crypto'

const OUT = 'deploy/.env'
const [domainArg, emailArg] = process.argv.slice(2)
const domain = (domainArg ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
const email = (emailArg ?? '').trim().toLowerCase()

if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: node scripts/gerar-segredos.mjs DOMINIO EMAIL_DE_CONTATO')
  console.error('Ex.: node scripts/gerar-segredos.mjs andrefarion.com.br contato@andrefarion.com.br')
  process.exit(1)
}
if (existsSync(OUT)) {
  // Trocar as chaves depois de publicar quebra o push dos aparelhos e o acesso ao banco existente.
  console.error(`${OUT} já existe. Para gerar de novo, apague-o antes (só faça isso antes da primeira publicação).`)
  process.exit(1)
}

const secret = (bytes = 32) => randomBytes(bytes).toString('base64url')

/** Par de chaves VAPID (P-256) no formato do Web Push: pública = ponto não comprimido, privada = escalar d. */
function vapid() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const pub = publicKey.export({ format: 'jwk' })
  const priv = privateKey.export({ format: 'jwk' })
  const point = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')])
  return { publicKey: point.toString('base64url'), privateKey: priv.d }
}

const v = vapid()
const env = `# Gerado por scripts/gerar-segredos.mjs em ${new Date().toISOString().slice(0, 10)}.
# Arquivo secreto: não compartilhe e não envie ao Git. Guarde uma cópia num cofre de senhas.

DOMAIN=${domain}

# Banco de dados (usado só dentro do servidor)
DB_PASSWORD=${secret()}

# Tarefas agendadas (lembretes a cada 5 minutos)
CRON_SECRET=${secret()}

# Notificações push no celular. Não troque depois de publicar: os aparelhos teriam de ativar de novo.
VAPID_PUBLIC_KEY=${v.publicKey}
VAPID_PRIVATE_KEY=${v.privateKey}
VAPID_SUBJECT=mailto:${email}

# Anamnese vinda de formulário externo (Google Forms/Tally): /api/webhooks/anamnese
ANAMNESE_WEBHOOK_SECRET=${secret()}

# E-mail (recuperação de senha, confirmações). Crie a chave em https://resend.com e cole aqui.
RESEND_API_KEY=
EMAIL_FROM="André Farion <nao-responda@${domain}>"
`
writeFileSync(OUT, env, { mode: 0o600 })
console.log(`${OUT} criado com senhas e chaves novas (permissão 600).`)
console.log('Falta só preencher RESEND_API_KEY, se for usar e-mail.')
