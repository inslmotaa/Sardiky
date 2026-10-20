import Link from 'next/link'
import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, or } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { visiblePatientIds } from '@/lib/team-access'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import {
  addDays,
  addMonths,
  capitalize,
  daysInMonth,
  fmtDateTime,
  fmtDay,
  fmtDayLong,
  fmtTime,
  isValidDay,
  monthName,
  startOfMonth,
  startOfWeek,
  todayIn,
  weekdayOf,
  weekdayShort,
  zonedParts,
  zonedToUtc,
} from '@/lib/time'
import { STATUS_LABEL } from '@/lib/format'
import { createBlock, deleteBlock, importHolidays } from '@/actions/admin/appointments'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { NoAccess, PageHead, StatusBadge, Empty } from '@/components/ui'

type View = 'dia' | 'semana' | 'mes' | 'lista'

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requireTeam()
  const own = await visiblePatientIds(user)
  if (!can(user, 'agenda')) return <NoAccess />
  const s = await getSettings()
  const tz = s.timezone
  const today = todayIn(tz)
  const date = isValidDay(sp.data) ? sp.data : today
  const status = sp.status && sp.status in STATUS_LABEL ? sp.status : undefined
  const view: View = status ? 'lista' : (['dia', 'semana', 'mes', 'lista'] as const).find((v) => v === sp.view) ?? 'semana'

  let from: string
  let to: string
  if (view === 'dia') {
    from = date
    to = addDays(date, 1)
  } else if (view === 'semana') {
    from = startOfWeek(date)
    to = addDays(from, 7)
  } else if (view === 'mes') {
    from = startOfWeek(startOfMonth(date))
    to = addDays(startOfMonth(date), daysInMonth(date))
    to = addDays(startOfWeek(addDays(to, -1)), 7)
  } else {
    from = addDays(today, -90)
    to = addDays(today, 120)
  }
  const fromUtc = zonedToUtc(from, '00:00', tz)
  const toUtc = zonedToUtc(to, '00:00', tz)

  const [appts, blocks] = await Promise.all([
    db
      .select()
      .from(schema.appointments)
      .where(
        and(
          gte(schema.appointments.startAt, fromUtc),
          lt(schema.appointments.startAt, toUtc),
          status ? eq(schema.appointments.status, status as 'pendente') : undefined,
          // Nutricionista com pacientes próprios: só as consultas dos seus pacientes (e pedidos novos, ainda sem cadastro).
          own ? or(isNull(schema.appointments.patientId), own.length ? inArray(schema.appointments.patientId, own) : undefined) : undefined,
        ),
      )
      .orderBy(view === 'lista' && !status ? desc(schema.appointments.startAt) : asc(schema.appointments.startAt)),
    db.select().from(schema.timeBlocks).where(and(lt(schema.timeBlocks.startAt, toUtc), gt(schema.timeBlocks.endAt, fromUtc))).orderBy(asc(schema.timeBlocks.startAt)),
  ])

  const dayOf = (d: Date) => zonedParts(d, tz).date
  const apptsOn = (d: string) => appts.filter((a) => dayOf(a.startAt) === d)
  const blocksOn = (d: string) => blocks.filter((b) => dayOf(b.startAt) <= d && dayOf(new Date(b.endAt.getTime() - 1)) >= d)

  const step = view === 'dia' ? 1 : view === 'semana' ? 7 : 0
  const prev = view === 'mes' ? addMonths(date, -1) : addDays(date, -step)
  const next = view === 'mes' ? addMonths(date, 1) : addDays(date, step)
  const link = (v: View, d = date) => `/admin/agenda?view=${v}&data=${d}`

  const title =
    view === 'dia'
      ? fmtDayLong(date)
      : view === 'semana'
        ? `Semana de ${fmtDay(from)} a ${fmtDay(addDays(from, 6))}`
        : view === 'mes'
          ? `${monthName(Number(date.slice(5, 7)))} de ${date.slice(0, 4)}`
          : status
            ? `Consultas: ${STATUS_LABEL[status].toLowerCase()}`
            : 'Histórico e próximas consultas'

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title="Agenda"
        subtitle={capitalize(title)}
        actions={
          <Link href="/admin/agenda/nova" className="btn btn--primary">
            Nova consulta
          </Link>
        }
      />

      <div className="row row--between">
        <nav className="segmented" aria-label="Visualização">
          <Link href={link('dia')} aria-current={view === 'dia' ? 'page' : undefined}>
            Dia
          </Link>
          <Link href={link('semana')} aria-current={view === 'semana' ? 'page' : undefined}>
            Semana
          </Link>
          <Link href={link('mes')} aria-current={view === 'mes' ? 'page' : undefined}>
            Mês
          </Link>
          <Link href="/admin/agenda?view=lista" aria-current={view === 'lista' && !status ? 'page' : undefined}>
            Lista
          </Link>
        </nav>
        {view !== 'lista' && (
          <div className="row">
            <Link href={link(view, prev)} className="btn btn--sm" aria-label="Anterior">
              ‹ Anterior
            </Link>
            <Link href={link(view, today)} className="btn btn--sm">
              Hoje
            </Link>
            <Link href={link(view, next)} className="btn btn--sm" aria-label="Próximo">
              Próximo ›
            </Link>
          </div>
        )}
        {view === 'lista' && (
          <nav className="row small" aria-label="Filtrar por situação">
            {['pendente', 'confirmada', 'realizada', 'cancelada', 'faltou'].map((st) => (
              <Link key={st} href={`/admin/agenda?status=${st}`} className={`badge ${status === st ? 'badge--brand' : 'badge--plain'}`}>
                {STATUS_LABEL[st]}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {view === 'dia' && (
        <section className="card">
          {apptsOn(date).length === 0 && blocksOn(date).length === 0 ? (
            <p className="muted">Nenhum compromisso neste dia.</p>
          ) : (
            <ul className="timeline">
              {blocksOn(date).map((b) => (
                <li key={b.id}>
                  <time>{dayOf(b.startAt) === date ? fmtTime(b.startAt, tz) : '—'}</time>
                  <div className="cal-event cal-event--block row row--between">
                    <span>
                      Bloqueado até {dayOf(b.endAt) === date ? fmtTime(b.endAt, tz) : fmtDateTime(b.endAt, tz)} {b.reason && `· ${b.reason}`}
                    </span>
                    <form action={deleteBlock.bind(null, b.id)}>
                      <button className="link-btn small" type="submit">
                        Remover bloqueio
                      </button>
                    </form>
                  </div>
                </li>
              ))}
              {apptsOn(date).map((a) => (
                <li key={a.id}>
                  <time>{fmtTime(a.startAt, tz)}</time>
                  <Link href={`/admin/agenda/${a.id}`} className={`cal-event cal-event--${a.status}`}>
                    <strong>{a.contactName}</strong> · {a.serviceName} · {a.modality === 'online' ? 'on-line' : 'presencial'} · até {fmtTime(a.endAt, tz)}
                    <div>
                      <StatusBadge status={a.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {view === 'semana' && (
        <div className="cal-week">
          {Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => (
            <div key={d} className={`cal-day ${d === today ? 'cal-day--today' : ''}`}>
              <Link href={link('dia', d)} className="cal-day__head">
                {weekdayShort(weekdayOf(d))} {d.slice(8)}/{d.slice(5, 7)}
              </Link>
              {blocksOn(d).map((b) => (
                <span key={b.id} className="cal-event cal-event--block">
                  Bloqueio {dayOf(b.startAt) === d ? fmtTime(b.startAt, tz) : ''}
                  {b.reason && <div className="small">{b.reason}</div>}
                </span>
              ))}
              {apptsOn(d).map((a) => (
                <Link key={a.id} href={`/admin/agenda/${a.id}`} className={`cal-event cal-event--${a.status}`} title={STATUS_LABEL[a.status]}>
                  <strong>{fmtTime(a.startAt, tz)}</strong> {a.contactName}
                  <div className="small">
                    {a.modality === 'online' ? 'On-line' : 'Presencial'} · {STATUS_LABEL[a.status]}
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      {view === 'mes' && (
        <div>
          <div className="cal-month" aria-hidden>
            {[1, 2, 3, 4, 5, 6, 0].map((w) => (
              <div key={w} className="cal-month__wd">
                {weekdayShort(w)}
              </div>
            ))}
          </div>
          <div className="cal-month">
            {Array.from({ length: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) }, (_, i) => addDays(from, i)).map((d) => {
              const list = apptsOn(d).filter((a) => a.status !== 'cancelada')
              return (
                <Link
                  key={d}
                  href={link('dia', d)}
                  className={`cal-cell ${d.slice(0, 7) !== date.slice(0, 7) ? 'cal-cell--out' : ''} ${d === today ? 'cal-cell--today' : ''}`}
                  aria-label={`${fmtDayLong(d)}: ${list.length} consultas`}
                >
                  <span className="cal-cell__n">{Number(d.slice(8))}</span>
                  {blocksOn(d).length > 0 && <span className="cal-dot" style={{ background: 'var(--surface-2)' }}>Bloqueio</span>}
                  {list.slice(0, 3).map((a) => (
                    <span key={a.id} className={`cal-dot cal-dot--${a.status}`}>
                      {fmtTime(a.startAt, tz)} {a.contactName.split(' ')[0]}
                    </span>
                  ))}
                  {list.length > 3 && <span className="small muted">+{list.length - 3}</span>}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {view === 'lista' &&
        (appts.length === 0 ? (
          <Empty>Nenhuma consulta encontrada.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Paciente / contato</th>
                  <th>Serviço</th>
                  <th>Modalidade</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {appts.map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{fmtDateTime(a.startAt, tz)}</td>
                    <td>
                      {a.contactName}
                      {!a.patientId && <span className="badge badge--info" style={{ marginLeft: 6 }}>Sem cadastro</span>}
                    </td>
                    <td>{a.serviceName}</td>
                    <td>{a.modality === 'online' ? 'On-line' : 'Presencial'}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <Link href={`/admin/agenda/${a.id}`}>Abrir</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      <details className="disclosure">
        <summary>Bloquear horário (férias, eventos, compromissos)</summary>
        <div>
          <ActionForm action={createBlock} className="stack" resetOnSuccess>
            <div className="form-grid">
              <Field label="Data de início" name="day">
                <input type="date" name="day" defaultValue={date} />
              </Field>
              <Field label="Hora de início" name="start">
                <input type="time" name="start" defaultValue="08:00" />
              </Field>
              <Field label="Data de fim" name="endDay">
                <input type="date" name="endDay" defaultValue={date} />
              </Field>
              <Field label="Hora de fim" name="end">
                <input type="time" name="end" defaultValue="18:00" />
              </Field>
            </div>
            <Field label="Motivo (interno)" name="reason">
              <input name="reason" maxLength={200} />
            </Field>
            <div>
              <SubmitButton>Bloquear</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>
      <details className="disclosure">
        <summary>Feriados nacionais</summary>
        <div>
          <ActionForm action={importHolidays} className="row">
            <Field label="Ano" name="year">
              <input name="year" type="number" min={2024} max={2100} defaultValue={date.slice(0, 4)} style={{ width: 110 }} />
            </Field>
            <label className="check" style={{ alignSelf: 'flex-end', paddingBottom: 10 }}>
              <input type="checkbox" name="optional" /> Incluir Carnaval e Corpus Christi (ponto facultativo)
            </label>
            <div style={{ alignSelf: 'flex-end' }}>
              <SubmitButton>Bloquear feriados</SubmitButton>
            </div>
          </ActionForm>
          <p className="small muted">Bloqueia o dia inteiro de cada feriado nacional. Feriados estaduais e municipais podem ser bloqueados acima, um a um.</p>
        </div>
      </details>
    </div>
  )
}
