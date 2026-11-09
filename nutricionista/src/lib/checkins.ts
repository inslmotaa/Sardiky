import 'server-only'
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { addDays, todayIn, zonedParts } from './time'
import { getSettings } from './settings'
import { claimReminder, pushToUser } from './push'
import { notifyUser } from './notify'
import { CHECKIN_OPEN_DAYS } from './checkin-rules'

/**
 * Agenda os check-ins de um cliente: grava a frequência e o próximo prazo e mantém um único
 * check-in pendente (o do prazo atual). Com `every` vazio, desliga e apaga os pendentes.
 */
export async function scheduleCheckins(patientId: string, every: number | null, firstDue: string | null) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.checkins).where(and(eq(schema.checkins.patientId, patientId), eq(schema.checkins.status, 'pendente')))
    await tx
      .update(schema.patients)
      .set({ checkinEveryDays: every, nextCheckinDue: every ? firstDue : null, updatedAt: new Date() })
      .where(eq(schema.patients.id, patientId))
    if (every && firstDue) await tx.insert(schema.checkins).values({ patientId, dueDate: firstDue }).onConflictDoNothing()
  })
}

/** Check-in pendente do cliente (o mais antigo) e os últimos enviados. */
export async function checkinsOf(patientId: string, limit = 12) {
  const rows = await db.select().from(schema.checkins).where(eq(schema.checkins.patientId, patientId)).orderBy(desc(schema.checkins.dueDate)).limit(limit + 1)
  const pending = rows.filter((r) => r.status === 'pendente').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null
  return { pending, sent: rows.filter((r) => r.status === 'enviado').slice(0, limit) }
}

/** Check-ins atrasados (prazo vencido e ainda não enviados), para o Acompanhamento e o Início do painel. */
export async function overdueCheckins(today: string, patientIds?: string[]) {
  if (patientIds && patientIds.length === 0) return []
  return db
    .select({
      id: schema.checkins.id,
      dueDate: schema.checkins.dueDate,
      patientId: schema.patients.id,
      name: schema.patients.fullName,
      phone: schema.patients.phone,
      every: schema.patients.checkinEveryDays,
    })
    .from(schema.checkins)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.checkins.patientId))
    .where(
      and(
        eq(schema.checkins.status, 'pendente'),
        lt(schema.checkins.dueDate, today),
        eq(schema.patients.status, 'ativo'),
        ...(patientIds ? [inArray(schema.patients.id, patientIds)] : []),
      ),
    )
    .orderBy(asc(schema.checkins.dueDate))
}

/** Check-ins enviados e ainda não vistos pelo coach. */
export async function unreviewedCheckins(patientIds?: string[]) {
  if (patientIds && patientIds.length === 0) return []
  return db
    .select({ id: schema.checkins.id, patientId: schema.patients.id, name: schema.patients.fullName, submittedAt: schema.checkins.submittedAt })
    .from(schema.checkins)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.checkins.patientId))
    .where(
      and(
        eq(schema.checkins.status, 'enviado'),
        isNull(schema.checkins.reviewedAt),
        ...(patientIds ? [inArray(schema.patients.id, patientIds)] : []),
      ),
    )
    .orderBy(desc(schema.checkins.submittedAt))
}

/**
 * Lembretes por push (e aviso no app), uma vez cada: quando o check-in abre, no dia do prazo e no
 * dia seguinte, se atrasou. Chamado pela tarefa periódica (/api/cron).
 */
export async function checkinReminders(now = new Date()) {
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const rows = await db
    .select({ id: schema.checkins.id, dueDate: schema.checkins.dueDate, userId: schema.patients.userId })
    .from(schema.checkins)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.checkins.patientId))
    .where(
      and(
        eq(schema.checkins.status, 'pendente'),
        eq(schema.patients.status, 'ativo'),
        lte(schema.checkins.dueDate, addDays(today, CHECKIN_OPEN_DAYS)),
        gt(schema.checkins.dueDate, addDays(today, -2)),
      ),
    )
  let sent = 0
  for (const r of rows) {
    if (!r.userId) continue
    const kind = r.dueDate === addDays(today, CHECKIN_OPEN_DAYS) ? 'abriu' : r.dueDate === today ? 'prazo' : r.dueDate === addDays(today, -1) ? 'atrasou' : null
    if (!kind || !(await claimReminder(r.userId, 'checkin', `${r.id}:${kind}`))) continue
    const body =
      kind === 'abriu'
        ? 'Seu check-in está aberto: conte como foram os últimos dias, com peso e medidas.'
        : kind === 'prazo'
          ? 'Hoje é o prazo do seu check-in. Leva poucos minutos.'
          : 'Seu check-in ficou para trás. Responda assim que puder para o coach ajustar o plano.'
    await notifyUser(r.userId, 'Check-in', body, '/paciente/checkin')
    await pushToUser(r.userId, 'lembretes', { title: 'Check-in', body, url: '/paciente/checkin', tag: `checkin-${r.id}` }, { nowHHMM: zonedParts(now, s.timezone).time })
    sent++
  }
  return sent
}
