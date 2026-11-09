import type { Metadata } from 'next'
import Link from 'next/link'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { getSettings } from '@/lib/settings'
import { addDays, fmtDay, todayIn } from '@/lib/time'
import { checkinsOf } from '@/lib/checkins'
import { CHECKIN_OPEN_DAYS, CHECKIN_SCALES, checkinState, daysLate, type CheckinScale } from '@/lib/checkin-rules'
import { submitCheckin } from '@/actions/checkins'
import { ActionForm, Field, FieldError, SubmitButton } from '@/components/form'
import { Empty, PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Check-in' }

function Scale({ name, required }: { name: CheckinScale; required?: boolean }) {
  const s = CHECKIN_SCALES[name]
  return (
    <fieldset className="checkin-scale">
      <legend>
        {s.label}
        {required && (
          <span className="req" aria-hidden>
            *
          </span>
        )}
      </legend>
      <div className="checkin-scale__opts">
        <span className="small muted">{s.low}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="checkin-scale__opt">
            <input type="radio" name={name} value={n} aria-label={`${s.label}: ${n} de 5`} />
            <span aria-hidden>{n}</span>
          </label>
        ))}
        <span className="small muted">{s.high}</span>
      </div>
      <FieldError name={name} />
    </fieldset>
  )
}

/** Check-in periódico do cliente: questionário curto, peso, medidas e fotos opcionais e privadas. */
export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const sp = await searchParams
  const user = await requireActivePatient()
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const { pending, sent } = await checkinsOf(user.patientId)
  const state = pending ? checkinState(pending, today) : null

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead title="Check-in" subtitle="Um retrato rápido dos últimos dias para o coach ajustar o seu plano. Leva poucos minutos." />

      {sp.enviado && (
        <p className="alert alert--ok" role="status">
          Check-in enviado! O coach vai olhar e ajustar o que for preciso.
        </p>
      )}
      {!pending && sent.length === 0 && <Empty>Seu coach ainda não ativou os check-ins periódicos. Quando ativar, eles aparecem aqui com o prazo.</Empty>}

      {pending && state === 'aguardando' && (
        <p className="alert alert--info" role="status">
          Próximo check-in: abre em {fmtDay(addDays(pending.dueDate, -CHECKIN_OPEN_DAYS))}, prazo até {fmtDay(pending.dueDate)}.
        </p>
      )}

      {pending && (state === 'aberto' || state === 'atrasado') && (
        <section className="card stack" aria-labelledby="checkin-titulo">
          <div className="row row--between">
            <h2 id="checkin-titulo" style={{ margin: 0, fontSize: '1.1rem' }}>
              Check-in até {fmtDay(pending.dueDate)}
            </h2>
            {state === 'atrasado' ? (
              <span className="badge badge--warn">
                Atrasado há {daysLate(pending.dueDate, today)} {daysLate(pending.dueDate, today) === 1 ? 'dia' : 'dias'}
              </span>
            ) : (
              <span className="badge badge--ok">Aberto</span>
            )}
          </div>
          <ActionForm action={submitCheckin} className="stack" encType="multipart/form-data">
            <input type="hidden" name="checkinId" value={pending.id} />
            <Scale name="adesao" required />
            <Scale name="energia" />
            <Scale name="fome" />
            <Scale name="sono" />
            <div className="form-grid">
              <Field label="Treinos ou atividades na semana" name="treinos" hint="Quantas vezes, em média.">
                <input type="number" name="treinos" min={0} max={21} inputMode="numeric" />
              </Field>
              <Field label="Peso (kg)" name="weightKg" hint="De manhã, em jejum, de preferência.">
                <input name="weightKg" inputMode="decimal" />
              </Field>
            </div>
            <div className="form-grid form-grid--3">
              <Field label="Cintura (cm)" name="waistCm">
                <input name="waistCm" inputMode="decimal" />
              </Field>
              <Field label="Quadril (cm)" name="hipCm">
                <input name="hipCm" inputMode="decimal" />
              </Field>
              <Field label="Abdômen (cm)" name="abdomenCm">
                <input name="abdomenCm" inputMode="decimal" />
              </Field>
            </div>
            <Field label="O que foi mais difícil?" name="dificuldades">
              <textarea name="dificuldades" rows={2} maxLength={1000} />
            </Field>
            <Field label="Quer contar mais alguma coisa?" name="comentario">
              <textarea name="comentario" rows={2} maxLength={1000} />
            </Field>
            <Field label="Fotos (opcional, até 3)" name="photos" hint="Frente, lado e costas, se quiser. Ficam privadas: só você e o coach veem.">
              <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple />
            </Field>
            <div>
              <SubmitButton pendingText="Enviando…">Enviar check-in</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}

      {sent.length > 0 && (
        <section className="card" aria-labelledby="checkins-anteriores">
          <h2 id="checkins-anteriores" style={{ fontSize: '1.1rem' }}>
            Check-ins enviados
          </h2>
          <ul className="list" aria-label="Check-ins enviados">
            {sent.map((c) => (
              <li key={c.id} className="stack" style={{ ['--gap' as string]: '4px' }}>
                <div className="row row--between">
                  <strong>Prazo {fmtDay(c.dueDate)}</strong>
                  <span className={`badge ${c.reviewedAt ? 'badge--ok' : 'badge--plain'}`}>{c.reviewedAt ? 'Visto pelo coach' : 'Enviado'}</span>
                </div>
                <span className="small muted">
                  Seguiu o plano: {c.answers.adesao ?? '—'}/5{c.weightKg != null ? ` · ${String(c.weightKg).replace('.', ',')} kg` : ''}
                  {c.photoFileIds.length ? ` · ${c.photoFileIds.length} foto(s)` : ''}
                </span>
                {c.coachNote && (
                  <p className="alert alert--info small" style={{ margin: 0 }}>
                    <strong>Coach:</strong> {c.coachNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            O peso e as medidas também aparecem em <Link href="/paciente/evolucao">Evolução</Link>, como “informados por você”.
          </p>
        </section>
      )}
    </div>
  )
}
