import Link from 'next/link'
import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { getSettings } from '@/lib/settings'
import { currentPublishedPlan, getPatient } from '@/lib/patient-context'
import { latest, measurementsOf, series } from '@/lib/patient-data'
import { currentDraft } from '@/lib/anamnese-store'
import { dayForWeekday, itemsNutrients, normalizePlan } from '@/lib/plan'
import { waterGoalMl } from '@/lib/nutricao'
import { capitalize, fmtDateTime, fmtDay, fmtDayLong, todayIn, weekdayOf, zonedParts } from '@/lib/time'
import { contractInfo } from '@/lib/contract'
import { checkinsOf } from '@/lib/checkins'
import { checkinState } from '@/lib/checkin-rules'
import { contactOptionsFor } from '@/lib/contact-options'
import { calendarOutdated } from '@/lib/lembretes'
import { ContactOptions } from '@/components/ContactOptions'
import { changeWater, markNotificationsRead, quickWeight, setMealStatus } from '@/actions/patient'
import { saveLoosePhoto, savePlatePhoto } from '@/actions/corpo'
import { bodyProfile } from '@/lib/corpo-server'
import { BodyCard } from '@/components/BodyCard'
import { TodayView, type MealLog, type TodayData } from '@/components/nutri/TodayView'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { LineChart } from '@/components/LineChart'
import { FadeUp, MotionRoot, Stagger, StaggerItem } from '@/components/motion'
import { IlloLeaf, IlloPlate, IlloScale } from '@/components/Illustrations'

const STEPS = ['Plano contratado', 'Anamnese', 'Avaliação e metas', 'Plano no app', 'Acompanhamento'] as const

export default async function PatientToday({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requireActivePatient()
  const s = await getSettings()
  const patient = await getPatient(user.patientId)
  const today = todayIn(s.timezone)
  const [plan, rows, notes, guidanceMsg, logs, water, diaryToday, draft, logsEver, pkg] = await Promise.all([
    currentPublishedPlan(user.patientId),
    measurementsOf(user.patientId),
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
      .select({ items: schema.diaryEntries.items, mealKey: schema.diaryEntries.mealKey, photoFileId: schema.diaryEntries.photoFileId })
      .from(schema.diaryEntries)
      .where(and(eq(schema.diaryEntries.patientId, user.patientId), eq(schema.diaryEntries.date, today))),
    currentDraft(user.patientId),
    db.select({ n: count() }).from(schema.mealLogs).where(eq(schema.mealLogs.patientId, user.patientId)),
    patient.packageId ? db.select().from(schema.packages).where(eq(schema.packages.id, patient.packageId)) : [],
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
    guidance: guidanceMsg[0]?.body ?? null,
    lastWeight: weight ? { value: weight.value, date: fmtDay(weight.date) } : null,
    extraConsumed: itemsNutrients(diaryToday.flatMap((e) => e.items ?? [])),
    platePhotos: Object.fromEntries(diaryToday.filter((e) => e.mealKey && e.photoFileId).map((e) => [e.mealKey!, `/arquivos/${e.photoFileId}`])),
  }

  // Etapas do acompanhamento: a primeira não concluída é a atual.
  const anamnesisDone = Boolean(patient.anamnesisReceivedAt) && !draft
  // Avaliação feita: medida registrada pelo coach (a avaliação por videochamada é combinada pelo WhatsApp).
  const evaluated = rows.some((r) => r.source === 'profissional') || Boolean(plan)
  const doneSteps = [Boolean(patient.packageId) || !patient.paymentRequired, anamnesisDone, evaluated, Boolean(plan), Boolean(plan) && logsEver[0].n > 0]
  // Tudo concluído: a etapa atual é o próprio acompanhamento.
  const pendingStep = doneSteps.findIndex((d) => !d)
  const current = pendingStep === -1 ? STEPS.length - 1 : pendingStep
  const weights = series(rows, 'weightKg').slice(-8)
  const firstName = user.name.split(' ')[0]

  // Renovação: faltando até 7 dias para o fim do plano (ou já encerrado), cartão com o botão Renovar.
  const contract = pkg[0] ? contractInfo(pkg[0], patient.packageStart, patient.packageEnd, today) : null
  const renew = contract?.daysLeft != null && contract.daysLeft <= 7 ? contract : null
  // Check-in periódico aberto ou atrasado: cartão com o prazo.
  const { pending: checkin } = await checkinsOf(user.patientId, 0)
  const contact = await contactOptionsFor(user.patientId)
  const calendarOld = await calendarOutdated(user.id, user.patientId)
  const checkinNow = checkin ? checkinState(checkin, today) : null
  const body = await bodyProfile(user.patientId, today)

  return (
    <MotionRoot>
      <div className="hub">
        <div className="hub-hello hub-hello--line">
          <h1>
            Olá, {firstName}! <span className="muted">{data.dateLabel}</span>
          </h1>
        </div>
        {sp.pago && <p className="alert alert--ok">Pagamento confirmado. Bom acompanhamento!</p>}
        {renew && (
          <section className="card hub-renew" aria-labelledby="renovar-titulo">
            <div>
              <h2 id="renovar-titulo">
                {renew.daysLeft! < 0
                  ? `Seu Plano ${renew.name} terminou`
                  : renew.daysLeft === 0
                    ? `Seu Plano ${renew.name} termina hoje`
                    : `Seu plano termina em ${renew.daysLeft} ${renew.daysLeft === 1 ? 'dia' : 'dias'}`}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                Renove para continuar com o plano alimentar, o diário e o acompanhamento{renew.end ? ` (término: ${fmtDay(renew.end)})` : ''}.
              </p>
            </div>
            <Link href={`/paciente/pagamento?plano=${pkg[0]!.id}`} className="btn btn--primary">
              Renovar
            </Link>
          </section>
        )}
        {calendarOld && (
          <div className="hub-banner" role="status">
            <span>Seus horários mudaram: atualize os lembretes do calendário.</span>
            <Link href="/paciente/notificacoes#calendario-titulo" className="btn btn--light btn--sm">
              Atualizar lembretes
            </Link>
          </div>
        )}
        {checkin && (checkinNow === 'aberto' || checkinNow === 'atrasado') && (
          <div className="hub-banner" role="status">
            <span>{checkinNow === 'atrasado' ? `Seu check-in de ${fmtDay(checkin.dueDate)} está atrasado.` : `Check-in aberto: responda até ${fmtDay(checkin.dueDate)}.`}</span>
            <Link href="/paciente/checkin" className="btn btn--light btn--sm">
              Fazer check-in
            </Link>
          </div>
        )}
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

        {/* 1. O que comer: a próxima refeição em destaque, as refeições do dia e a água. */}
        <section aria-labelledby="plano-hoje">
          <h2 id="plano-hoje" className="hub-title">
            Seu plano de hoje
          </h2>
          <TodayView
            data={data}
            variant="hub"
            actions={{ setMeal: setMealStatus, water: changeWater, platePhoto: savePlatePhoto }}
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
        </section>

        {f.diario && (
          <details className="disclosure card" id="foto-avulsa">
            <summary>Foto avulsa: comi outra coisa</summary>
            <ActionForm action={saveLoosePhoto} className="stack" resetOnSuccess compressImages={['photo']}>
              <Field label="Foto do prato" name="photo" required>
                <input type="file" name="photo" accept="image/*" capture="environment" />
              </Field>
              <Field label="O que foi (opcional)" name="text">
                <input name="text" maxLength={300} placeholder="Ex.: almoço fora, pizza com salada" />
              </Field>
              <div>
                <SubmitButton>Enviar foto</SubmitButton>
              </div>
            </ActionForm>
          </details>
        )}

        <BodyCard
          data={body}
          completeHref="/paciente/meu-corpo#dados"
          actions={
            <>
              {f.peso && (
                <Link href="/paciente/meu-corpo#peso" className="btn btn--sm">
                  Registrar peso
                </Link>
              )}
              {f.fotosCorpo && (
                <Link href="/paciente/meu-corpo/fotos" className="btn btn--sm">
                  Enviar fotos do corpo
                </Link>
              )}
              <Link href="/paciente/meu-corpo" className="btn btn--sm btn--ghost">
                Ver detalhes
              </Link>
            </>
          }
        />

        {/* Atalhos compactos (sem repetir a barra de baixo). */}
        <nav className="hub-quick" aria-label="Atalhos rápidos">
          {f.diario && <Link href="/paciente/diario">Registrar refeição</Link>}
          {(f.diario || f.fotosCorpo || f.exames) && <Link href="/paciente/enviar">Enviar foto ou exame</Link>}
          {(contact.app || contact.whatsapp) && <a href="#falar-com-o-coach">Falar com o coach</a>}
          <Link href="/paciente/meus-dados">Meu perfil</Link>
        </nav>

        {(contact.app || contact.whatsapp) && (
          <section className="hub-talk" id="falar-com-o-coach" aria-labelledby="falar-titulo">
            <h2 id="falar-titulo" className="hub-talk__title">
              Falar com o coach
            </h2>
            <ContactOptions app={contact.app} whatsapp={contact.whatsapp} offHoursText={contact.offHoursText} compact />
          </section>
        )}

        <Stagger className="hub-grid">
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
                <Link href="/#planos" className="small">
                  Ver planos
                </Link>
              )}
            </div>
            <div className="hub-status__days">
              {contract?.daysLeft == null ? (
                <span className="muted small">Plano sem data de término</span>
              ) : contract.daysLeft < 0 ? (
                <span className="muted small">Plano encerrado</span>
              ) : (
                <>
                  <strong>{contract.daysLeft === 0 ? 'Hoje' : contract.daysLeft}</strong>
                  <span className="small muted">{contract.daysLeft === 0 ? 'é o último dia do plano' : contract.daysLeft === 1 ? 'dia de plano' : 'dias de plano'}</span>
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
            {s.dailyQuote && (
              <blockquote className="hub-quote">
                “{s.dailyQuote}”<cite>— {s.professionalName.split(' ')[0]}</cite>
              </blockquote>
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
