import Link from 'next/link'
import { and, asc, eq, isNull, lte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { appointmentsInRange, patientsByStatus, paymentsInRange, weightEvolution } from '@/lib/reports'
import { addDays, addMonths, fmtDay, isValidDay, startOfMonth, todayIn } from '@/lib/time'
import { money, num, STATUS_LABEL } from '@/lib/format'
import { NoAccess, PageHead, Stat } from '@/components/ui'

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requireTeam()
  if (!can(user, 'relatorios')) return <NoAccess />
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const from = isValidDay(sp.de) ? sp.de : startOfMonth(today)
  const toIncl = isValidDay(sp.ate) ? sp.ate : addDays(addMonths(startOfMonth(today), 1), -1)
  const range = { from, to: addDays(toIncl, 1), tz: s.timezone }
  const clinical = can(user, 'clinico')
  const finance = s.financeEnabled && can(user, 'financeiro')

  const [appts, statuses, evolution, payments, overdue, pendingConfirm] = await Promise.all([
    appointmentsInRange(range),
    patientsByStatus(),
    clinical ? weightEvolution() : Promise.resolve([]),
    finance ? paymentsInRange(range) : Promise.resolve([]),
    db
      .select()
      .from(schema.patients)
      .where(and(eq(schema.patients.status, 'ativo'), lte(schema.patients.nextFollowUp, today), isNull(schema.patients.anonymizedAt)))
      .orderBy(asc(schema.patients.nextFollowUp)),
    db.select().from(schema.appointments).where(eq(schema.appointments.status, 'pendente')),
  ])
  const by = (st: string) => appts.filter((a) => a.status === st).length
  const done = by('realizada')
  const canceled = by('cancelada')
  const noShow = by('faltou')
  const decided = done + noShow
  const byService = Object.entries(
    appts.filter((a) => a.status === 'realizada').reduce<Record<string, number>>((acc, a) => ((acc[a.serviceName] = (acc[a.serviceName] ?? 0) + 1), acc), {}),
  )
  const revenue = payments.reduce((n, r) => n + r.pay.amountCents - r.pay.discountCents, 0)
  const qs = `de=${from}&ate=${toIncl}`

  return (
    <div className="stack" style={{ ['--gap' as string]: '24px' }}>
      <PageHead title="Relatórios" subtitle={`Período: ${fmtDay(from)} a ${fmtDay(toIncl)}`} />
      <form className="card row" method="get">
        <label className="field">
          <span className="field__label">De</span>
          <input type="date" name="de" defaultValue={from} />
        </label>
        <label className="field">
          <span className="field__label">Até</span>
          <input type="date" name="ate" defaultValue={toIncl} />
        </label>
        <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
          Aplicar
        </button>
        <div className="row small" style={{ alignSelf: 'flex-end' }}>
          <Link href={`/admin/relatorios?de=${addMonths(startOfMonth(today), -1)}&ate=${addDays(startOfMonth(today), -1)}`}>Mês passado</Link>
          <Link href={`/admin/relatorios?de=${addMonths(startOfMonth(today), -2)}&ate=${toIncl}`}>Últimos 3 meses</Link>
        </div>
      </form>

      <section className="stack">
        <div className="row row--between">
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Atendimentos</h2>
          <a className="btn btn--sm" href={`/admin/relatorios/csv?tipo=atendimentos&${qs}`}>
            Exportar CSV
          </a>
        </div>
        <div className="grid-4">
          <Stat value={done} label="Realizados" />
          <Stat value={canceled} label="Cancelados" />
          <Stat value={noShow} label="Não comparecimentos" />
          <Stat value={decided ? `${Math.round((noShow / decided) * 100)}%` : '—'} label="Taxa de faltas" />
        </div>
        {byService.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Serviço</th>
                  <th className="num">Realizados</th>
                </tr>
              </thead>
              <tbody>
                {byService.map(([name, n]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td className="num">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <div className="card__head">
            <h2>Clientes por situação</h2>
            <a className="small" href={`/admin/relatorios/csv?tipo=pacientes`}>
              CSV
            </a>
          </div>
          <table>
            <tbody>
              {statuses.map((st) => (
                <tr key={st.status}>
                  <td>{STATUS_LABEL[st.status]}</td>
                  <td className="num">{st.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Pendências da agenda</h2>
          <ul className="list">
            <li className="row row--between">
              <span>Pedidos aguardando confirmação</span>
              <Link href="/admin/agenda?status=pendente">{pendingConfirm.length}</Link>
            </li>
            <li>
              <div className="row row--between">
                <span>Clientes ativos com retorno vencido</span>
                <strong>{overdue.length}</strong>
              </div>
              {overdue.length > 0 && (
                <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {overdue.slice(0, 10).map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/pacientes/${p.id}`}>{p.fullName}</Link> · previsto {fmtDay(p.nextFollowUp)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </section>
      </div>

      {clinical && (
        <section className="stack">
          <div className="row row--between">
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Evolução dos clientes ativos (peso, medições profissionais)</h2>
            <a className="btn btn--sm" href="/admin/relatorios/csv?tipo=evolucao">
              Exportar CSV
            </a>
          </div>
          {evolution.length === 0 ? (
            <p className="muted">Ainda não há clientes com duas ou mais avaliações.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Primeira</th>
                    <th>Última</th>
                    <th className="num">Variação</th>
                    <th className="num">Avaliações</th>
                  </tr>
                </thead>
                <tbody>
                  {evolution.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/admin/pacientes/${e.id}?aba=evolucao`}>{e.name}</Link>
                      </td>
                      <td className="nowrap">
                        {num(e.first_w)} kg · {fmtDay(String(e.first_date).slice(0, 10))}
                      </td>
                      <td className="nowrap">
                        {num(e.last_w)} kg · {fmtDay(String(e.last_date).slice(0, 10))}
                      </td>
                      <td className="num">
                        {e.last_w - e.first_w > 0 ? '+' : ''}
                        {num(e.last_w - e.first_w)} kg
                      </td>
                      <td className="num">{e.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small muted" style={{ margin: 0 }}>A variação de peso, isoladamente, não indica sucesso ou insucesso do acompanhamento; interprete junto às metas individuais.</p>
        </section>
      )}

      {finance && (
        <section className="stack">
          <div className="row row--between">
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Receitas registradas: {money(revenue)}</h2>
            <a className="btn btn--sm" href={`/admin/relatorios/csv?tipo=receitas&${qs}`}>
              Exportar CSV
            </a>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {payments.length} pagamentos no período · {payments.filter((p) => p.pay.source === 'provedor').length} confirmados por provedor · {payments.filter((p) => p.pay.source === 'manual').length} registros internos.
          </p>
        </section>
      )}
    </div>
  )
}
