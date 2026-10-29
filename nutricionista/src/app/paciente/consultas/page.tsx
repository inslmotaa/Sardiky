import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { bookingLink } from '@/lib/format'
import { BookingLink } from '@/components/BookingLink'
import { cancelOwnAppointment, confirmPresence, rateAppointment, requestReschedule } from '@/actions/patient'
import { ActionForm, SubmitButton } from '@/components/form'
import { PageHead, StatusBadge, Empty } from '@/components/ui'

export default async function PatientAppointments() {
  const user = await requirePatient()
  const s = await getSettings()
  const list = await db.select().from(schema.appointments).where(eq(schema.appointments.patientId, user.patientId)).orderBy(desc(schema.appointments.startAt))
  const now = Date.now()
  const upcoming = list.filter((a) => a.startAt.getTime() >= now && ['pendente', 'confirmada'].includes(a.status)).reverse()
  const past = list.filter((a) => !upcoming.includes(a))
  const toRate = past.filter((a) => a.status === 'realizada' && !a.ratedAt)
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title="Consultas"
        actions={
          <BookingLink to={bookingLink(s, `Olá! Sou ${user.name.split(' ')[0]} e gostaria de agendar uma nova consulta.`)} className="btn btn--primary">
            Agendar nova consulta
          </BookingLink>
        }
      />
      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Próximas</h2>
        {upcoming.length === 0 ? (
          <Empty>Nenhuma consulta agendada.</Empty>
        ) : (
          <div className="stack">
            {upcoming.map((a) => (
              <div key={a.id} className="card">
                <div className="row row--between">
                  <div>
                    <strong>{fmtDateTime(a.startAt, s.timezone)}</strong> <StatusBadge status={a.status} />
                    <div className="muted">
                      {a.serviceName} · On-line, por videochamada
                    </div>
                  </div>
                  {a.modality === 'online' && a.meetingUrl && a.status === 'confirmada' && (
                    <a className="btn btn--primary btn--sm" href={a.meetingUrl} target="_blank" rel="noopener noreferrer">
                      Entrar na videochamada
                    </a>
                  )}
                </div>
                <div className="row" style={{ marginTop: 10, gap: 8 }}>
                  {a.status === 'confirmada' &&
                    (a.patientConfirmedAt ? (
                      <span className="badge badge--ok">Presença confirmada</span>
                    ) : (
                      <form action={confirmPresence.bind(null, a.id)}>
                        <button type="submit" className="btn btn--sm btn--primary">
                          Confirmar presença
                        </button>
                      </form>
                    ))}
                  {a.rescheduleRequestedAt && <span className="badge badge--warn">Remarcação pedida — aguarde o contato</span>}
                </div>
                {!a.rescheduleRequestedAt && (
                  <details className="disclosure" style={{ marginTop: 12 }}>
                    <summary>Pedir remarcação</summary>
                    <div>
                      <ActionForm action={requestReschedule} className="stack">
                        <input type="hidden" name="id" value={a.id} />
                        <label className="field">
                          <span className="field__label">Melhores dias e horários para você (opcional)</span>
                          <input name="note" maxLength={500} placeholder="Ex.: terças ou quintas depois das 17h" />
                        </label>
                        <div>
                          <SubmitButton className="btn btn--sm">Enviar pedido</SubmitButton>
                        </div>
                      </ActionForm>
                    </div>
                  </details>
                )}
                <details className="disclosure" style={{ marginTop: 12 }}>
                  <summary>Cancelar esta consulta</summary>
                  <div>
                    <ActionForm action={cancelOwnAppointment} className="stack" confirm="Confirmar o cancelamento desta consulta?">
                      <input type="hidden" name="id" value={a.id} />
                      <label className="field">
                        <span className="field__label">Motivo (opcional)</span>
                        <input name="reason" maxLength={300} />
                      </label>
                      <p className="small muted" style={{ margin: 0 }}>
                        Cancelamentos pela área do cliente são aceitos com pelo menos 24 horas de antecedência. Para remarcar, cancele e escolha um novo horário.
                      </p>
                      <div>
                        <SubmitButton className="btn btn--danger btn--sm" pendingText="Cancelando…">
                          Cancelar consulta
                        </SubmitButton>
                      </div>
                    </ActionForm>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </section>
      {toRate.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: '1.15rem' }}>Como foi a sua última consulta?</h2>
          <p className="muted small">Sua avaliação ajuda a melhorar o atendimento. Ela não é publicada no site.</p>
          <ActionForm action={rateAppointment} className="stack">
            <input type="hidden" name="id" value={toRate[0].id} />
            <fieldset>
              <legend>
                {toRate[0].serviceName} · {fmtDateTime(toRate[0].startAt, s.timezone)}
              </legend>
              <div className="scale-input stars" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} title={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}>
                    <input type="radio" name="rating" value={n} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`} />
                    <span aria-hidden>★</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              <span className="field__label">Comentário (opcional)</span>
              <textarea name="comment" rows={2} maxLength={1000} />
            </label>
            <div>
              <SubmitButton>Enviar avaliação</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}
      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Histórico</h2>
        {past.length === 0 ? (
          <Empty>Sem consultas anteriores.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Serviço</th>
                  <th>Modalidade</th>
                  <th>Situação</th>
                  <th>Sua avaliação</th>
                </tr>
              </thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{fmtDateTime(a.startAt, s.timezone)}</td>
                    <td>{a.serviceName}</td>
                    <td>On-line</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td aria-label={a.rating ? `${a.rating} de 5 estrelas` : 'sem avaliação'}>{a.rating ? '★'.repeat(a.rating) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
