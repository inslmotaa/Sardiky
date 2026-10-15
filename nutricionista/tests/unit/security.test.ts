import { describe, expect, it } from 'vitest'
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password'
import { can } from '@/lib/auth/permissions'
import { hashToken, newCode, newToken } from '@/lib/auth/tokens'
import { csvCell } from '@/lib/csv'
import { sniffMime } from '@/lib/storage-sniff'

describe('senhas', () => {
  it('nunca guarda a senha em texto e verifica corretamente', async () => {
    const h = await hashPassword('Senha#Segura2026')
    expect(h).not.toContain('Senha#Segura2026')
    expect(h.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('Senha#Segura2026', h)).toBe(true)
    expect(await verifyPassword('senha#segura2026', h)).toBe(false)
    expect(await verifyPassword('qualquer', null)).toBe(false)
  })
  it('gera hashes diferentes para a mesma senha (sal aleatório)', async () => {
    expect(await hashPassword('Abcdef12345')).not.toBe(await hashPassword('Abcdef12345'))
  })
  it('exige senha mínima', () => {
    expect(passwordProblem('curta1')).toBeTruthy()
    expect(passwordProblem('semnumeroaqui')).toBeTruthy()
    expect(passwordProblem('boa-senha-2026')).toBeNull()
  })
})

describe('tokens', () => {
  it('guarda apenas o hash do token', () => {
    const t = newToken()
    expect(t.length).toBeGreaterThanOrEqual(40)
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(t)).not.toBe(t)
  })
  it('códigos de agendamento sem caracteres ambíguos', () => {
    expect(newCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
  })
})

describe('permissões', () => {
  const staff = { role: 'staff' as const, permissions: ['agenda'] }
  it('administrador pode tudo', () => {
    expect(can({ role: 'admin', permissions: [] }, 'clinico')).toBe(true)
    expect(can({ role: 'admin', permissions: [] }, 'config')).toBe(true)
  })
  it('equipe só acessa o que foi liberado e nunca as configurações', () => {
    expect(can(staff, 'agenda')).toBe(true)
    expect(can(staff, 'clinico')).toBe(false)
    expect(can({ role: 'staff', permissions: ['config'] }, 'config')).toBe(false)
  })
  it('paciente não tem permissões de equipe', () => {
    expect(can({ role: 'patient', permissions: ['clinico'] }, 'clinico')).toBe(false)
    expect(can(null, 'agenda')).toBe(false)
  })
})

describe('arquivos e exportações', () => {
  it('identifica o tipo pelo conteúdo, não pela extensão', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
    expect(sniffMime(png, ['image/png'])?.mime).toBe('image/png')
    expect(sniffMime(Buffer.from('<script>alert(1)</script>'), ['image/png', 'application/pdf'])).toBeNull()
    expect(sniffMime(Buffer.from('%PDF-1.7'), ['image/png'])).toBeNull()
  })
  it('neutraliza fórmulas em CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('Ana; Maria')).toBe('"Ana; Maria"')
  })
})
