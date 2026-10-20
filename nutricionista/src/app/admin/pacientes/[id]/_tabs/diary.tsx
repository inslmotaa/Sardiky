import { and, eq, gte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { adherenceSummary, plansById } from '@/lib/diary'
import { ADHERENCE_LABEL as CLASS_LABEL } from '@/lib/acompanhamento'
import { consumedOn, dayForWeekday, dayTotals, normalizePlan, sortedMeals } from '@/lib/plan'
import { currentPublishedPlan } from '@/lib/patient-context'
import { addDays, fmtDay, todayIn, weekdayOf } from '@/lib/time'
import { commentDiary } from '@/actions/admin/patients'
import { DiaryList } from '@/components/DiaryList'
import { Empty } from '@/components/ui'
import { LiveUpdates } from '@/components/pwa'

const TONE = { em_dia: 'badge--ok', dificuldade: 'badge--warn', sem_progresso: 'badge--danger' } as const

export async function DiaryTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const from = addDays(today, -13)
  const [summary, plan, logs, entries] = await Promise.all([
    adherenceSummary(patient.id, today, s.timezone, { good: s.adherenceGood, low: s.adherenceLow }),
    currentPublishedPlan(patient.id),
    db.select().from(schema.mealLogs).where(and(eq(schema.mealLogs.patientId, patient.id), gte(schema.mealLogs.date, from))),
    db.select().from(schema.diaryEntries).where(and(eq(schema.diaryEntries.patientId, patient.id), gte(schema.diaryEntries.date, from))),
  ])
  const content = plan ? normalizePlan(plan.content) : null
  const plans = await plansById(logs.map((l) => l.planId).filter((v): v is string => !!v))
  const calc = content?.mode === 'calculado'

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i))
    .map((date) => {
      const l = logs.filter((x) => x.date === date)
      const e = entries.filter((x) => x.date === date).sort((a, b) => a.time.localeCompare(b.time))
      const day = content ? dayForWeekday(content, weekdayOf(date)) : null
      return {
        date,
        kcal: calc && (l.length || e.length) ? consumedOn(plans, l, e).kcal : null,
        plannedKcal: calc && day ? dayTotals(day).kcal : null,
        meals: day && (l.length || e.length) ? sortedMeals(day).map((m) => ({ name: m.name, time: m.time, status: l.find((x) => x.mealKey === `${day.id}:${m.id}`)?.status ?? null })) : [],
        entries: e,
      }
    })
    .filter((d) => d.meals.length || d.entries.length)

  return (
    <div className="stack">
      <LiveUpdates scope={`p=${patient.id}`} intervalMs={8000} />
      <div className="card row" style={{ gap: 12 }}>
        <span className={`badge ${TONE[summary.klass]}`}>{CLASS_LABEL[summary.klass]}</span>
        <span>
          Adesão nos últimos 7 dias (até ontem): <strong>{summary.pct7 != null ? `${summary.pct7}%` : '—'}</strong>
        </span>
        <span className="muted">Sequência: {summary.streak} {summary.streak === 1 ? 'dia' : 'dias'}</span>
        <span className="muted">Último registro: {summary.lastRecord ? fmtDay(summary.lastRecord) : 'nunca'}</span>
      </div>
      {days.length === 0 ? <Empty>O paciente ainda não registrou refeições nos últimos 14 dias.</Empty> : <DiaryList days={days} commentAction={commentDiary.bind(null, patient.id)} />}
    </div>
  )
}
