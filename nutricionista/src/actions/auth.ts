'use server'

import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password'
import { clientIp, createSession, destroySession, getCurrentUser } from '@/lib/auth/session'
import { hashToken, newToken } from '@/lib/auth/tokens'
import { audit } from '@/lib/audit'
import { findValidToken } from '@/lib/auth/reset'
import { PRIVACY_VERSION } from '@/lib/constants'
import { sendEmail } from '@/lib/notify'
import { isLimited, rateLimit } from '@/lib/rate-limit'
import type { ActionState } from '@/lib/action'
import { email } from '@/lib/validation'

const MAX_FAILED = 5
const LOCK_MINUTES = 15

function safeNext(next: unknown, fallback: string) {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : fallback
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = (await clientIp()) ?? 'local'
  // Só tentativas erradas contam: várias pessoas na mesma rede (consultório, família) podem entrar normalmente.
  const ipKey = `login-falhou:${ip}`
  if (isLimited(ipKey, 20)) {
    return { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
  }
  const parsed = z.object({ email, password: z.string().min(1).max(200) }).safeParse({
    email: fd.get('email'),
    password: fd.get('password'),
  })
  if (!parsed.success) return { error: 'Informe e-mail e senha.' }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email))
  const generic: ActionState = { error: 'E-mail ou senha incorretos.' }

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await verifyPassword(parsed.data.password, null) // tempo de resposta uniforme
    return { error: 'Acesso temporariamente bloqueado por excesso de tentativas. Tente novamente mais tarde ou redefina a senha.' }
  }
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash)
  if (!user || !ok || !user.isActive) {
    if (user) {
      const failed = user.failedLogins + 1
      await db
        .update(schema.users)
        .set({
          failedLogins: failed >= MAX_FAILED ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        })
        .where(eq(schema.users.id, user.id))
      await audit({ id: user.id, name: user.name, role: user.role }, 'login_falhou', 'usuario', { entityId: user.id })
    }
    rateLimit(ipKey, 20, 10 * 60_000)
    return generic
  }

  await db
    .update(schema.users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(schema.users.id, user.id))
  await createSession(user.id)
  await audit({ id: user.id, name: user.name, role: user.role }, 'login', 'usuario', { entityId: user.id })
  redirect(safeNext(fd.get('next'), user.role === 'patient' ? '/paciente' : '/admin'))
}

export async function logout() {
  const user = await getCurrentUser()
  if (user) await audit(user, 'logout', 'usuario', { entityId: user.id })
  await destroySession()
  redirect('/login?saiu=1')
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = (await clientIp()) ?? 'local'
  const done: ActionState = {
    ok: true,
    message: 'Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha. O link vale por 1 hora.',
  }
  if (!rateLimit(`reset:${ip}`, 5, 15 * 60_000)) return { error: 'Muitas solicitações. Aguarde alguns minutos.' }
  const parsed = email.safeParse(fd.get('email'))
  if (!parsed.success) return { error: 'Informe um e-mail válido.', fieldErrors: { email: 'E-mail inválido' } }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data))
  if (user && user.isActive) {
    const token = newToken()
    await db.insert(schema.authTokens).values({
      id: hashToken(token),
      userId: user.id,
      type: 'reset',
      expiresAt: new Date(Date.now() + 3_600_000),
    })
    const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/redefinir-senha?token=${token}`
    await sendEmail(
      user.email,
      'Redefinição de senha',
      `Olá, ${user.name}.\n\nRecebemos um pedido para redefinir sua senha. Para continuar, acesse:\n${url}\n\nO link vale por 1 hora. Se você não fez o pedido, ignore este e-mail.`,
    )
    await audit({ id: user.id, name: user.name, role: user.role }, 'senha_reset_solicitado', 'usuario', { entityId: user.id })
  }
  return done
}

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get('token') ?? '')
  const password = String(fd.get('password') ?? '')
  const confirm = String(fd.get('confirm') ?? '')
  const row = await findValidToken(token)
  if (!row) return { error: 'Link inválido ou expirado. Solicite um novo.' }
  const problem = passwordProblem(password)
  if (problem) return { fieldErrors: { password: problem }, error: problem }
  if (password !== confirm) return { fieldErrors: { confirm: 'As senhas não conferem' }, error: 'As senhas não conferem.' }

  await db.update(schema.users).set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(schema.users.id, row.user.id))
  await db.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, row.token.id))
  // Encerra sessões abertas em outros aparelhos.
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, row.user.id))
  if (row.token.type === 'convite' && row.user.role === 'patient') {
    const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.userId, row.user.id))
    if (patient) {
      await db.insert(schema.consents).values({ userId: row.user.id, patientId: patient.id, kind: 'tratamento_dados_saude', version: PRIVACY_VERSION })
    }
  }
  await audit({ id: row.user.id, name: row.user.name, role: row.user.role }, row.token.type === 'convite' ? 'conta_ativada' : 'senha_redefinida', 'usuario', {
    entityId: row.user.id,
  })
  redirect('/login?senha=1')
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const current = String(fd.get('current') ?? '')
  const password = String(fd.get('password') ?? '')
  const confirm = String(fd.get('confirm') ?? '')
  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id))
  if (!(await verifyPassword(current, row?.passwordHash))) return { fieldErrors: { current: 'Senha atual incorreta' }, error: 'Senha atual incorreta.' }
  const problem = passwordProblem(password)
  if (problem) return { fieldErrors: { password: problem }, error: problem }
  if (password !== confirm) return { fieldErrors: { confirm: 'As senhas não conferem' }, error: 'As senhas não conferem.' }
  await db.update(schema.users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(schema.users.id, user.id))
  await audit(user, 'senha_alterada', 'usuario', { entityId: user.id })
  return { ok: true, message: 'Senha alterada com sucesso.' }
}
