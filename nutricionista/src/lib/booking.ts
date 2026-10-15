import 'server-only'
import { and, eq, gt, inArray, lt, ne, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { availableSlots, BLOCKING_STATUSES, overlaps, withBuffer, type Interval } from './scheduling'
import { addDays, zonedToUtc } from './time'
import { getSettings, getWorkingHours } from './settings'
import { UserError } from './action'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Intervalos ocupados (consultas ativas e bloqueios) que tocam o período. */
export async function busyIntervals(from: Date, to: Date, exceptAppointmentId?: string, tx: Tx | typeof db = db): Promise<Interval[]> {
  const appts = await tx
    .select({ start: schema.appointments.startAt, end: schema.appointments.endAt })
    .from(schema.appointments)
    .where(
      and(
        inArray(schema.appointments.status, [...BLOCKING_STATUSES]),
        lt(schema.appointments.startAt, to),
        gt(schema.appointments.endAt, from),
        exceptAppointmentId ? ne(schema.appointments.id, exceptAppointmentId) : undefined,
      ),
    )
  const blocks = await tx
    .select({ start: schema.timeBlocks.startAt, end: schema.timeBlocks.endAt })
    .from(schema.timeBlocks)
    .where(and(lt(schema.timeBlocks.startAt, to), gt(schema.timeBlocks.endAt, from)))
  return [...appts, ...blocks]
}

export async function slotsForDay(day: string, durationMinutes: number) {
  const s = await getSettings()
  const windows = await getWorkingHours()
  const from = zonedToUtc(day, '00:00', s.timezone)
  const to = zonedToUtc(addDays(day, 1), '00:00', s.timezone)
  const busy = await busyIntervals(new Date(from.getTime() - 86_400_000), new Date(to.getTime() + 86_400_000))
  return availableSlots({
    day,
    durationMinutes,
    stepMinutes: s.slotStepMinutes,
    bufferMinutes: s.bufferMinutes,
    minNoticeHours: s.minNoticeHours,
    maxDaysAhead: s.maxDaysAhead,
    windows,
    busy,
    now: new Date(),
    tz: s.timezone,
  })
}

/**
 * Garante, dentro de uma transação, que o intervalo continua livre.
 * O bloqueio da linha de configurações serializa agendamentos concorrentes,
 * impedindo que duas pessoas reservem o mesmo horário ao mesmo tempo.
 */
export async function assertFree(tx: Tx, start: Date, end: Date, bufferMinutes: number, exceptAppointmentId?: string) {
  await tx.execute(sql`select id from settings where id = 1 for update`)
  const busy = await busyIntervals(new Date(start.getTime() - 86_400_000), new Date(end.getTime() + 86_400_000), exceptAppointmentId, tx)
  if (busy.some((b) => overlaps({ start, end }, withBuffer(b, bufferMinutes)))) {
    throw new UserError('Este horário acabou de ser ocupado ou está bloqueado. Escolha outro horário.')
  }
}

export async function getService(id: string) {
  const [svc] = await db.select().from(schema.services).where(and(eq(schema.services.id, id), eq(schema.services.active, true)))
  return svc ?? null
}

/** Horários livres de vários dias com uma única consulta ao banco. */
export async function slotsForRange(fromDay: string, days: number, durationMinutes: number) {
  const s = await getSettings()
  const windows = await getWorkingHours()
  const from = zonedToUtc(fromDay, '00:00', s.timezone)
  const to = zonedToUtc(addDays(fromDay, days + 1), '00:00', s.timezone)
  const busy = await busyIntervals(new Date(from.getTime() - 86_400_000), to)
  const now = new Date()
  const result: { day: string; slots: Date[] }[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(fromDay, i)
    result.push({
      day,
      slots: availableSlots({
        day,
        durationMinutes,
        stepMinutes: s.slotStepMinutes,
        bufferMinutes: s.bufferMinutes,
        minNoticeHours: s.minNoticeHours,
        maxDaysAhead: s.maxDaysAhead,
        windows,
        busy,
        now,
        tz: s.timezone,
      }),
    })
  }
  return result
}
