import { schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { addDays, fmtDateTime, fmtDay, todayIn } from '@/lib/time'
import { checkinsOf } from '@/lib/checkins'
import { CHECKIN_FREQUENCIES, CHECKIN_SCALES, CHECKIN_STATE_LABEL, checkinState, daysLate, type CheckinScale } from '@/lib/checkin-rules'
import { siteUrl } from '@/lib/seo'
import { reviewCheckin, setCheckinSchedule } from '@/actions/checkins'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { WhatsAppButton } from '@/components/WhatsAppButton'


const TONE = { aguardando: 'badge--plain', aberto: 'badge--info', atrasado: 'badge--warn', enviado: 'badge--ok' } as const

/** Check-ins periódicos do cliente: frequência, prazo atual, respostas, peso, medidas e fotos privadas. */
export async function CheckinsTab({ patient: p }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const { pending, sent } = await checkinsOf(p.id, 20)
  const state = pending ? checkinState(pending, today) : null
  const fmtNum = (n: number | null | undefined, unit: string) => (n == null ? null : `${String(n).replace('.', ',')} ${unit}`)

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <section className="card stack" aria-labelledby="checkin-agenda">
        <h2 id="checkin-agenda" style={{ fontSize: '1.1rem', margin: 0 }}>
          Frequência do check-in
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          O cliente recebe um questionário curto com peso, medidas e fotos opcionais (privadas). Ele abre 3 dias antes do prazo, com lembrete por push; depois
          do prazo, aparece como atrasado no Acompanhamento.
        </p>
        <ActionForm action={setCheckinSchedule.bind(null, p.id)} className="row" >
          <Field label="A cada" name="every">
            <select name="every" defaultValue={p.checkinEveryDays ? String(p.checkinEveryDays) : ''}>
              <option value="">Desligado</option>
              {[...new Set([...CHECKIN_FREQUENCIES, ...(p.checkinEveryDays ? [p.checkinEveryDays] : [])])]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} dias
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Primeiro prazo" name="firstDue" hint="Em branco: daqui a N dias.">
            <input type="date" name="firstDue" min={today} defaultValue={p.nextCheckinDue ?? addDays(today, p.checkinEveryDays ?? 15)} />
          </Field>
          <div style={{ alignSelf: 'flex-end' }}>
            <SubmitButton className="btn btn--primary btn--sm">Salvar frequência</SubmitButton>
          </div>
        </ActionForm>
        {pending && state && (
          <div className="row row--between">
            <span>
              Próximo: prazo <strong>{fmtDay(pending.dueDate)}</strong> <span className={`badge ${TONE[state]}`}>{CHECKIN_STATE_LABEL[state]}</span>
              {state === 'atrasado' && <span className="muted small"> · {daysLate(pending.dueDate, today)} dia(s) de atraso</span>}
            </span>
            {(state === 'aberto' || state === 'atrasado') && (
              <WhatsAppButton
                phone={p.phone}
                template="waCheckin"
                label="Lembrar pelo WhatsApp"
                vars={{ nome: p.fullName.split(' ')[0], data: fmtDay(pending.dueDate), link: `${siteUrl()}/paciente/checkin` }}
              />
            )}
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="checkins-recebidos">
        <h2 id="checkins-recebidos" style={{ fontSize: '1.1rem', margin: 0 }}>
          Check-ins recebidos
        </h2>
        {sent.length === 0 ? (
          <p className="muted">Nenhum check-in enviado ainda.</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Check-ins recebidos">
            {sent.map((c) => (
              <li key={c.id} className="card stack" style={{ ['--gap' as string]: '8px' }}>
                <div className="row row--between">
                  <strong>
                    Prazo {fmtDay(c.dueDate)} <span className="muted small">· enviado em {c.submittedAt ? fmtDateTime(c.submittedAt, s.timezone) : '—'}</span>
                  </strong>
                  <span className={`badge ${c.reviewedAt ? 'badge--ok' : 'badge--warn'}`}>{c.reviewedAt ? 'Visto' : 'Novo'}</span>
                </div>
                <dl className="checkin-answers">
                  {(Object.keys(CHECKIN_SCALES) as CheckinScale[]).map((k) =>
                    c.answers[k] ? (
                      <div key={k}>
                        <dt>{CHECKIN_SCALES[k].label}</dt>
                        <dd>{c.answers[k]}/5</dd>
                      </div>
                    ) : null,
                  )}
                  {c.answers.treinos != null && (
                    <div>
                      <dt>Treinos na semana</dt>
                      <dd>{c.answers.treinos}</dd>
                    </div>
                  )}
                  {[
                    ['Peso', fmtNum(c.weightKg, 'kg')],
                    ['Cintura', fmtNum(c.measures.waistCm, 'cm')],
                    ['Quadril', fmtNum(c.measures.hipCm, 'cm')],
                    ['Abdômen', fmtNum(c.measures.abdomenCm, 'cm')],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                {c.answers.dificuldades && (
                  <p className="small" style={{ margin: 0 }}>
                    <strong>Dificuldades:</strong> {c.answers.dificuldades}
                  </p>
                )}
                {c.answers.comentario && (
                  <p className="small" style={{ margin: 0 }}>
                    <strong>Comentário:</strong> {c.answers.comentario}
                  </p>
                )}
                {c.photoFileIds.length > 0 && (
                  <div className="row" aria-label="Fotos do check-in (privadas)">
                    {c.photoFileIds.map((f, i) => (
                      <a key={f} href={`/arquivos/${f}`} target="_blank" rel="noopener noreferrer" className="checkin-photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/arquivos/${f}`} alt={`Foto ${i + 1} do check-in`} />
                      </a>
                    ))}
                  </div>
                )}
                {c.reviewedAt ? (
                  c.coachNote && (
                    <p className="alert alert--info small" style={{ margin: 0 }}>
                      <strong>Seu comentário:</strong> {c.coachNote}
                    </p>
                  )
                ) : (
                  <ActionForm action={reviewCheckin.bind(null, c.id)} className="stack">
                    <Field label="Comentário para o cliente (opcional)" name="coachNote">
                      <textarea name="coachNote" rows={2} maxLength={1000} />
                    </Field>
                    <div>
                      <SubmitButton className="btn btn--sm btn--primary">Marcar como visto</SubmitButton>
                    </div>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
