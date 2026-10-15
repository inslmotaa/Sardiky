import Link from 'next/link'
import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { addMonths, capitalize, monthName, startOfMonth, todayIn } from '@/lib/time'
import { money } from '@/lib/format'
import { integrationStatus } from '@/lib/integrations'
import { savePackage, togglePackage } from '@/actions/admin/finance'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PaymentForm } from '@/components/PaymentForm'
import { PaymentsTable } from '@/components/PaymentsTable'
import { DemoTag, NoAccess, PageHead, Stat } from '@/components/ui'

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requireTeam()
  const s = await getSettings()
  if (!can(user, 'financeiro')) return <NoAccess />
  if (!s.financeEnabled)
    return (
      <div className="card">
        <h1>Financeiro desativado</h1>
        <p className="muted">O módulo financeiro é opcional e pode ser ativado em Configurações → Agendamento e módulos.</p>
      </div>
    )
  const today = todayIn(s.timezone)
  const month = /^\d{4}-\d{2}$/.test(sp.mes ?? '') ? `${sp.mes}-01` : startOfMonth(today)
  const next = addMonths(month, 1)
  const status = (['pendente', 'pago', 'cancelado', 'estornado'] as const).find((x) => x === sp.status)
  const net = sql<number>`${schema.payments.amountCents} - ${schema.payments.discountCents}`

  const [rows, pendingRows, monthly, packages, patients] = await Promise.all([
    db
      .select({ pay: schema.payments, name: schema.patients.fullName })
      .from(schema.payments)
      .leftJoin(schema.patients, eq(schema.patients.id, schema.payments.patientId))
      .where(
        status === 'pendente'
          ? eq(schema.payments.status, 'pendente')
          : and(
              status ? eq(schema.payments.status, status) : undefined,
              sql`coalesce(${schema.payments.paidAt}, ${schema.payments.dueDate}, ${schema.payments.createdAt}::date) >= ${month}`,
              sql`coalesce(${schema.payments.paidAt}, ${schema.payments.dueDate}, ${schema.payments.createdAt}::date) < ${next}`,
            ),
      )
      .orderBy(desc(schema.payments.createdAt)),
    db.select({ v: sql<number>`coalesce(sum(${net}),0)`.mapWith(Number) }).from(schema.payments).where(eq(schema.payments.status, 'pendente')),
    db
      .select({
        m: sql<string>`to_char(${schema.payments.paidAt}, 'YYYY-MM')`,
        v: sql<number>`sum(${net})`.mapWith(Number),
        manual: sql<number>`sum(${net}) filter (where ${schema.payments.source} = 'manual')`.mapWith(Number),
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.payments)
      .where(and(eq(schema.payments.status, 'pago'), gte(schema.payments.paidAt, addMonths(month, -11)), lt(schema.payments.paidAt, next)))
      .groupBy(sql`to_char(${schema.payments.paidAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${schema.payments.paidAt}, 'YYYY-MM')`),
    db.select().from(schema.packages).orderBy(asc(schema.packages.name)),
    db.select({ id: schema.patients.id, name: schema.patients.fullName }).from(schema.patients).where(isNull(schema.patients.anonymizedAt)).orderBy(asc(schema.patients.fullName)),
  ])
  const received = rows.filter((r) => r.pay.status === 'pago').reduce((n, r) => n + r.pay.amountCents - r.pay.discountCents, 0)
  const discounts = rows.filter((r) => r.pay.status === 'pago').reduce((n, r) => n + r.pay.discountCents, 0)
  const maxMonth = Math.max(1, ...monthly.map((m) => m.v))
  const label = `${monthName(Number(month.slice(5, 7)))} de ${month.slice(0, 4)}`

  return (
    <div className="stack" style={{ ['--gap' as string]: '24px' }}>
      <PageHead title="Financeiro" subtitle={status === 'pendente' ? 'Todos os valores pendentes' : capitalize(label)} />
      {!integrationStatus().payments && (
        <p className="alert alert--info small">
          <DemoTag>Pagamentos on-line não integrados</DemoTag> Todos os valores aqui são <strong>registros internos</strong> lançados pela equipe. Quando um provedor (ex.: Mercado
          Pago, Stripe, Asaas) for integrado, os pagamentos confirmados por ele aparecerão marcados como “Confirmado por provedor”.
        </p>
      )}
      <div className="row row--between">
        <div className="row">
          <Link className="btn btn--sm" href={`/admin/financeiro?mes=${addMonths(month, -1).slice(0, 7)}`}>
            ‹ Mês anterior
          </Link>
          <Link className="btn btn--sm" href="/admin/financeiro">
            Mês atual
          </Link>
          <Link className="btn btn--sm" href={`/admin/financeiro?mes=${next.slice(0, 7)}`}>
            Próximo ›
          </Link>
        </div>
        <nav className="row small" aria-label="Filtrar">
          {(['pendente', 'pago', 'cancelado', 'estornado'] as const).map((st) => (
            <Link key={st} className={`badge ${status === st ? 'badge--brand' : 'badge--plain'}`} href={`/admin/financeiro?status=${st}${st !== 'pendente' ? `&mes=${month.slice(0, 7)}` : ''}`}>
              {st}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid-4">
        <Stat value={money(received)} label="Recebido no mês (registrado)" />
        <Stat value={money(pendingRows[0].v)} label="Total pendente" href="/admin/financeiro?status=pendente" />
        <Stat value={money(discounts)} label="Descontos concedidos no mês" />
        <Stat value={rows.filter((r) => r.pay.status === 'pago').length} label="Pagamentos no mês" />
      </div>

      <section>
        <h2 style={{ fontSize: '1.1rem' }}>Lançamentos</h2>
        <PaymentsTable rows={rows} />
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Novo lançamento</h2>
          <PaymentForm patients={patients} packages={packages.filter((p) => p.active)} />
        </section>
        <section className="stack">
          <div className="card">
            <h2 style={{ fontSize: '1.1rem' }}>Receita mensal (últimos 12 meses)</h2>
            {monthly.length === 0 ? (
              <p className="muted">Sem pagamentos registrados no período.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Receita</th>
                    <th className="num">Pagamentos</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m) => (
                    <tr key={m.m}>
                      <td className="nowrap">
                        {m.m.slice(5)}/{m.m.slice(0, 4)}
                      </td>
                      <td style={{ width: '60%' }}>
                        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                          <div className="progress" style={{ flex: 1 }} aria-hidden>
                            <span style={{ width: `${(m.v / maxMonth) * 100}%` }} />
                          </div>
                          <span className="nowrap small">{money(m.v)}</span>
                        </div>
                      </td>
                      <td className="num">{m.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="small muted" style={{ margin: '8px 0 0' }}>
              Valores líquidos (com descontos), por data de pagamento. Exportação detalhada em Relatórios.
            </p>
          </div>
          <div className="card">
            <h2 style={{ fontSize: '1.1rem' }}>Pacotes de acompanhamento</h2>
            <ul className="list">
              {packages.map((p) => (
                <li key={p.id} className="row row--between">
                  <span>
                    <strong>{p.name}</strong> · {money(p.priceCents)} · {p.sessions} consultas · {p.validityDays} dias
                    {p.description && <div className="small muted">{p.description}</div>}
                  </span>
                  <form action={togglePackage.bind(null, p.id)}>
                    <button className="link-btn small" type="submit">
                      {p.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <details className="disclosure" style={{ marginTop: 12 }}>
              <summary>Novo pacote</summary>
              <div>
                <ActionForm action={savePackage} className="stack" resetOnSuccess>
                  <Field label="Nome" name="name">
                    <input name="name" maxLength={80} />
                  </Field>
                  <Field label="Descrição" name="description">
                    <input name="description" maxLength={300} />
                  </Field>
                  <div className="form-grid form-grid--3">
                    <Field label="Consultas" name="sessions">
                      <input name="sessions" inputMode="numeric" defaultValue="3" />
                    </Field>
                    <Field label="Valor (R$)" name="price">
                      <input name="price" inputMode="decimal" />
                    </Field>
                    <Field label="Validade (dias)" name="validityDays">
                      <input name="validityDays" inputMode="numeric" defaultValue="90" />
                    </Field>
                  </div>
                  <div>
                    <SubmitButton>Criar pacote</SubmitButton>
                  </div>
                </ActionForm>
              </div>
            </details>
          </div>
        </section>
      </div>
    </div>
  )
}
