import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import webpush from 'web-push'

const root = path.resolve(import.meta.dirname, '../..')
const run = (args: string[], opts: { cwd?: string; input?: string } = {}) => {
  const env = { ...process.env }
  delete env.DATABASE_URL
  const r = spawnSync('node', args, { cwd: opts.cwd ?? root, input: opts.input, encoding: 'utf8', env })
  return { code: r.status, out: r.stdout + r.stderr }
}
const example = () => JSON.parse(readFileSync(path.join(root, 'deploy/perfil.exemplo.json'), 'utf8'))
const filled = () => {
  const p = example()
  p.profissional.crn = 'CRN-8 12345'
  p.profissional.biografia = 'Biografia de teste.'
  Object.assign(p.contato, {
    whatsapp: '(41) 99876-5432',
    instagram: '@andre.farion',
    email: 'contato@andrefarion.com.br',
    emailPrivacidade: 'contato@andrefarion.com.br',
    endereco: 'Atendimento somente on-line',
  })
  p.servicos.forEach((s: { preco: unknown; descricao: string }, i: number) => {
    s.preco = 100 + i
    s.descricao = 'Descrição de teste.'
  })
  return p
}
const check = (p: unknown) => run(['scripts/aplicar-perfil.mjs', '-', '--conferir'], { input: JSON.stringify(p) })

describe('perfil de produção', () => {
  it('recusa o modelo enquanto houver campos a preencher', () => {
    const r = run(['scripts/aplicar-perfil.mjs', 'deploy/perfil.exemplo.json', '--conferir'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('profissional.crn')
    expect(r.out).toContain('contato.instagram')
    expect(r.out).not.toContain('preco') // preço é opcional
  })

  it('aceita o modelo preenchido (só confere, sem banco)', () => {
    const r = check(filled())
    expect(r.out).toContain('Nada foi gravado')
    expect(r.code).toBe(0)
  })

  it('barra dados de exemplo esquecidos e formatos errados', () => {
    const p = filled()
    p.contato.email = 'contato@example.com'
    expect(check(p).out).toContain('contato.email')

    const q = filled()
    q.contato.whatsapp = '999'
    q.servicos[0].preco = '250'
    q.agenda.horarios[0].dia = 'segundou'
    const r = check(q)
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/whatsapp.*DDD/)
    expect(r.out).toContain('servicos.0.preco')
    expect(r.out).toContain('dia inválido')
  })
})

describe('gerador de segredos', () => {
  it('cria deploy/.env privado, com chaves VAPID válidas, e não sobrescreve', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'segredos-'))
    mkdirSync(path.join(dir, 'deploy'))
    copyFileSync(path.join(root, 'scripts/gerar-segredos.mjs'), path.join(dir, 'g.mjs'))
    expect(run(['g.mjs', 'nao-e-dominio', 'x@y.co'], { cwd: dir }).code).toBe(1)
    expect(run(['g.mjs', 'https://AndreFarion.com.br/', 'contato@andrefarion.com.br'], { cwd: dir }).code).toBe(0)

    const file = path.join(dir, 'deploy/.env')
    expect(statSync(file).mode & 0o777).toBe(0o600)
    const env = Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    )
    expect(env.DOMAIN).toBe('andrefarion.com.br')
    // Sem caracteres que quebrem a URL do banco.
    expect(env.DB_PASSWORD).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(env.CRON_SECRET).not.toBe(env.ANAMNESE_WEBHOOK_SECRET)
    expect(() => webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)).not.toThrow()

    const again = run(['g.mjs', 'andrefarion.com.br', 'contato@andrefarion.com.br'], { cwd: dir })
    expect(again.code).toBe(1)
    expect(readFileSync(file, 'utf8')).toContain(env.DB_PASSWORD)
  })
})

describe('destino do "Agendar consulta"', () => {
  it('vai para o WhatsApp quando escolhido e preenchido; senão, para a agenda on-line', async () => {
    const { bookingLink } = await import('@/lib/format')
    expect(bookingLink({ whatsapp: '5541991551789', bookingChannel: 'whatsapp' }, 'Oi!')).toEqual({ href: 'https://wa.me/5541991551789?text=Oi!', external: true })
    expect(bookingLink({ whatsapp: '5541991551789', bookingChannel: 'site' })).toEqual({ href: '/agendar', external: false })
    expect(bookingLink({ whatsapp: null, bookingChannel: 'whatsapp' })).toEqual({ href: '/agendar', external: false })
  })
})

describe('agendar pelo site com conta', () => {
  it('visitante passa pelo cadastro; quem está conectado vai direto para a agenda', async () => {
    const { bookingLink } = await import('@/lib/format')
    const s = { whatsapp: '5541991551789', bookingChannel: 'site' }
    expect(bookingLink(s, undefined, { loggedIn: false })).toEqual({ href: '/criar-conta?next=/agendar', external: false })
    expect(bookingLink(s, undefined, { loggedIn: true })).toEqual({ href: '/agendar', external: false })
  })
})
