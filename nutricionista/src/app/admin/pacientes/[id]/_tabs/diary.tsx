import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { adherenceSummary, plansById } from '@/lib/diary'
import { ADHERENCE_LABEL as CLASS_LABEL } from '@/lib/acompanhamento'
import { consumedOn, dayForWeekday, dayTotals, normalizePlan, sortedMeals } from '@/lib/plan'
import { currentPublishedPlan } from '@/lib/patient-context'
import { addDays, fmtDay, todayIn, weekdayOf, zonedParts } from '@/lib/time'
import { fmt, pctOf } from '@/lib/nutricao'
import { commentDiary } from '@/actions/admin/patients'
import { DiaryList } from '@/components/DiaryList'
import { Empty } from '@/components/ui'
import { LiveUpdates } from '@/components/pwa'

const TONE = { em_dia: 'badge--ok', dificuldade: 'badge--warn', sem_progresso: 'badge--danger' } as const

export async function DiaryTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const from = addDays(today, -13)
  const [summary, plan, logs, entries, history] = await Promise.all([
    adherenceSummary(patient.id, today, s.timezone, { good: s.adherenceGood, low: s.adherenceLow }),
    currentPublishedPlan(patient.id),
    db.select().from(schema.mealLogs).where(and(eq(schema.mealLogs.patientId, patient.id), gte(schema.mealLogs.date, from))),
    db.select().from(schema.diaryEntries).where(and(eq(schema.diaryEntries.patientId, patient.id), gte(schema.diaryEntries.date, from))),
    // Versões publicadas (atual e anteriores): o planejado de cada dia é o do plano em vigor naquele dia.
    db
      .select({ content: schema.mealPlans.content, publishedAt: schema.mealPlans.publishedAt })
      .from(schema.mealPlans)
      .where(and(eq(schema.mealPlans.patientId, patient.id), inArray(schema.mealPlans.status, ['publicado', 'arquivado']), isNotNull(schema.mealPlans.publishedAt)))
      .orderBy(desc(schema.mealPlans.publishedAt)),
  ])
  const versions = history.map((v) => ({ from: zonedParts(v.publishedAt!, s.timezone).date, content: normalizePlan(v.content) }))
  const planOn = (date: string) => versions.find((v) => v.from <= date)?.content ?? null
  const content = plan ? normalizePlan(plan.content) : null
  const plans = await plansById(logs.map((l) => l.planId).filter((v): v is string => !!v))
  const calc = content?.mode === 'calculado'

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i))
    .map((date) => {
      const l = logs.filter((x) => x.date === date)
      const e = entries.filter((x) => x.date === date).sort((a, b) => a.time.localeCompare(b.time))
      const day = content ? dayForWeekday(content, weekdayOf(date)) : null
      const has = l.length > 0 || e.length > 0
      const real = has ? consumedOn(plans, l, e) : null
      const inForce = planOn(date)
      const dayInForce = inForce?.mode === 'calculado' ? dayForWeekday(inForce, weekdayOf(date)) : null
      const planned = dayInForce ? dayTotals(dayInForce) : null
      return {
        date,
        real,
        planned,
        kcal: real ? real.kcal : null,
        plannedKcal: planned ? planned.kcal : null,
        meals: day && (l.length || e.length) ? sortedMeals(day).map((m) => ({ name: m.name, time: m.time, status: l.find((x) => x.mealKey === `${day.id}:${m.id}`)?.status ?? null })) : [],
        entries: e,
      }
    })
  // Consumo real × planejado por dia (14 dias, inclusive os sem registro, para ver as lacunas).
  const comparison = days.filter((d) => d.planned)
  const shown = days.filter((d) => d.meals.length || d.entries.length)

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
      {comparison.length > 0 && (
        <details className="card" open>
          <summary>
            <strong>Consumo real × planejado</strong> <span className="muted small">· últimos 14 dias</span>
          </summary>
          <p className="small muted" style={{ margin: '8px 0' }}>
            Real: refeições do plano marcadas (parcial conta metade) e alimentos registrados fora do plano. Planejado: primeira opção de cada refeição do dia do plano.
          </p>
          <div className="table-wrap">
            <table aria-label="Consumo real × planejado">
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>kcal (real / plano)</th>
                  <th>Proteína (g)</th>
                  <th>Carboidrato (g)</th>
                  <th>Gordura (g)</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((d) => (
                  <tr key={d.date}>
                    <td className="nowrap">{fmtDay(d.date)}</td>
                    {d.real ? (
                      (['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => {
                        const p = pctOf(d.real![k], d.planned![k])
                        return (
                          <td key={k} className="nowrap">
                            {fmt(d.real![k], 0)} / {fmt(d.planned![k], 0)}{' '}
                            {p != null && <span className={`badge ${p < 80 ? 'badge--warn' : p > 115 ? 'badge--danger' : 'badge--ok'}`}>{p}%</span>}
                          </td>
                        )
                      })
                    ) : (
                      <td colSpan={4} className="muted small">
                        Sem registro
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {shown.length === 0 ? <Empty>O cliente ainda não registrou refeições nos últimos 14 dias.</Empty> : <DiaryList days={shown} commentAction={commentDiary.bind(null, patient.id)} />}
    </div>
  )
}
