import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { findValidToken } from '@/lib/auth/reset'
import { destinationFor } from '@/lib/auth/accounts'
import { createSession } from '@/lib/auth/session'
import { audit } from '@/lib/audit'

/** Link do e-mail de confirmação: confirma o endereço, já entra na conta e segue para a anamnese (ou para a área do cliente). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const base = process.env.APP_URL ?? url.origin
  const row = await findValidToken(url.searchParams.get('token') ?? '', ['verificacao'])
  if (!row) return NextResponse.redirect(new URL('/criar-conta/confirme?erro=link', base))
  await db.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, row.token.id))
  await db.update(schema.users).set({ emailVerifiedAt: new Date(), lastLoginAt: new Date() }).where(eq(schema.users.id, row.user.id))
  await createSession(row.user.id)
  await audit({ id: row.user.id, name: row.user.name, role: row.user.role }, 'email_confirmado', 'usuario', { entityId: row.user.id })
  const [p] = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.userId, row.user.id))
  return NextResponse.redirect(new URL(await destinationFor({ role: row.user.role, patientId: p?.id ?? null }, url.searchParams.get('next')), base))
}
