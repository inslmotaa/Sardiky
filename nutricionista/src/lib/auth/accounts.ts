import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { PRIVACY_VERSION } from '@/lib/constants'
import { integrationStatus } from '@/lib/integrations'
import { sendEmail } from '@/lib/notify'
import { notifyTeam } from '@/lib/team'
import { audit } from '@/lib/audit'
import { hashToken, newToken } from './tokens'

/**
 * Confirmação de e-mail no cadastro público: exigida quando o envio de e-mails está configurado.
 * Sem e-mail configurado (ambiente de demonstração), a conta já nasce confirmada.
 */
export const emailVerificationRequired = () => integrationStatus().email

/** Cria a conta de paciente do cadastro público (site ou Google), com o consentimento registrado. */
export async function createPatientAccount(d: {
  name: string
  email: string
  phone: string | null
  passwordHash: string | null
  packageId: string | null
  verified: boolean
  googleSub?: string | null
}) {
  const user = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(schema.users)
      .values({
        email: d.email,
        name: d.name,
        role: 'patient',
        passwordHash: d.passwordHash,
        emailVerifiedAt: d.verified ? new Date() : null,
        googleSub: d.googleSub ?? null,
      })
      .returning()
    // Cadastro anterior feito pela equipe com o mesmo e-mail (ainda sem acesso): vincula em vez de duplicar.
    const [existing] = await tx
      .select({ id: schema.patients.id })
      .from(schema.patients)
      .where(and(eq(schema.patients.email, d.email), isNull(schema.patients.userId), isNull(schema.patients.anonymizedAt)))
      .orderBy(desc(schema.patients.createdAt))
      .limit(1)
    const [p] = existing
      ? await tx
          .update(schema.patients)
          .set({ userId: u.id, ...(d.phone ? { phone: d.phone } : {}), ...(d.packageId ? { packageId: d.packageId } : {}), updatedAt: new Date() })
          .where(eq(schema.patients.id, existing.id))
          .returning()
      : await tx
          .insert(schema.patients)
          .values({ userId: u.id, fullName: d.name, email: d.email, phone: d.phone, packageId: d.packageId, stage: 'Cadastro pelo site' })
          .returning()
    await tx.insert(schema.consents).values({ userId: u.id, patientId: p.id, kind: 'tratamento_dados_saude', version: PRIVACY_VERSION })
    return { ...u, patientId: p.id }
  })
  await notifyTeam('cadastro', 'Novo cadastro pelo site', d.name, `/admin/pacientes/${user.patientId}`, user.patientId)
  await audit({ id: user.id, name: user.name, role: user.role }, 'conta_criada', 'usuario', { entityId: user.id, patientId: user.patientId })
  return user
}

/** Envia (ou reenvia) o link de confirmação de e-mail, válido por 48 horas. */
export async function sendVerification(user: { id: string; name: string; email: string }, next?: string | null) {
  const token = newToken()
  await db.insert(schema.authTokens).values({ id: hashToken(token), userId: user.id, type: 'verificacao', expiresAt: new Date(Date.now() + 48 * 3_600_000) })
  const q = new URLSearchParams({ token, ...(next ? { next } : {}) })
  const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/confirmar-email?${q}`
  return sendEmail(
    user.email,
    'Confirme seu e-mail',
    `Olá, ${user.name.split(' ')[0]}!\n\nPara ativar sua conta, confirme seu e-mail neste link:\n${url}\n\nO link vale por 48 horas. Se você não criou uma conta, ignore este e-mail.`,
  )
}

/** Para onde vai cada perfil depois de entrar: paciente sem anamnese começa por ela. */
export async function destinationFor(user: { role: string; patientId: string | null }, next?: unknown) {
  const safe = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null
  if (user.role !== 'patient') return safe && !safe.startsWith('/paciente') ? safe : '/admin'
  if (user.patientId) {
    const [p] = await db.select({ at: schema.patients.anamnesisReceivedAt }).from(schema.patients).where(eq(schema.patients.id, user.patientId))
    if (p && !p.at) return `/paciente/anamnese${safe && safe !== '/paciente' ? `?next=${encodeURIComponent(safe)}` : ''}`
  }
  return safe && !safe.startsWith('/admin') ? safe : '/paciente'
}
