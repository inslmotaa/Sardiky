import Link from 'next/link'
import { and, asc, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { fmtDay, todayIn, zonedParts } from '@/lib/time'
import { NoAccess, PageHead, StatusBadge, Empty } from '@/components/ui'

const STATUSES = ['ativo', 'pausado', 'inativo', 'alta'] as const
const STATUS_TEXT = { ativo: 'Ativo', pausado: 'Pausado', inativo: 'Inativo', alta: 'Alta' }

export default async function PatientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requireTeam()
  if (!can(user, 'cadastro') && !can(user, 'clinico')) return <NoAccess />
  const s = await getSettings()
  const q = (sp.q ?? '').trim().slice(0, 80)
  const status = STATUSES.find((x) => x === sp.status)
  const stage = sp.etapa?.slice(0, 80)
  const like = `%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`

  const lastVisit = sql<Date | null>`(select max(a.start_at) from appointments a where a.patient_id = ${schema.patients.id} and a.status = 'realizada')`
  const nextVisit = sql<Date | null>`(select min(a.start_at) from appointments a where a.patient_id = ${schema.patients.id} and a.status in ('pendente','confirmada') and a.start_at > now())`

  const [rows, stages] = await Promise.all([
    db
      .select({ p: schema.patients, lastVisit, nextVisit })
      .from(schema.patients)
      .where(
        and(
          isNull(schema.patients.anonymizedAt),
          status ? eq(schema.patients.status, status) : undefined,
          stage ? eq(schema.patients.stage, stage) : undefined,
          q ? or(ilike(schema.patients.fullName, like), ilike(schema.patients.email, like), ilike(schema.patients.phone, like)) : undefined,
        ),
      )
      .orderBy(asc(schema.patients.fullName))
      .limit(300),
    db.selectDistinct({ stage: schema.patients.stage }).from(schema.patients).orderBy(asc(schema.patients.stage)),
  ])
  const today = todayIn(s.timezone)
  const asDate = (v: Date | string | null) => (v ? zonedParts(new Date(v), s.timezone).date : null)

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead
        title="Pacientes"
        subtitle={`${rows.length} ${rows.length === 1 ? 'paciente' : 'pacientes'}`}
        actions={
          can(user, 'cadastro') && (
            <Link href="/admin/pacientes/novo" className="btn btn--primary">
              Novo paciente
            </Link>
          )
        }
      />
      <form className="card row" method="get" role="search">
        <label className="field" style={{ flex: '2 1 220px' }}>
          <span className="field__label">Buscar</span>
          <input type="search" name="q" defaultValue={q} placeholder="Nome, e-mail ou telefone" />
        </label>
        <label className="field" style={{ flex: '1 1 140px' }}>
          <span className="field__label">Situação</span>
          <select name="status" defaultValue={status ?? ''}>
            <option value="">Todas</option>
            {STATUSES.map((x) => (
              <option key={x} value={x}>
                {STATUS_TEXT[x]}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          <span className="field__label">Etapa</span>
          <select name="etapa" defaultValue={stage ?? ''}>
            <option value="">Todas</option>
            {stages.map((x) => (
              <option key={x.stage}>{x.stage}</option>
            ))}
          </select>
        </label>
        <div className="row" style={{ alignSelf: 'flex-end' }}>
          <button className="btn" type="submit">
            Filtrar
          </button>
          {(q || status || stage) && (
            <Link href="/admin/pacientes" className="btn btn--ghost">
              Limpar
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 ? (
        <Empty>Nenhum paciente encontrado.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Situação</th>
                <th>Etapa</th>
                <th>Última consulta</th>
                <th>Próxima</th>
                <th>Retorno previsto</th>
                <th>Acesso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, lastVisit: lv, nextVisit: nv }) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/pacientes/${p.id}`}>
                      <strong>{p.fullName}</strong>
                    </Link>
                    <div className="small muted">{p.email ?? p.phone ?? ''}</div>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>{p.stage}</td>
                  <td className="nowrap">{fmtDay(asDate(lv))}</td>
                  <td className="nowrap">{fmtDay(asDate(nv))}</td>
                  <td className="nowrap">
                    {fmtDay(p.nextFollowUp)}
                    {p.status === 'ativo' && p.nextFollowUp && p.nextFollowUp < today && !nv && (
                      <span className="badge badge--danger" style={{ marginLeft: 6 }}>
                        Atrasado
                      </span>
                    )}
                  </td>
                  <td>{p.userId ? <span className="badge badge--ok">Liberado</span> : <span className="badge badge--plain">Sem acesso</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
