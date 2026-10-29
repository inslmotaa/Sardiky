import Link from 'next/link'
import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { currentPublishedPlan, getPatient } from '@/lib/patient-context'
import { latest, measurementsOf, nextAppointment, series } from '@/lib/patient-data'
import { currentDraft } from '@/lib/anamnese-store'
import { dayForWeekday, itemsNutrients, normalizePlan } from '@/lib/plan'
import { waterGoalMl } from '@/lib/nutricao'
import { capitalize, fmtDateTime, fmtDay, fmtDayLong, todayIn, weekdayOf, zonedParts } from '@/lib/time'
import { bookingLink } from '@/lib/format'
import { changeWater, markNotificationsRead, quickWeight, setMealStatus } from '@/actions/patient'
import { TodayView, type MealLog, type TodayData } from '@/components/nutri/TodayView'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { LineChart } from '@/components/LineChart'
import { FadeUp, MotionRoot, Stagger, StaggerItem } from '@/components/motion'
import { IlloCalendar, IlloLeaf, IlloPlate, IlloScale } from '@/components/Illustrations'
import { IconBook, IconCalendar, IconChart, IconChat, IconPlate } from '@/components/icons'

const STEPS = ['Conta criada', 'Anamnese', 'Consulta', 'Plano alimentar', 'Acompanhamento'] as const

export default async function PatientToday({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requirePatient()
  const s = await getSettings()
  const patient = await getPatient(user.patientId)
  const today = todayIn(s.timezone)
  const [plan, rows, next, notes, guidanceMsg, logs, water, diaryToday, draft, done, logsEver, pkg] = await Promise.all([
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
    db
      .select()
      .from(schema.mealLogs)
      .where(and(eq(schema.mealLogs.patientId, user.patientId), eq(schema.mealLogs.date, today))),
    db
      .select()
      .from(schema.waterLogs)
      .where(and(eq(schema.waterLogs.patientId, user.patientId), eq(schema.waterLogs.date, today))),
    db
      .select({ items: schema.diaryEntries.items })
      .from(schema.diaryEntries)
      .where(and(eq(schema.diaryEntries.patientId, user.patientId), eq(schema.diaryEntries.date, today))),
    currentDraft(user.patientId),
    db
      .select({ n: count() })
      .from(schema.appointments)
      .where(and(eq(schema.appointments.patientId, user.patientId), eq(schema.appointments.status, 'realizada'))),
    db.select({ n: count() }).from(schema.mealLogs).where(eq(schema.mealLogs.patientId, user.patientId)),
    patient.packageId ? db.select().from(schema.packages).where(eq(schema.packages.id, patient.packageId)) : [],
  ])
  const content = plan ? normalizePlan(plan.content) : null
  const day = content ? dayForWeekday(content, weekdayOf(today)) : null
  const weight = latest(rows, 'weightKg')
  const f = patient.features
  const booking = bookingLink(s, 'Olá! Gostaria de agendar uma consulta.')

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
          label: `${next.serviceName} · $on-line · ${next.status === 'confirmada' ? 'confirmada' : 'aguardando confirmação'}`,
          meetingUrl: next.modality === 'online' && next.status === 'confirmada' ? next.meetingUrl : null,
        }
      : null,
    guidance: guidanceMsg[0]?.body ?? null,
    lastWeight: weight ? { value: weight.value, date: fmtDay(weight.date) } : null,
    extraConsumed: itemsNutrients(diaryToday.flatMap((e) => e.items ?? [])),
  }

  // Etapas do acompanhamento: a primeira não concluída é a atual.
  const anamnesisDone = Boolean(patient.anamnesisReceivedAt) && !draft
  const doneSteps = [true, anamnesisDone, done[0].n > 0 || Boolean(plan), Boolean(plan), Boolean(plan) && logsEver[0].n > 0]
  // Tudo concluído: a etapa atual é o próprio acompanhamento.
  const pendingStep = doneSteps.findIndex((d) => !d)
  const current = pendingStep === -1 ? STEPS.length - 1 : pendingStep
  const days = next ? Math.max(0, Math.round((Date.parse(zonedParts(next.startAt, s.timezone).date) - Date.parse(today)) / 86_400_000)) : null
  const weights = series(rows, 'weightKg').slice(-8)
  const firstName = user.name.split(' ')[0]

  return (
    <MotionRoot>
      <div className="hub">
        {!anamnesisDone && (
          <div className="hub-banner" role="status">
            <span>
              {draft && draft.version > 1 ? 'O André pediu uma reavaliação: atualize sua anamnese.' : 'Falta só sua anamnese para começarmos.'}
            </span>
            <Link href="/paciente/anamnese" className="btn btn--light btn--sm">
              {draft && draft.step > 0 ? 'Continuar anamnese' : 'Preencher agora'}
            </Link>
          </div>
        )}
        {sp.anamnese === 'salva' && <p className="alert alert--ok">Anamnese salva. Continue quando quiser, de onde parou.</p>}

        <FadeUp className="card hub-hello">
          <div>
            <h1>Olá, {firstName}!</h1>
            <p className="muted" style={{ margin: 0 }}>
              {data.dateLabel}
            </p>
          </div>
          {s.dailyQuote && (
            <blockquote className="hub-quote">
              “{s.dailyQuote}”<cite>— {s.professionalName.split(' ')[0]}</cite>
            </blockquote>
          )}
        </FadeUp>

        {/* Atalhos para o que se faz todo dia: o caminho mais curto para cada tarefa. */}
        <nav className="hub-shortcuts" aria-label="Atalhos">
          <Link href="/paciente/plano">
            <IconPlate />
            <span>
              <strong>Meu plano</strong>
              <small>Refeições e substituições</small>
            </span>
          </Link>
          {f.diario && (
            <Link href="/paciente/diario">
              <IconBook />
              <span>
                <strong>Registrar refeição</strong>
                <small>Diário com foto</small>
              </span>
            </Link>
          )}
          <Link href="/paciente/evolucao">
            <IconChart />
            <span>
              <strong>Meu progresso</strong>
              <small>Peso, medidas e metas</small>
            </span>
          </Link>
          {f.chat && (
            <Link href="/paciente/mensagens">
              <IconChat />
              <span>
                <strong>Falar com o coach</strong>
                <small>Tire dúvidas pelo chat</small>
              </span>
            </Link>
          )}
        </nav>

        {notes.length > 0 && (
          <FadeUp className="card card--soft">
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
          </FadeUp>
        )}

        <FadeUp className="card hub-status">
          <div className="hub-status__top">
            <div>
              <span className="eyebrow">Seu acompanhamento</span>
              <p className="hub-status__plan">{pkg[0] ? `Plano ${pkg[0].name}` : 'Nenhum plano contratado ainda'}</p>
              {!pkg[0] && (
                <Link href="/planos" className="small">
                  Ver planos
                </Link>
              )}
            </div>
            <div className="hub-status__days">
              {days === null ? (
                <span className="muted small">Sem consulta marcada</span>
              ) : (
                <>
                  <strong>{days === 0 ? 'Hoje' : days}</strong>
                  <span className="small muted">{days === 0 ? 'é dia de consulta' : days === 1 ? 'dia até a consulta' : 'dias até a consulta'}</span>
                </>
              )}
            </div>
          </div>
          <p className="hub-steps__now">
            Etapa atual: <strong>{STEPS[current]}</strong>
          </p>
          <ol className="hub-steps" aria-label="Etapas do acompanhamento">
            {STEPS.map((label, i) => (
              <li
                key={label}
                data-state={i === current ? 'current' : doneSteps[i] ? 'done' : 'todo'}
                aria-current={i === current ? 'step' : undefined}
              >
                <span className="hub-steps__dot" aria-hidden>
                  {doneSteps[i] && i !== current ? '✓' : i + 1}
                </span>
                <span className="hub-steps__label">{label}</span>
              </li>
            ))}
          </ol>
        </FadeUp>

        <Stagger className="hub-grid">
          <StaggerItem className="card hub-card">
            <h2>Próxima consulta</h2>
            {next ? (
              <>
                <p className="hub-big">{fmtDateTime(next.startAt, s.timezone)}</p>
                <p className="muted" style={{ margin: 0 }}>
                  {next.serviceName} · on-line · {next.status === 'confirmada' ? 'confirmada' : 'aguardando confirmação'}
                </p>
                <div className="row" style={{ marginTop: 12 }}>
                  {next.modality === 'online' && next.status === 'confirmada' && next.meetingUrl && (
                    <a href={next.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm">
                      Entrar na videochamada
                    </a>
                  )}
                  <a href={`/paciente/consultas/${next.id}/agenda.ics`} className="btn btn--sm">
                    <IconCalendar /> Adicionar à agenda
                  </a>
                  <Link href="/paciente/consultas" className="btn btn--sm btn--ghost">
                    Remarcar
                  </Link>
                </div>
              </>
            ) : (
              <div className="hub-empty">
                <IlloCalendar />
                <p>Você ainda não tem consulta marcada.</p>
                <a
                  href={booking.href}
                  className="btn btn--primary btn--sm btn--fx"
                  {...(booking.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  Agendar consulta
                </a>
              </div>
            )}
          </StaggerItem>

          {f.peso && (
            <StaggerItem className="card hub-card">
              <h2>Peso</h2>
              {weights.length > 0 ? (
                <div className="hub-chart">
                  <LineChart title="Peso" points={weights} unit="kg" height={150} />
                </div>
              ) : (
                <div className="hub-empty">
                  <IlloScale />
                  <p>Registre seu peso para acompanhar a evolução por aqui.</p>
                </div>
              )}
              <ActionForm action={quickWeight} className="row" resetOnSuccess>
                <Field label="Registrar peso de hoje (kg)" name="weightKg" className="span-2">
                  <input name="weightKg" type="text" inputMode="decimal" placeholder="Ex.: 70,5" style={{ maxWidth: 160 }} />
                </Field>
                <div style={{ alignSelf: 'flex-end' }}>
                  <SubmitButton className="btn">Salvar peso</SubmitButton>
                </div>
              </ActionForm>
            </StaggerItem>
          )}
        </Stagger>

        <FadeUp>
          <h2 className="hub-title">Seu plano alimentar de hoje</h2>
          <TodayView
            data={data}
            variant="hub"
            actions={{ setMeal: setMealStatus, water: changeWater }}
            links={{ plan: '/paciente/plano', chat: '/paciente/mensagens', diary: '/paciente/diario', progress: '/paciente/evolucao' }}
            emptyPlan={
              <section className="card hub-empty hub-empty--big">
                <IlloPlate />
                <h3>Seu plano está sendo preparado pelo André</h3>
                <p className="muted">Assim que ele for liberado, você vê aqui a próxima refeição e pode marcar o que comeu.</p>
                {!anamnesisDone ? (
                  <Link href="/paciente/anamnese" className="btn btn--primary btn--sm">
                    Preencher anamnese
                  </Link>
                ) : f.chat ? (
                  <Link href="/paciente/mensagens" className="btn btn--sm">
                    Falar com o André
                  </Link>
                ) : null}
              </section>
            }
          />
        </FadeUp>

        <FadeUp className="card hub-tip">
          <IlloLeaf />
          <div>
            <h2>Dica da semana</h2>
            {s.weeklyTip ? (
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{s.weeklyTip}</p>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Toda semana o André deixa uma dica aqui. Enquanto isso, que tal registrar a água de hoje?
              </p>
            )}
            {data.guidance && (
              <p className="small" style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>
                <strong>Orientação para você:</strong> {data.guidance}
              </p>
            )}
          </div>
        </FadeUp>
      </div>
    </MotionRoot>
  )
}
