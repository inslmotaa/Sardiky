import Link from 'next/link'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { currentPublishedPlan, getPatient } from '@/lib/patient-context'
import { latest, measurementsOf, nextAppointment } from '@/lib/patient-data'
import { dayForWeekday, itemsNutrients, normalizePlan } from '@/lib/plan'
import { waterGoalMl } from '@/lib/nutricao'
import { capitalize, fmtDateTime, fmtDay, fmtDayLong, todayIn, weekdayOf, zonedParts } from '@/lib/time'
import { changeWater, markNotificationsRead, quickWeight, setMealStatus } from '@/actions/patient'
import { TodayView, type MealLog, type TodayData } from '@/components/nutri/TodayView'
import { ActionForm, Field, SubmitButton } from '@/components/form'

export default async function PatientToday() {
  const user = await requirePatient()
  const s = await getSettings()
  const patient = await getPatient(user.patientId)
  const today = todayIn(s.timezone)
  const [plan, rows, next, notes, guidanceMsg, logs, water, diaryToday] = await Promise.all([
    currentPublishedPlan(user.patientId),
    measurementsOf(user.patientId),
    nextAppointment(user.patientId),
    db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(4),
    db
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.patientId, user.patientId), eq(schema.messages.isGuidance, true)))
      .orderBy(desc(schema.messages.createdAt))
      .limit(1),
    db.select().from(schema.mealLogs).where(and(eq(schema.mealLogs.patientId, user.patientId), eq(schema.mealLogs.date, today))),
    db.select().from(schema.waterLogs).where(and(eq(schema.waterLogs.patientId, user.patientId), eq(schema.waterLogs.date, today))),
    db
      .select({ items: schema.diaryEntries.items })
      .from(schema.diaryEntries)
      .where(and(eq(schema.diaryEntries.patientId, user.patientId), eq(schema.diaryEntries.date, today))),
  ])
  const content = plan ? normalizePlan(plan.content) : null
  const day = content ? dayForWeekday(content, weekdayOf(today)) : null
  const weight = latest(rows, 'weightKg')
  const f = patient.features

  const data: TodayData = {
    firstName: user.name.split(' ')[0],
    dateLabel: capitalize(fmtDayLong(today)) + (day && content!.days.length > 1 ? ` · ${day.label}` : ''),
    nowTime: zonedParts(new Date(), s.timezone).time,
    planTitle: plan?.title ?? null,
    mode: content?.mode ?? 'calculado',
    day,
    logs: Object.fromEntries(
      logs.filter((l) => !plan || l.planId === plan.id).map((l) => [l.mealKey, { status: l.status as MealLog['status'], optionId: l.optionId }]),
    ),
    waterMl: water[0]?.ml ?? 0,
    waterGoalMl: weight ? waterGoalMl(weight.value, s.waterMlPerKg) : 2000,
    features: { calorias: f.calorias, macros: f.macros, agua: f.agua, peso: f.peso, chat: f.chat, diario: f.diario },
    nextAppointment: next
      ? {
          when: fmtDateTime(next.startAt, s.timezone),
          label: `${next.serviceName} · ${next.modality === 'online' ? 'on-line' : 'presencial'} · ${next.status === 'confirmada' ? 'confirmada' : 'aguardando confirmação'}`,
          meetingUrl: next.modality === 'online' && next.status === 'confirmada' ? next.meetingUrl : null,
        }
      : null,
    guidance: guidanceMsg[0]?.body ?? null,
    lastWeight: weight ? { value: weight.value, date: fmtDay(weight.date) } : null,
    extraConsumed: itemsNutrients(diaryToday.flatMap((e) => e.items ?? [])),
  }

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      {notes.length > 0 && (
        <div className="card card--soft">
          <div className="card__head">
            <h2 style={{ fontSize: '1.05rem' }}>Avisos</h2>
            <form action={markNotificationsRead}>
              <button className="link-btn small" type="submit">
                Marcar como lidos
              </button>
            </form>
          </div>
          <ul className="list">
            {notes.map((n) => (
              <li key={n.id}>
                {n.link ? <Link href={n.link}>{n.title}</Link> : <strong>{n.title}</strong>}
                {n.body && <span className="muted"> — {n.body}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <TodayView
        data={data}
        actions={{ setMeal: setMealStatus, water: changeWater }}
        links={{ plan: '/paciente/plano', chat: '/paciente/mensagens', diary: '/paciente/diario', progress: '/paciente/evolucao' }}
        weightForm={
          <ActionForm action={quickWeight} className="row" resetOnSuccess>
            <Field label="Registrar peso de hoje (kg)" name="weightKg" className="span-2">
              <input name="weightKg" type="text" inputMode="decimal" placeholder="Ex.: 70,5" style={{ maxWidth: 160 }} />
            </Field>
            <div style={{ alignSelf: 'flex-end' }}>
              <SubmitButton className="btn">Salvar peso</SubmitButton>
            </div>
          </ActionForm>
        }
      />
    </div>
  )
}
