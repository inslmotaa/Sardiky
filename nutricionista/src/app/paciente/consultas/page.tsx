import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { cancelOwnAppointment } from '@/actions/patient'
import { ActionForm, SubmitButton } from '@/components/form'
import { PageHead, StatusBadge, Empty } from '@/components/ui'

export default async function PatientAppointments() {
  const user = await requirePatient()
  const s = await getSettings()
  const list = await db.select().from(schema.appointments).where(eq(schema.appointments.patientId, user.patientId)).orderBy(desc(schema.appointments.startAt))
  const now = Date.now()
  const upcoming = list.filter((a) => a.startAt.getTime() >= now && ['pendente', 'confirmada'].includes(a.status)).reverse()
  const past = list.filter((a) => !upcoming.includes(a))
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title="Consultas"
        actions={
          <Link href="/agendar" className="btn btn--primary">
            Agendar nova consulta
          </Link>
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
                      {a.serviceName} · {a.modality === 'online' ? 'On-line' : `Presencial${s.address ? ` · ${s.address}` : ''}`}
                    </div>
                  </div>
                  {a.modality === 'online' && a.meetingUrl && a.status === 'confirmada' && (
                    <a className="btn btn--primary btn--sm" href={a.meetingUrl} target="_blank" rel="noopener noreferrer">
                      Entrar na videochamada
                    </a>
                  )}
                </div>
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
                        Cancelamentos pela área do paciente são aceitos com pelo menos 24 horas de antecedência. Para remarcar, cancele e escolha um novo horário.
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
                </tr>
              </thead>
              <tbody>
                {past.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{fmtDateTime(a.startAt, s.timezone)}</td>
                    <td>{a.serviceName}</td>
                    <td>{a.modality === 'online' ? 'On-line' : 'Presencial'}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
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
