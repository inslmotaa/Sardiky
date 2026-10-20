import { and, count, desc, eq, isNull, max } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { uuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/**
 * Sinal de mudança para a atualização ao vivo das telas (consultado a cada poucos segundos).
 * Devolve só uma "assinatura" do estado — nenhum dado de saúde. Quando ela muda, a tela recarrega os dados.
 * - Paciente: versão do plano ativo, última mensagem e avisos não lidos.
 * - Equipe (?p=<paciente>): última mensagem e último registro do diário daquele paciente; sem ?p, mensagens não lidas.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ error: 'não autenticado' }, { status: 401 })
  const headers = { 'Cache-Control': 'no-store' }

  if (user.role === 'patient' && user.patientId) {
    const pid = user.patientId
    const [[plan], [msg], [notes]] = await Promise.all([
      db
        .select({ at: schema.mealPlans.publishedAt })
        .from(schema.mealPlans)
        .where(and(eq(schema.mealPlans.patientId, pid), eq(schema.mealPlans.status, 'publicado')))
        .orderBy(desc(schema.mealPlans.publishedAt))
        .limit(1),
      db.select({ last: max(schema.messages.createdAt), n: count() }).from(schema.messages).where(eq(schema.messages.patientId, pid)),
      db
        .select({ n: count() })
        .from(schema.notifications)
        .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))),
    ])
    const planSig = plan?.at ? new Date(plan.at).toISOString() : null
    return Response.json({ sig: [planSig, msg?.last ? new Date(msg.last).toISOString() : '', msg?.n ?? 0, notes?.n ?? 0].join('|'), plan: planSig }, { headers })
  }

  if (!can(user, 'clinico')) return Response.json({ sig: 'x' }, { headers })
  const p = new URL(req.url).searchParams.get('p')
  if (p && uuid.safeParse(p).success) {
    const [[msg], [diary], [readSig]] = await Promise.all([
      db.select({ last: max(schema.messages.createdAt), n: count() }).from(schema.messages).where(eq(schema.messages.patientId, p)),
      db.select({ last: max(schema.diaryEntries.createdAt), n: count() }).from(schema.diaryEntries).where(eq(schema.diaryEntries.patientId, p)),
      db
        .select({ n: count() })
        .from(schema.messages)
        .where(and(eq(schema.messages.patientId, p), eq(schema.messages.fromPatient, false), isNull(schema.messages.readAt))),
    ])
    const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : '')
    return Response.json({ sig: [iso(msg?.last), msg?.n, iso(diary?.last), diary?.n, readSig?.n].join('|') }, { headers })
  }
  const [unread] = await db
    .select({ n: count(), last: max(schema.messages.createdAt) })
    .from(schema.messages)
    .where(and(eq(schema.messages.fromPatient, true), isNull(schema.messages.readAt)))
  return Response.json({ sig: `${unread?.n ?? 0}|${unread?.last ? new Date(unread.last).toISOString() : ''}` }, { headers })
}
