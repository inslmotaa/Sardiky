import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { remindersFile, sha256 } from '@/lib/lembretes'

export const dynamic = 'force-dynamic'

/**
 * Assinatura do calendário (webcal://…/lembretes/<código>.ics): o celular busca de tempos em tempos
 * e os lembretes se atualizam sozinhos. Código secreto e revogável; o arquivo só traz o nome da
 * refeição e o horário. Código inválido ou revogado: 404.
 */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/, '')
  if (!/^[\w-]{20,64}$/.test(raw)) return new Response('Não encontrado', { status: 404 })
  const [row] = await db
    .select({ userId: schema.reminderChannels.userId, patientId: schema.patients.id, active: schema.users.isActive })
    .from(schema.reminderChannels)
    .innerJoin(schema.users, eq(schema.users.id, schema.reminderChannels.userId))
    .innerJoin(schema.patients, eq(schema.patients.userId, schema.users.id))
    .where(and(eq(schema.reminderChannels.calendarTokenHash, sha256(raw))))
  if (!row || !row.active) return new Response('Não encontrado', { status: 404 })
  const body = await remindersFile(row.userId, row.patientId, { download: false })
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'private, max-age=3600', 'X-Robots-Tag': 'noindex' } })
}
