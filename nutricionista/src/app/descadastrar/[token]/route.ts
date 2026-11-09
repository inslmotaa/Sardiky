import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import { audit } from '@/lib/audit'
import { setEmailConsent } from '@/lib/email-quota'

export const dynamic = 'force-dynamic'

/**
 * Descadastro de um clique do resumo por e-mail (link em todo e-mail de lembrete e cabeçalho
 * List-Unsubscribe). Desliga o resumo e revoga o consentimento. Código inválido: mesma página.
 */
async function unsubscribe(token: string) {
  if (!/^[\w-]{20,64}$/.test(token)) return
  const [row] = await db
    .select({ userId: schema.reminderChannels.userId, prefs: schema.users.notificationPrefs, name: schema.users.name, role: schema.users.role })
    .from(schema.reminderChannels)
    .innerJoin(schema.users, eq(schema.users.id, schema.reminderChannels.userId))
    .where(eq(schema.reminderChannels.unsubscribeToken, token))
  if (!row) return
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...row.prefs }
  if (!prefs.emailResumo) return
  await db.update(schema.users).set({ notificationPrefs: { ...prefs, emailResumo: false }, updatedAt: new Date() }).where(eq(schema.users.id, row.userId))
  const [p] = await db.select({ id: schema.patients.id }).from(schema.patients).where(eq(schema.patients.userId, row.userId))
  await setEmailConsent(row.userId, p?.id ?? null, false)
  await audit({ id: row.userId, name: row.name, role: row.role }, 'lembretes_email_descadastro', 'usuario', { entityId: row.userId })
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  await unsubscribe((await params).token)
  return Response.redirect(new URL('/descadastrar/ok', req.url), 303)
}

/** RFC 8058 (List-Unsubscribe-Post): o provedor de e-mail descadastra sem abrir página. */
export async function POST(_: Request, { params }: { params: Promise<{ token: string }> }) {
  await unsubscribe((await params).token)
  return new Response('ok')
}
