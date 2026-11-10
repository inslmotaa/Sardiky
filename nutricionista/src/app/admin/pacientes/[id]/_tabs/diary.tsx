import { and, desc, eq, gte, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { adherenceSummary, plansById } from '@/lib/diary'
import { ADHERENCE_LABEL as CLASS_LABEL } from '@/lib/acompanhamento'
import { consumedOn, dayForWeekday, dayTotals, normalizePlan, quantityLabel, sortedMeals } from '@/lib/plan'
import { currentPublishedPlan } from '@/lib/patient-context'
import { addDays, fmtDay, todayIn, weekdayOf, zonedParts } from '@/lib/time'
import { fmt, pctOf } from '@/lib/nutricao'
import { commentDiary } from '@/actions/admin/patients'
import { reactDiaryEntry } from '@/actions/admin/corpo'
import Link from 'next/link'
import { DiaryList } from '@/components/DiaryList'
import { Empty, Tabs } from '@/components/ui'
import { LiveUpdates } from '@/components/pwa'

const TONE = { em_dia: 'badge--ok', dificuldade: 'badge--warn', sem_progresso: 'badge--danger' } as const

const REACTIONS = [
  ['otimo', 'Ótimo'],
  ['bom', 'Bom'],
  ['atencao', 'Atenção'],
] as const
const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export async function DiaryTab({ patient, view }: { patient: typeof schema.patients.$inferSelect; view?: string }) {
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

  const base = `/admin/pacientes/${patient.id}?aba=diario`
  const tabs = (
    <Tabs
      current={view === 'pratos' ? 'pratos' : 'registros'}
      items={[
        { key: 'registros', label: 'Registros e adesão', href: base },
        { key: 'pratos', label: 'Pratos da semana', href: `${base}&vista=pratos` },
      ]}
    />
  )

  if (view === 'pratos') {
    // Grade dos últimos 7 dias: foto de cada refeição ao lado do que estava no plano em vigor naquele dia.
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i))
    return (
      <div className="stack">
        <LiveUpdates scope={`p=${patient.id}`} intervalMs={8000} />
        {tabs}
        <p className="small muted" style={{ margin: 0 }}>
          Fotos do prato dos últimos 7 dias, por refeição, ao lado do que estava no plano. Sem estimativa automática de calorias pela foto: as calorias vêm do plano ou dos alimentos registrados.
        </p>
        <div className="plates-week" aria-label="Pratos da semana">
          {week.map((date) => {
            const inForce = planOn(date)
            const pday = inForce ? dayForWeekday(inForce, weekdayOf(date)) : null
            const dayEntries = entries.filter((x) => x.date === date)
            const meals = pday ? sortedMeals(pday) : []
            const loose = dayEntries.filter((x) => !x.mealKey && x.photoFileId)
            return (
              <section key={date} className="plates-week__day" aria-label={`Pratos de ${fmtDay(date)}`}>
                <h3 className="small" style={{ margin: 0 }}>
                  {WEEKDAY[weekdayOf(date)]}, {fmtDay(date)}
                </h3>
                <div className="plates-week__meals">
                  {meals.map((m) => {
                    const e = dayEntries.find((x) => x.mealKey === `${pday!.id}:${m.id}`)
                    const items = (m.options[0]?.items ?? []).slice(0, 5)
                    return (
                      <div key={m.id} className="plate-cell">
                        {e?.photoFileId ? (
                          <a href={`/arquivos/${e.photoFileId}`} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/arquivos/${e.photoFileId}`} alt={`Prato: ${m.name} em ${fmtDay(date)}`} loading="lazy" />
                          </a>
                        ) : (
                          <span className="plate-cell__empty">{e ? 'Registro sem foto' : 'Sem foto'}</span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <strong className="small">
                            {m.time ? `${m.time} · ` : ''}
                            {m.name}
                          </strong>
                          <ul aria-label={`No plano: ${m.name}`}>
                            {items.map((it) => (
                              <li key={it.id}>
                                {it.name} · {quantityLabel(it)}
                              </li>
                            ))}
                          </ul>
                          {e && <PlateFeedback patientId={patient.id} entry={e} />}
                        </div>
                      </div>
                    )
                  })}
                  {loose.map((e) => (
                    <div key={e.id} className="plate-cell">
                      <a href={`/arquivos/${e.photoFileId}`} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/arquivos/${e.photoFileId}`} alt={`Prato fora do plano em ${fmtDay(date)}`} loading="lazy" />
                      </a>
                      <div style={{ minWidth: 0 }}>
                        <strong className="small">{e.time} · Fora do plano</strong>
                        <p className="small muted" style={{ margin: '4px 0 0' }}>
                          {e.foods}
                        </p>
                        <PlateFeedback patientId={patient.id} entry={e} />
                      </div>
                    </div>
                  ))}
                  {meals.length === 0 && loose.length === 0 && <p className="small muted">Sem plano em vigor e sem fotos neste dia.</p>}
                </div>
              </section>
            )
          })}
        </div>
        <p className="small">
          <Link href={base}>Ver registros e adesão</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="stack">
      <LiveUpdates scope={`p=${patient.id}`} intervalMs={8000} />
      {tabs}
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

/** Reação rápida (Ótimo, Bom, Atenção) e comentário no registro: o mesmo comentário do diário que o cliente já vê. */
function PlateFeedback({ patientId, entry }: { patientId: string; entry: typeof schema.diaryEntries.$inferSelect }) {
  return (
    <>
      <div className="reactions" role="group" aria-label={`Reagir ao prato: ${entry.meal}`}>
        {REACTIONS.map(([k, label]) => (
          <form key={k} action={reactDiaryEntry.bind(null, patientId, entry.id, k)}>
            <button type="submit" aria-pressed={entry.professionalReaction === k}>
              {label}
            </button>
          </form>
        ))}
      </div>
      {entry.professionalComment ? (
        <p className="small" style={{ margin: '6px 0 0' }}>
          <strong>Seu comentário:</strong> {entry.professionalComment}
        </p>
      ) : (
        <form action={commentDiary.bind(null, patientId, entry.id)} className="row" style={{ marginTop: 6, gap: 6 }}>
          <input name="comment" placeholder="Comentar este prato" maxLength={1000} style={{ flex: 1, minWidth: 120 }} aria-label={`Comentário sobre o prato: ${entry.meal}`} />
          <button className="btn btn--sm" type="submit">
            Enviar
          </button>
        </form>
      )}
    </>
  )
}
