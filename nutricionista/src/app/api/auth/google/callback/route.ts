import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { and, eq, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { GOOGLE_COOKIE, finishFlow, type GoogleFlow } from '@/lib/auth/google'
import { createPatientAccount, destinationFor } from '@/lib/auth/accounts'
import { createSession } from '@/lib/auth/session'
import { audit } from '@/lib/audit'

/** Retorno do Google: entra com a conta existente (mesmo e-mail) ou cria a conta de paciente se o cadastro foi aceito. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const base = process.env.APP_URL ?? url.origin
  const to = (path: string) => NextResponse.redirect(new URL(path, base))
  const jar = await cookies()
  const raw = jar.get(GOOGLE_COOKIE)?.value
  jar.delete(GOOGLE_COOKIE)
  let flow: GoogleFlow | null = null
  try {
    flow = raw ? (JSON.parse(raw) as GoogleFlow) : null
  } catch {
    flow = null
  }
  const code = url.searchParams.get('code')
  if (!flow || !code || url.searchParams.get('state') !== flow.state) return to('/login?erro=google')

  const g = await finishFlow(code, flow.verifier)
  if (!g) return to('/login?erro=google')

  const [found] = await db
    .select({ user: schema.users, patientId: schema.patients.id })
    .from(schema.users)
    .leftJoin(schema.patients, eq(schema.patients.userId, schema.users.id))
    .where(or(eq(schema.users.googleSub, g.sub), eq(schema.users.email, g.email)))
    .limit(1)

  if (found) {
    if (!found.user.isActive) return to('/login?erro=inativo')
    await db
      .update(schema.users)
      .set({ googleSub: g.sub, emailVerifiedAt: found.user.emailVerifiedAt ?? new Date(), lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null })
      .where(eq(schema.users.id, found.user.id))
    await createSession(found.user.id)
    await audit({ id: found.user.id, name: found.user.name, role: found.user.role }, 'login', 'usuario', { entityId: found.user.id, details: { via: 'google' } })
    return to(await destinationFor({ role: found.user.role, patientId: found.patientId }, flow.next))
  }

  // Sem conta: só cria se a pessoa aceitou a Política de privacidade na tela de cadastro.
  if (!flow.consent) return to(`/criar-conta?google=sem-conta${flow.plano ? `&plano=${flow.plano}` : ''}`)
  const [pkg] = flow.plano
    ? await db.select({ id: schema.packages.id }).from(schema.packages).where(and(eq(schema.packages.id, flow.plano), eq(schema.packages.active, true)))
    : []
  const user = await createPatientAccount({ name: g.name, email: g.email, phone: null, passwordHash: null, packageId: pkg?.id ?? null, verified: true, googleSub: g.sub })
  await createSession(user.id)
  return to(await destinationFor({ role: 'patient', patientId: user.patientId }, flow.next))
}
