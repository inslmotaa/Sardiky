import { timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gte, inArray, isNull, lt, ne, or } from 'drizzle-orm'
import { runReminders } from '@/lib/reminders'
import { db, schema } from '@/db'
import { audit } from '@/lib/audit'
import { integrationStatus } from '@/lib/integrations'
import { renderTemplate, sendEmail } from '@/lib/notify'
import { getSettings } from '@/lib/settings'
import { fmtDay, zonedParts } from '@/lib/time'

/**
 * Tarefas periódicas — agende uma chamada a cada 5 minutos:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://seusite/api/cron
 * 1. Lembretes por push: refeições, água, pesagem semanal, pacientes parados há 3 dias, consultas em 24 h e 2 h.
 * 2. Lembrete de consulta por e-mail na véspera (se o e-mail estiver configurado).
 * 3. Limpeza (no máximo uma vez por hora): sessões e links expirados; interessados não convertidos além do prazo de retenção.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response('Não autorizado', { status: 401 })
  }
  const s = await getSettings()
  const now = new Date()
  let reminders = 0
  const push = await runReminders(now)

  if (integrationStatus().email) {
    const due = await db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.status, 'confirmada'),
          isNull(schema.appointments.reminderSentAt),
          gte(schema.appointments.startAt, now),
          lt(schema.appointments.startAt, new Date(now.getTime() + 26 * 3_600_000)),
        ),
      )
    for (const a of due) {
      const p = zonedParts(a.startAt, s.timezone)
      const ok = await sendEmail(
        a.contactEmail,
        'Lembrete de consulta',
        renderTemplate(s.templates.lembrete, { nome: a.contactName.split(' ')[0], data: fmtDay(p.date), hora: p.time, servico: a.serviceName, codigo: a.code }),
      )
      if (ok) {
        await db.update(schema.appointments).set({ reminderSentAt: new Date() }).where(eq(schema.appointments.id, a.id))
        reminders++
      }
    }
    // Lembrete 2 horas antes (com o link da videochamada, se for on-line).
    const soon = await db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.status, 'confirmada'),
          isNull(schema.appointments.reminder2hSentAt),
          gte(schema.appointments.startAt, now),
          lt(schema.appointments.startAt, new Date(now.getTime() + 2 * 3_600_000 + 15 * 60_000)),
        ),
      )
    for (const a of soon) {
      const p = zonedParts(a.startAt, s.timezone)
      const ok = await sendEmail(
        a.contactEmail,
        'Sua consulta é daqui a pouco',
        `Olá, ${a.contactName.split(' ')[0]}! Lembrete: sua consulta (${a.serviceName}) é hoje às ${p.time}.${a.meetingUrl ? `\nLink da videochamada: ${a.meetingUrl}` : ''}`,
      )
      if (ok) {
        await db.update(schema.appointments).set({ reminder2hSentAt: new Date() }).where(eq(schema.appointments.id, a.id))
        reminders++
      }
    }
  }

  // A limpeza roda no máximo uma vez por hora.
  const [lastRun] = await db
    .select({ at: schema.auditLogs.createdAt })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.action, 'tarefas_periodicas'))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1)
  if (lastRun && now.getTime() - lastRun.at.getTime() < 55 * 60_000) {
    return Response.json({ lembretesEmail: reminders, push })
  }

  const sessions = await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).returning({ id: schema.sessions.id })
  const tokens = await db
    .delete(schema.authTokens)
    .where(or(lt(schema.authTokens.expiresAt, now), lt(schema.authTokens.createdAt, new Date(now.getTime() - 30 * 86_400_000))))
    .returning({ id: schema.authTokens.id })
  const leads = await db
    .delete(schema.leads)
    .where(and(ne(schema.leads.status, 'convertido'), lt(schema.leads.createdAt, new Date(now.getTime() - s.leadRetentionDays * 86_400_000))))
    .returning({ id: schema.leads.id })
  // Pedidos de agendamento pendentes que já passaram liberam o horário.
  const stale = await db
    .update(schema.appointments)
    .set({ status: 'cancelada', cancelReason: 'Pedido não confirmado antes do horário' })
    .where(and(inArray(schema.appointments.status, ['pendente']), lt(schema.appointments.startAt, now)))
    .returning({ id: schema.appointments.id })

  const result = { lembretesEmail: reminders, push, sessoesRemovidas: sessions.length, linksRemovidos: tokens.length, interessadosEliminados: leads.length, pedidosExpirados: stale.length }
  await audit(null, 'tarefas_periodicas', 'sistema', { details: result })
  return Response.json(result)
}
