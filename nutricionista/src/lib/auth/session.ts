import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt } from 'drizzle-orm'
import { db, schema } from '@/db'
import { hashToken, newToken } from './tokens'
import { can, type Permission, type Role } from './permissions'

export const SESSION_COOKIE = 'nutri_session'
const SESSION_DAYS = 7
const RENEW_AFTER_MS = 24 * 3_600_000

export type CurrentUser = {
  id: string
  name: string
  email: string
  role: Role
  permissions: string[]
  patientId: string | null
  onboarded: boolean
  /** Nutricionista da equipe que só vê os próprios pacientes. */
  ownPatientsOnly: boolean
}

export async function clientIp() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
}

export async function createSession(userId: string) {
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)
  const h = await headers()
  await db.insert(schema.sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ip: await clientIp(),
    userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)))
  jar.delete(SESSION_COOKIE)
}

/** Usuário da sessão atual (memorizado por requisição). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const sid = hashToken(token)
  const rows = await db
    .select({ user: schema.users, session: schema.sessions, patientId: schema.patients.id })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.patients, eq(schema.patients.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, sid), gt(schema.sessions.expiresAt, new Date())))
    .limit(1)
  const row = rows[0]
  if (!row || !row.user.isActive) return null
  // Renovação deslizante: estende a sessão de quem continua usando.
  const remaining = row.session.expiresAt.getTime() - Date.now()
  if (SESSION_DAYS * 86_400_000 - remaining > RENEW_AFTER_MS) {
    await db
      .update(schema.sessions)
      .set({ expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
      .where(eq(schema.sessions.id, sid))
  }
  return {
    id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    role: row.user.role,
    permissions: row.user.permissions,
    patientId: row.patientId,
    onboarded: Boolean(row.user.onboardedAt),
    ownPatientsOnly: row.user.role === 'staff' && row.user.ownPatientsOnly,
  }
})

/** Exige qualquer membro da equipe; opcionalmente uma permissão específica. */
export async function requireTeam(perm?: Permission) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')
  // Sem permissão para a área: volta para a tela de entrada, com aviso.
  if (user.role === 'patient') redirect('/login?sem-acesso=painel')
  if (perm && !can(user, perm)) throw new ForbiddenError()
  return user
}

/** Exige paciente logado com cadastro vinculado. */
export async function requirePatient() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/paciente')
  if (user.role !== 'patient') redirect('/login?sem-acesso=paciente')
  if (!user.patientId) throw new ForbiddenError()
  return user as CurrentUser & { patientId: string }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Acesso não autorizado')
    this.name = 'ForbiddenError'
  }
}
