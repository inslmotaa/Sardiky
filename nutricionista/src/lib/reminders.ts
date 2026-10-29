import 'server-only'
import { and, desc, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_FEATURES, DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import { dayForWeekday, normalizePlan, sortedMeals } from './plan'
import { waterGoalMl } from './nutricao'
import { claimReminder, pushToTeam, pushToUser } from './push'
import { notifyTeam } from './team'
import { trackingBoard } from './tracking'
import { getSettings } from './settings'
import { fmtDateTime, startOfWeek, timeToMinutes, zonedParts } from './time'

/** Janela de cada lembrete: a tarefa roda a cada 5 minutos; 15 minutos de folga cobrem atrasos. */
const WINDOW_MIN = 15

const inWindow = (nowMin: number, atMin: number) => nowMin >= atMin && nowMin < atMin + WINDOW_MIN

/**
 * Lembretes por push. Cada lembrete é registrado (reminder_log) e nunca sai duas vezes;
 * preferências e horário de silêncio de cada paciente são respeitados em pushToUser.
 */
export async function runReminders(now = new Date()) {
  const s = await getSettings()
  const tz = s.timezone
  const z = zonedParts(now, tz)
  const today = z.date
  const nowMin = timeToMinutes(z.time)
  const out = { refeicoes: 0, agua: 0, pesagem: 0, inativos: 0, consultas: 0 }

  const patients = await db
    .select({ p: schema.patients, prefs: schema.users.notificationPrefs })
    .from(schema.patients)
    .innerJoin(schema.users, eq(schema.users.id, schema.patients.userId))
    .where(and(eq(schema.patients.status, 'ativo'), eq(schema.users.isActive, true)))
  if (patients.length) {
    const ids = patients.map((x) => x.p.id)
    const [plans, logs, water, weights] = await Promise.all([
      db
        .select({ patientId: schema.mealPlans.patientId, content: schema.mealPlans.content, publishedAt: schema.mealPlans.publishedAt })
        .from(schema.mealPlans)
        .where(and(inArray(schema.mealPlans.patientId, ids), eq(schema.mealPlans.status, 'publicado')))
        .orderBy(desc(schema.mealPlans.publishedAt)),
      db.select().from(schema.mealLogs).where(and(inArray(schema.mealLogs.patientId, ids), eq(schema.mealLogs.date, today))),
      db.select().from(schema.waterLogs).where(and(inArray(schema.waterLogs.patientId, ids), eq(schema.waterLogs.date, today))),
      db
        .select({ patientId: schema.measurements.patientId, kg: schema.measurements.weightKg })
        .from(schema.measurements)
        .where(and(inArray(schema.measurements.patientId, ids), isNotNull(schema.measurements.weightKg)))
        .orderBy(desc(schema.measurements.date)),
    ])

    for (const { p, prefs: raw } of patients) {
      const userId = p.userId!
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...raw }
      const features = { ...DEFAULT_FEATURES, ...p.features }
      const planRow = plans.find((x) => x.patientId === p.id)
      const send = (kind: Parameters<typeof pushToUser>[1], payload: Parameters<typeof pushToUser>[2]) => pushToUser(userId, kind, payload, { nowHHMM: z.time })

      // 1. Horário de cada refeição do plano (se ainda não foi marcada).
      if (planRow && prefs.refeicoes) {
        const plan = normalizePlan(planRow.content)
        const day = dayForWeekday(plan, z.weekday)
        for (const m of day ? sortedMeals(day) : []) {
          if (!m.time || !inWindow(nowMin, timeToMinutes(m.time))) continue
          const key = `${day.id}:${m.id}`
          if (logs.some((l) => l.patientId === p.id && l.mealKey === key)) continue
          if (!(await claimReminder(userId, 'refeicao', `${today}:${key}`))) continue
          const items = (m.options[0]?.items ?? []).slice(0, 3).map((i) => i.name.split(',')[0])
          if (await send('refeicoes', { title: `${m.name} · ${m.time.replace(':', 'h')}`, body: items.length ? items.join(', ') : 'Veja o que está no seu plano.', url: '/paciente', tag: 'refeicao' }))
            out.refeicoes++
        }
      }

      // 2. Água a cada N horas dentro da janela combinada (para quando a meta do dia já foi batida).
      if (features.agua && prefs.agua) {
        const start = timeToMinutes(prefs.waterStart)
        const end = timeToMinutes(prefs.waterEnd)
        const every = prefs.waterEveryH * 60
        if (nowMin >= start && nowMin < end) {
          const slot = Math.floor((nowMin - start) / every)
          if (slot > 0 && inWindow(nowMin, start + slot * every)) {
            const kg = weights.find((w) => w.patientId === p.id)?.kg
            const goal = kg ? waterGoalMl(kg, s.waterMlPerKg) : 2000
            const drank = water.find((w) => w.patientId === p.id)?.ml ?? 0
            if (drank < goal && (await claimReminder(userId, 'agua', `${today}:${slot}`))) {
              const left = goal - drank
              if (await send('agua', { title: 'Hora de beber água 💧', body: `Faltam cerca de ${Math.ceil(left / 250)} copos para a meta de hoje.`, url: '/paciente', tag: 'agua' })) out.agua++
            }
          }
        }
      }

      // 3. Pesagem semanal: segunda-feira de manhã.
      if (features.peso && prefs.pesagem && z.weekday === 1 && nowMin >= 7 * 60 && nowMin < 10 * 60) {
        if (await claimReminder(userId, 'pesagem', startOfWeek(today)))
          if (await send('pesagem', { title: 'Pesagem da semana', body: 'Se puder, pese-se em jejum e registre no app.', url: '/paciente#peso', tag: 'pesagem' })) out.pesagem++
      }
    }

    // 4. Sem registrar há 3 dias: lembrete gentil ao paciente e alerta à equipe (uma vez por período parado).
    if (nowMin >= 10 * 60 && nowMin < 20 * 60) {
      const board = await trackingBoard(today, tz, { good: s.adherenceGood, low: s.adherenceLow })
      for (const r of board) {
        if (!r.hasAccess || !r.hasPlan || r.daysWithout == null || r.daysWithout < 3) continue
        const pt = patients.find((x) => x.p.id === r.id)
        if (!pt) continue
        const userId = pt.p.userId!
        if (!(await claimReminder(userId, 'inativo', r.lastRecord ?? 'nunca'))) continue
        await pushToUser(userId, 'lembretes', { title: 'Sentimos sua falta 💚', body: 'Que tal registrar como foram as refeições de hoje? Tudo bem se a semana foi corrida.', url: '/paciente/diario', tag: 'inativo' }, { nowHHMM: z.time })
        await notifyTeam('clinico', 'Cliente sem registrar há 3 dias ou mais', r.name, `/admin/pacientes/${r.id}?aba=diario`, r.id)
        await pushToTeam('clinico', { title: 'Cliente sem registrar', body: `${r.name} · há ${r.daysWithout} dias`, url: `/admin/acompanhamento?grupo=sem_progresso`, tag: `inativo-${r.id}` }, r.id)
        out.inativos++
      }
    }
  }

  // 5. Consultas confirmadas em 24 h e em 2 h: paciente e equipe.
  const appts = await db
    .select({ a: schema.appointments, userId: schema.patients.userId })
    .from(schema.appointments)
    .leftJoin(schema.patients, eq(schema.patients.id, schema.appointments.patientId))
    .where(and(eq(schema.appointments.status, 'confirmada'), gte(schema.appointments.startAt, now), lt(schema.appointments.startAt, new Date(now.getTime() + 24 * 3_600_000))))
  for (const { a, userId } of appts) {
    const hours = (a.startAt.getTime() - now.getTime()) / 3_600_000
    const which = hours <= 2 ? '2h' : '24h'
    const owner = userId ?? null
    // Chave por consulta e janela (24 h ou 2 h); a equipe usa o registro do primeiro administrador.
    const claimFor = owner ?? (await firstAdminId())
    if (!claimFor || !(await claimReminder(claimFor, `consulta${which}`, a.id))) continue
    const when = fmtDateTime(a.startAt, tz)
    if (owner)
      await pushToUser(owner, 'consultas', { title: which === '2h' ? 'Sua consulta é daqui a pouco' : 'Lembrete: consulta amanhã', body: `${a.serviceName} · ${when}${a.modality === 'online' ? ' · on-line' : ''}`, url: '/paciente/consultas', tag: `consulta-${a.id}` }, { nowHHMM: z.time })
    await pushToTeam('agenda', { title: `Consulta em ${which === '2h' ? '2 horas' : '24 horas'}`, body: `${a.contactName} · ${when}`, url: `/admin/agenda/${a.id}`, tag: `consulta-${a.id}` }, a.patientId)
    out.consultas++
  }
  return out
}

let adminId: string | null | undefined
async function firstAdminId() {
  if (adminId !== undefined) return adminId
  const [u] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, 'admin')).limit(1)
  adminId = u?.id ?? null
  return adminId
}
