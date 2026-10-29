import Link from 'next/link'
import { notFound } from 'next/navigation'
import { asc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { assertPatientAccess } from '@/lib/team-access'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtTime, zonedParts } from '@/lib/time'
import { money, whatsappLink, renderWaText } from '@/lib/format'
import { uuid } from '@/lib/validation'
import { cancelAppointment, confirmAppointment, generateMeetingLink, linkAppointmentPatient, rescheduleAppointment, setAppointmentOutcome, updateAppointmentDetails } from '@/actions/admin/appointments'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { NoAccess, PageHead, StatusBadge } from '@/components/ui'

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireTeam()
  if (!can(user, 'agenda')) return <NoAccess />
  if (!uuid.safeParse(id).success) notFound()
  const s = await getSettings()
  const [a] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id))
  if (!a) notFound()
  await assertPatientAccess(user, a.patientId).catch(() => notFound())
  const patients = a.patientId
    ? []
    : await db.select({ id: schema.patients.id, name: schema.patients.fullName, email: schema.patients.email }).from(schema.patients).where(isNull(schema.patients.anonymizedAt)).orderBy(asc(schema.patients.fullName))
  const active = a.status === 'pendente' || a.status === 'confirmada'
  const p = zonedParts(a.startAt, s.timezone)
  const confirmText = renderWaText(s.templates.confirmacao, {
    nome: a.contactName.split(' ')[0],
    data: `${p.date.slice(8)}/${p.date.slice(5, 7)}/${p.date.slice(0, 4)}`,
    hora: p.time,
    servico: a.serviceName,
    codigo: a.code,
  })
  const wa = whatsappLink(a.contactPhone.length <= 11 ? `55${a.contactPhone}` : a.contactPhone, confirmText)

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px', maxWidth: 900 }}>
      <PageHead
        crumbs={[{ href: '/admin/agenda', label: 'Agenda' }]}
        title={a.contactName}
        subtitle={
          <>
            {fmtDateTime(a.startAt, s.timezone)} até {fmtTime(a.endAt, s.timezone)} · {a.serviceName} · on-line
          </>
        }
        actions={<StatusBadge status={a.status} />}
      />

      <section className="card">
        <div className="row">
          {a.status === 'pendente' && (
            <form action={confirmAppointment.bind(null, a.id)}>
              <button className="btn btn--primary" type="submit">
                Confirmar consulta
              </button>
            </form>
          )}
          {(a.status === 'confirmada' || a.status === 'pendente') && a.startAt.getTime() < Date.now() + 3_600_000 && (
            <>
              <form action={setAppointmentOutcome.bind(null, a.id, 'realizada')}>
                <button className="btn" type="submit">
                  Marcar como realizada
                </button>
              </form>
              <form action={setAppointmentOutcome.bind(null, a.id, 'faltou')}>
                <button className="btn" type="submit">
                  Não compareceu
                </button>
              </form>
            </>
          )}
          {wa && (
            <a href={wa} className="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">
              Enviar confirmação pelo WhatsApp
            </a>
          )}
          {a.patientId && (can(user, 'cadastro') || can(user, 'clinico')) && (
            <Link href={`/admin/pacientes/${a.patientId}`} className="btn btn--ghost">
              Abrir ficha
            </Link>
          )}
        </div>
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          O botão do WhatsApp abre uma conversa com a mensagem pronta para você enviar; o envio automático ainda não está integrado.
        </p>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Dados do agendamento</h2>
          <dl className="kv">
            <dt>Código</dt>
            <dd>{a.code}</dd>
            <dt>E-mail</dt>
            <dd>{a.contactEmail}</dd>
            <dt>Telefone</dt>
            <dd>{a.contactPhone}</dd>
            <dt>Já é cliente?</dt>
            <dd>{a.isReturning ? 'Sim (informado)' : 'Não, primeira consulta'}</dd>
            <dt>Valor</dt>
            <dd>{money(a.priceCents)}</dd>
            <dt>Origem</dt>
            <dd>{a.source === 'site' ? 'Site' : a.source === 'admin' ? 'Painel' : a.source}</dd>
            <dt>Criado em</dt>
            <dd>{fmtDateTime(a.createdAt, s.timezone)}</dd>
            {a.patientNotes && (
              <>
                <dt>Observações</dt>
                <dd>{a.patientNotes}</dd>
              </>
            )}
            {a.cancelReason && (
              <>
                <dt>Cancelamento</dt>
                <dd>{a.cancelReason}</dd>
              </>
            )}
            <dt>Presença</dt>
            <dd>{a.patientConfirmedAt ? `Confirmada pelo cliente em ${fmtDateTime(a.patientConfirmedAt, s.timezone)}` : 'Ainda não confirmada pelo cliente'}</dd>
            {a.rescheduleRequestedAt && (
              <>
                <dt>Remarcação</dt>
                <dd>
                  <span className="badge badge--warn">Pedida em {fmtDateTime(a.rescheduleRequestedAt, s.timezone)}</span>
                  {a.rescheduleNote && <div className="small">“{a.rescheduleNote}”</div>}
                </dd>
              </>
            )}
            {a.ratedAt && (
              <>
                <dt>Avaliação</dt>
                <dd>
                  <span aria-label={`${a.rating} de 5 estrelas`}>{'★'.repeat(a.rating ?? 0)}</span>
                  {a.ratingComment && <div className="small">“{a.ratingComment}”</div>}
                </dd>
              </>
            )}
          </dl>
        </section>

        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Cadastro do cliente</h2>
          {a.patientId ? (
            <p>
              Vinculado ao cadastro. {can(user, 'cadastro') && <Link href={`/admin/pacientes/${a.patientId}`}>Ver cliente</Link>}
            </p>
          ) : can(user, 'cadastro') ? (
            <ActionForm action={linkAppointmentPatient} className="stack">
              <input type="hidden" name="id" value={a.id} />
              <Field label="Vincular a cliente existente" name="patientId" hint="Deixe em branco para criar um novo cadastro com os dados do agendamento.">
                <select name="patientId" defaultValue={patients.find((x) => x.email === a.contactEmail)?.id ?? ''}>
                  <option value="">Criar novo cadastro</option>
                  {patients.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.email ? ` (${x.email})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <SubmitButton>Vincular</SubmitButton>
              </div>
            </ActionForm>
          ) : (
            <p className="muted">Sem cadastro vinculado.</p>
          )}
        </section>
      </div>

      {a.modality === 'online' && (
        <div className="row no-print">
          {a.meetingUrl && (
            <a className="btn btn--primary btn--sm" href={a.meetingUrl} target="_blank" rel="noopener noreferrer">
              Abrir videochamada
            </a>
          )}
          <form action={generateMeetingLink.bind(null, a.id)}>
            <button type="submit" className="btn btn--sm">
              {a.meetingUrl ? 'Gerar novo link (Jitsi)' : 'Gerar link da videochamada (Jitsi)'}
            </button>
          </form>
        </div>
      )}
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Detalhes internos</h2>
        <ActionForm action={updateAppointmentDetails} className="stack">
          <input type="hidden" name="id" value={a.id} />
          {a.modality === 'online' && (
            <Field label="Link da videochamada" name="meetingUrl" hint="Gerado automaticamente no Jitsi Meet ao confirmar; você também pode colar um link do Google Meet ou Zoom. O cliente vê o botão após a confirmação.">
              <input name="meetingUrl" type="url" defaultValue={a.meetingUrl ?? ''} placeholder="https://" />
            </Field>
          )}
          <Field label="Anotações internas" name="internalNotes" hint="Visível apenas para a equipe.">
            <textarea name="internalNotes" rows={2} defaultValue={a.internalNotes ?? ''} maxLength={2000} />
          </Field>
          <div>
            <SubmitButton>Salvar</SubmitButton>
          </div>
        </ActionForm>
      </section>

      {active && (
        <div className="grid-2">
          <section className="card">
            <h2 style={{ fontSize: '1.1rem' }}>Remarcar</h2>
            <ActionForm action={rescheduleAppointment} className="stack">
              <input type="hidden" name="id" value={a.id} />
              <div className="form-grid">
                <Field label="Nova data" name="day">
                  <input type="date" name="day" defaultValue={p.date} />
                </Field>
                <Field label="Horário" name="time">
                  <input type="time" name="time" defaultValue={p.time} step={300} />
                </Field>
              </div>
              <label className="check">
                <input type="checkbox" name="outside" /> Permitir fora do expediente
              </label>
              <p className="small muted" style={{ margin: 0 }}>
                O sistema impede conflitos com outras consultas e bloqueios.
              </p>
              <div>
                <SubmitButton>Remarcar</SubmitButton>
              </div>
            </ActionForm>
          </section>
          <section className="card">
            <h2 style={{ fontSize: '1.1rem' }}>Cancelar</h2>
            <ActionForm action={cancelAppointment} className="stack" confirm="Cancelar esta consulta e liberar o horário?">
              <input type="hidden" name="id" value={a.id} />
              <Field label="Motivo" name="reason">
                <input name="reason" maxLength={300} />
              </Field>
              <label className="check">
                <input type="checkbox" name="notify" defaultChecked /> Avisar o cliente (área do cliente e e-mail, se configurado)
              </label>
              <div>
                <SubmitButton className="btn btn--danger" pendingText="Cancelando…">
                  Cancelar consulta
                </SubmitButton>
              </div>
            </ActionForm>
          </section>
        </div>
      )}
    </div>
  )
}
