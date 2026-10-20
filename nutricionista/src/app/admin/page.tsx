import Link from 'next/link'
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, sql, sum } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { addDays, capitalize, fmtDateTime, fmtDay, fmtDayLong, fmtTime, startOfMonth, todayIn, zonedToUtc } from '@/lib/time'
import { money } from '@/lib/format'
import { trackingBoard } from '@/lib/tracking'
import { PageHead, Stat, StatusBadge } from '@/components/ui'

export default async function AdminHome() {
  const user = await requireTeam()
  const s = await getSettings()
  const tz = s.timezone
  const today = todayIn(tz)
  const dayStart = zonedToUtc(today, '00:00', tz)
  const dayEnd = zonedToUtc(addDays(today, 1), '00:00', tz)
  const weekEnd = zonedToUtc(addDays(today, 8), '00:00', tz)
  const agenda = can(user, 'agenda')
  const clinical = can(user, 'clinico')
  const cadastro = can(user, 'cadastro') || clinical
  const finance = s.financeEnabled && can(user, 'financeiro')
  const board = clinical ? await trackingBoard(today, tz, { good: s.adherenceGood, low: s.adherenceLow }) : null
  const tracking = board
    ? {
        // Só faz sentido cobrar registro de quem já tem acesso ao app e plano ativo.
        inactive: board.filter((r) => r.hasAccess && r.hasPlan && (r.daysWithout == null || r.daysWithout >= 3)),
        struggling: board.filter((r) => r.klass === 'dificuldade').length,
      }
    : null

  const [[active], [newPatients], todayAppts, upcoming, pending, followUp, forms, unread, [monthPaid], [openAmount]] = await Promise.all([
    db.select({ n: count() }).from(schema.patients).where(and(eq(schema.patients.status, 'ativo'), isNull(schema.patients.anonymizedAt))),
    db.select({ n: count() }).from(schema.patients).where(gte(schema.patients.createdAt, zonedToUtc(addDays(today, -30), '00:00', tz))),
    agenda
      ? db.select().from(schema.appointments).where(and(gte(schema.appointments.startAt, dayStart), lt(schema.appointments.startAt, dayEnd))).orderBy(asc(schema.appointments.startAt))
      : [],
    agenda
      ? db
          .select()
          .from(schema.appointments)
          .where(and(gte(schema.appointments.startAt, dayEnd), lt(schema.appointments.startAt, weekEnd), inArray(schema.appointments.status, ['pendente', 'confirmada'])))
          .orderBy(asc(schema.appointments.startAt))
          .limit(8)
      : [],
    agenda
      ? db
          .select()
          .from(schema.appointments)
          .where(and(eq(schema.appointments.status, 'pendente'), gte(schema.appointments.startAt, new Date())))
          .orderBy(asc(schema.appointments.startAt))
      : [],
    cadastro
      ? db
          .select()
          .from(schema.patients)
          .where(and(eq(schema.patients.status, 'ativo'), lte(schema.patients.nextFollowUp, addDays(today, 3))))
          .orderBy(asc(schema.patients.nextFollowUp))
          .limit(8)
      : [],
    clinical
      ? db
          .select({ id: schema.formAssignments.id, title: schema.formAssignments.title, dueDate: schema.formAssignments.dueDate, patientId: schema.patients.id, name: schema.patients.fullName })
          .from(schema.formAssignments)
          .innerJoin(schema.patients, eq(schema.patients.id, schema.formAssignments.patientId))
          .where(and(isNull(schema.formAssignments.answeredAt), lte(schema.formAssignments.dueDate, addDays(today, 5))))
          .orderBy(asc(schema.formAssignments.dueDate))
          .limit(8)
      : [],
    clinical
      ? db
          .select({ patientId: schema.messages.patientId, name: schema.patients.fullName, n: count(), last: sql<Date>`max(${schema.messages.createdAt})` })
          .from(schema.messages)
          .innerJoin(schema.patients, eq(schema.patients.id, schema.messages.patientId))
          .where(and(eq(schema.messages.fromPatient, true), isNull(schema.messages.readAt)))
          .groupBy(schema.messages.patientId, schema.patients.fullName)
          .orderBy(desc(sql`max(${schema.messages.createdAt})`))
      : [],
    finance
      ? db
          .select({ v: sum(sql`${schema.payments.amountCents} - ${schema.payments.discountCents}`) })
          .from(schema.payments)
          .where(and(eq(schema.payments.status, 'pago'), gte(schema.payments.paidAt, startOfMonth(today))))
      : [{ v: null }],
    finance
      ? db.select({ v: sum(sql`${schema.payments.amountCents} - ${schema.payments.discountCents}`) }).from(schema.payments).where(eq(schema.payments.status, 'pendente'))
      : [{ v: null }],
  ])

  const activeToday = todayAppts.filter((a) => a.status !== 'cancelada')

  return (
    <div className="stack" style={{ ['--gap' as string]: '24px' }}>
      <PageHead
        title={`Olá, ${user.name.split(' ')[0]}`}
        subtitle={capitalize(fmtDayLong(today))}
        actions={
          <>
            {agenda && (
              <Link href="/admin/agenda/nova" className="btn">
                Nova consulta
              </Link>
            )}
            {cadastro && (
              <Link href="/admin/pacientes/novo" className="btn btn--primary">
                Novo paciente
              </Link>
            )}
          </>
        }
      />

      {clinical && tracking && (tracking.inactive.length > 0 || tracking.struggling > 0) && (
        <section className="card card--soft" aria-label="Alertas de acompanhamento">
          <div className="card__head">
            <h2 style={{ fontSize: '1.05rem' }}>Acompanhamento</h2>
            <Link href="/admin/acompanhamento" className="small">
              Abrir painel
            </Link>
          </div>
          <ul className="list">
            {tracking.inactive.length > 0 && (
              <li>
                <strong>
                  {tracking.inactive.length} {tracking.inactive.length === 1 ? 'paciente sem registrar' : 'pacientes sem registrar'} há 3 dias ou mais:
                </strong>{' '}
                {tracking.inactive.slice(0, 6).map((r, i) => (
                  <span key={r.id}>
                    {i > 0 && ', '}
                    <Link href={`/admin/pacientes/${r.id}?aba=diario`}>{r.name}</Link>
                  </span>
                ))}
                {tracking.inactive.length > 6 && '…'}
              </li>
            )}
            {tracking.struggling > 0 && (
              <li>
                <Link href="/admin/acompanhamento?grupo=dificuldade">
                  {tracking.struggling} {tracking.struggling === 1 ? 'paciente com dificuldade' : 'pacientes com dificuldade'} na última semana
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <div className="grid-4">
        <Stat value={active.n} label="Pacientes ativos" href={cadastro ? '/admin/pacientes?status=ativo' : undefined} />
        <Stat value={newPatients.n} label="Novos cadastros (30 dias)" href={cadastro ? '/admin/pacientes' : undefined} />
        {agenda && <Stat value={activeToday.length} label="Consultas hoje" href="/admin/agenda?view=dia" />}
        {agenda && <Stat value={pending.length} label="Aguardando confirmação" href="/admin/agenda?status=pendente" />}
        {finance && <Stat value={money(Number(monthPaid.v ?? 0))} label="Recebido no mês (registrado)" href="/admin/financeiro" />}
        {finance && <Stat value={money(Number(openAmount.v ?? 0))} label="Valores pendentes" href="/admin/financeiro?status=pendente" />}
      </div>

      {agenda && (
        <div className="grid-2">
          <section className="card">
            <div className="card__head">
              <h2>Agenda de hoje</h2>
              <Link href="/admin/agenda?view=dia" className="small">
                Abrir agenda
              </Link>
            </div>
            {todayAppts.length === 0 ? (
              <p className="muted">Nenhuma consulta hoje.</p>
            ) : (
              <ul className="timeline">
                {todayAppts.map((a) => (
                  <li key={a.id}>
                    <time>{fmtTime(a.startAt, tz)}</time>
                    <Link href={`/admin/agenda/${a.id}`} className={`cal-event cal-event--${a.status}`}>
                      <strong>{a.contactName}</strong> · {a.serviceName} · {a.modality === 'online' ? 'on-line' : 'presencial'}
                      <div>
                        <StatusBadge status={a.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <h2>Pendentes de confirmação</h2>
            </div>
            {pending.length === 0 ? (
              <p className="muted">Nenhum pedido aguardando.</p>
            ) : (
              <ul className="list">
                {pending.map((a) => (
                  <li key={a.id} className="row row--between">
                    <span>
                      <strong>{a.contactName}</strong>
                      {!a.isReturning && <span className="badge badge--info" style={{ marginLeft: 6 }}>Novo</span>}
                      <div className="small muted">
                        {fmtDateTime(a.startAt, tz)} · {a.serviceName}
                      </div>
                    </span>
                    <Link href={`/admin/agenda/${a.id}`} className="btn btn--sm btn--primary">
                      Revisar
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {upcoming.length > 0 && (
              <>
                <h3 style={{ marginTop: 20 }}>Próximos 7 dias</h3>
                <ul className="list small">
                  {upcoming.map((a) => (
                    <li key={a.id}>
                      <Link href={`/admin/agenda/${a.id}`}>{fmtDateTime(a.startAt, tz)}</Link> · {a.contactName} · {a.serviceName}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}

      <div className="grid-3">
        {cadastro && (
          <section className="card">
            <div className="card__head">
              <h2>Precisam de acompanhamento</h2>
            </div>
            {followUp.length === 0 ? (
              <p className="muted">Nenhum retorno vencido.</p>
            ) : (
              <ul className="list">
                {followUp.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/pacientes/${p.id}`}>{p.fullName}</Link>
                    <div className="small muted">
                      Retorno previsto: {fmtDay(p.nextFollowUp)}
                      {p.nextFollowUp && p.nextFollowUp < today && <span className="badge badge--danger" style={{ marginLeft: 6 }}>Atrasado</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {clinical && (
          <section className="card">
            <div className="card__head">
              <h2>Avaliações próximas do prazo</h2>
            </div>
            {forms.length === 0 ? (
              <p className="muted">Nada vencendo.</p>
            ) : (
              <ul className="list">
                {forms.map((f) => (
                  <li key={f.id}>
                    <Link href={`/admin/pacientes/${f.patientId}?aba=formularios`}>{f.name}</Link>
                    <div className="small muted">
                      {f.title} · {f.dueDate && f.dueDate < today ? <span style={{ color: 'var(--danger)' }}>venceu em {fmtDay(f.dueDate)}</span> : `até ${fmtDay(f.dueDate)}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {clinical && (
          <section className="card">
            <div className="card__head">
              <h2>Mensagens não lidas</h2>
              <Link href="/admin/mensagens" className="small">
                Todas
              </Link>
            </div>
            {unread.length === 0 ? (
              <p className="muted">Caixa em dia.</p>
            ) : (
              <ul className="list">
                {unread.map((m) => (
                  <li key={m.patientId} className="row row--between">
                    <Link href={`/admin/pacientes/${m.patientId}?aba=mensagens`}>{m.name}</Link>
                    <span className="badge badge--warn">{m.n}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
