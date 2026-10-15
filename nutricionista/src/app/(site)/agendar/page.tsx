import Link from 'next/link'
import type { Metadata } from 'next'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { slotsForRange } from '@/lib/booking'
import { money } from '@/lib/format'
import { fmtDayLong, isValidDay, isValidTime, todayIn, weekdayOf, weekdayShort, zonedParts } from '@/lib/time'
import { createBooking } from '@/actions/public'
import { ActionForm, Field, FieldError, SubmitButton } from '@/components/form'

export const metadata: Metadata = { title: 'Agendar consulta' }

type SP = Promise<Record<string, string | string[] | undefined>>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function BookingPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams
  const s = await getSettings()
  const services = await db
    .select()
    .from(schema.services)
    .where(and(eq(schema.services.active, true), eq(schema.services.isPublic, true)))
    .orderBy(asc(schema.services.sort))

  const service = services.find((x) => x.id === one(sp.servico))
  const modParam = one(sp.modalidade)
  const modality = service ? (service.modality === 'ambos' ? (modParam === 'presencial' || modParam === 'online' ? modParam : null) : service.modality) : null

  const days = service && modality ? await slotsForRange(todayIn(s.timezone), s.maxDaysAhead + 1, service.durationMinutes) : []
  const dayParam = one(sp.data)
  const selectedDay = days.find((d) => d.day === dayParam && d.slots.length > 0)
  const timeParam = one(sp.hora)
  const selectedTime =
    selectedDay && isValidTime(timeParam) && selectedDay.slots.some((x) => zonedParts(x, s.timezone).time === timeParam) ? timeParam : null

  const base = (extra: Record<string, string>) => {
    const p = new URLSearchParams()
    if (service) p.set('servico', service.id)
    if (modality && service?.modality === 'ambos') p.set('modalidade', modality)
    for (const [k, v] of Object.entries(extra)) p.set(k, v)
    return `/agendar?${p.toString()}`
  }

  const step = !service ? 1 : !modality ? 2 : !selectedDay ? 3 : !selectedTime ? 4 : 5

  return (
    <section className="section section--tight">
      <div className="container" style={{ maxWidth: 900 }}>
        <h1>Agendar consulta</h1>
        <p className="muted">
          Escolha o serviço, a data e o horário. O pedido fica <strong>pendente</strong> até a confirmação pela equipe.
        </p>
        <ol className="stepper" aria-label="Etapas do agendamento">
          {['Serviço', 'Modalidade', 'Data', 'Horário', 'Seus dados'].map((label, i) => (
            <li key={label} aria-current={step === i + 1 ? 'step' : undefined} className={step > i + 1 ? 'done' : undefined}>
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        {/* 1. Serviço */}
        <div className="card stack">
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>1. Tipo de consulta</h2>
          <div className="grid-2">
            {services.map((svc) => (
              <Link key={svc.id} href={`/agendar?servico=${svc.id}`} className="option-card" aria-current={svc.id === service?.id ? 'true' : undefined}>
                <strong>{svc.name}</strong>
                <div className="muted small">
                  {svc.durationMinutes} min · {svc.priceCents ? money(svc.priceCents) : 'valor sob consulta'} ·{' '}
                  {svc.modality === 'ambos' ? 'presencial ou on-line' : svc.modality === 'online' ? 'on-line' : 'presencial'}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 2. Modalidade */}
        {service && service.modality === 'ambos' && (
          <div className="card stack" style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>2. Modalidade</h2>
            <div className="grid-2">
              {(['presencial', 'online'] as const).map((m) => (
                <Link key={m} href={`/agendar?servico=${service.id}&modalidade=${m}`} className="option-card" aria-current={modality === m ? 'true' : undefined}>
                  <strong>{m === 'presencial' ? 'Presencial' : 'On-line (videochamada)'}</strong>
                  <div className="muted small">{m === 'presencial' ? s.address ?? 'No consultório' : 'O link da chamada é enviado após a confirmação.'}</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 3. Data */}
        {service && modality && (
          <div className="card stack" style={{ marginTop: 16 }} id="data">
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>3. Data</h2>
            {days.every((d) => d.slots.length === 0) ? (
              <p className="alert alert--info">Não há horários livres nos próximos dias. Fale conosco pelo WhatsApp para verificar outras opções.</p>
            ) : (
              <div className="days">
                {days.map((d) => {
                  const [, m, dd] = d.day.split('-')
                  const has = d.slots.length > 0
                  return (
                    <Link
                      key={d.day}
                      href={has ? base({ data: d.day }) + '#horario' : '#'}
                      className="day-btn"
                      aria-current={selectedDay?.day === d.day ? 'true' : undefined}
                      aria-disabled={!has}
                      aria-label={`${fmtDayLong(d.day)}: ${has ? `${d.slots.length} horários` : 'sem horários'}`}
                    >
                      <small>{weekdayShort(weekdayOf(d.day))}</small>
                      <strong>{dd}</strong>
                      <small>{has ? `${d.slots.length} vagas` : `${m}`}</small>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. Horário */}
        {selectedDay && (
          <div className="card stack" style={{ marginTop: 16 }} id="horario">
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>4. Horário — {fmtDayLong(selectedDay.day)}</h2>
            <div className="slots">
              {selectedDay.slots.map((x) => {
                const t = zonedParts(x, s.timezone).time
                return (
                  <Link key={t} className="slot" href={base({ data: selectedDay.day, hora: t }) + '#dados'} aria-current={selectedTime === t ? 'true' : undefined}>
                    {t}
                  </Link>
                )
              })}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Horários no fuso de Brasília. Duração: {service!.durationMinutes} minutos.
            </p>
          </div>
        )}

        {/* 5. Dados */}
        {service && modality && selectedDay && selectedTime && (
          <div className="card" style={{ marginTop: 16 }} id="dados">
            <h2 style={{ fontSize: '1.15rem' }}>5. Seus dados</h2>
            <p className="alert alert--info">
              <strong>{service.name}</strong> · {modality === 'online' ? 'on-line' : 'presencial'} · {fmtDayLong(selectedDay.day)} às {selectedTime}
              {service.priceCents ? ` · ${money(service.priceCents)}` : ''}
            </p>
            <ActionForm action={createBooking} className="stack">
              <input type="hidden" name="serviceId" value={service.id} />
              <input type="hidden" name="modality" value={modality} />
              <input type="hidden" name="day" value={selectedDay.day} />
              <input type="hidden" name="time" value={selectedTime} />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden />
              <Field label="Nome completo" name="name" required>
                <input name="name" autoComplete="name" maxLength={120} />
              </Field>
              <div className="form-grid">
                <Field label="E-mail" name="email" required hint="Usado para a confirmação.">
                  <input name="email" type="email" autoComplete="email" />
                </Field>
                <Field label="Telefone / WhatsApp" name="phone" required>
                  <input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(11) 90000-0000" />
                </Field>
              </div>
              <fieldset>
                <legend>Você já é paciente?</legend>
                <div className="row" style={{ gap: 20 }}>
                  <label className="check">
                    <input type="radio" name="returning" value="nao" defaultChecked /> Não, é minha primeira consulta
                  </label>
                  <label className="check">
                    <input type="radio" name="returning" value="sim" /> Sim, já sou paciente
                  </label>
                </div>
                <FieldError name="returning" />
              </fieldset>
              <Field label="Observações" name="notes" hint="Opcional. Não é necessário informar dados de saúde neste momento.">
                <textarea name="notes" rows={3} maxLength={1000} />
              </Field>
              <label className="check">
                <input type="checkbox" name="consent" />
                <span>
                  Li e concordo com a{' '}
                  <Link href="/privacidade" target="_blank">
                    Política de Privacidade
                  </Link>{' '}
                  e autorizo o uso destes dados para o agendamento.
                </span>
              </label>
              <FieldError name="consent" />
              <div className="row">
                <SubmitButton pendingText="Enviando pedido…">Solicitar agendamento</SubmitButton>
                <Link href={base({ data: selectedDay.day })} className="btn btn--ghost">
                  Trocar horário
                </Link>
              </div>
            </ActionForm>
          </div>
        )}
      </div>
    </section>
  )
}
