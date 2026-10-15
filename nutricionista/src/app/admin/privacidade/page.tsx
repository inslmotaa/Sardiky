import Link from 'next/link'
import { and, asc, desc, ilike, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { anonymizePatient, resolveDataRequest } from '@/actions/admin/lgpd'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { NoAccess, PageHead, StatusBadge } from '@/components/ui'

const TYPES: Record<string, string> = { acesso: 'Acesso', correcao: 'Correção', exclusao: 'Eliminação', portabilidade: 'Portabilidade', revogacao: 'Revogação de consentimento' }

export default async function PrivacyAdminPage({ searchParams }: { searchParams: Promise<{ acao?: string }> }) {
  const sp = await searchParams
  const user = await requireTeam()
  if (!can(user, 'config')) return <NoAccess />
  const s = await getSettings()
  const action = (sp.acao ?? '').replace(/[^a-z_]/g, '').slice(0, 40)
  const [requests, logs, patients] = await Promise.all([
    db
      .select({ r: schema.dataRequests })
      .from(schema.dataRequests)
      .orderBy(asc(schema.dataRequests.status), desc(schema.dataRequests.createdAt)),
    db
      .select()
      .from(schema.auditLogs)
      .where(action ? ilike(schema.auditLogs.action, `%${action}%`) : undefined)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(150),
    db.select({ id: schema.patients.id, name: schema.patients.fullName }).from(schema.patients).where(and(isNull(schema.patients.anonymizedAt))).orderBy(asc(schema.patients.fullName)),
  ])
  return (
    <div className="stack" style={{ ['--gap' as string]: '24px' }}>
      <PageHead title="Privacidade e auditoria" subtitle="Solicitações de titulares (LGPD), anonimização e trilha de atividades." />

      <section className="stack">
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Solicitações de titulares</h2>
        {requests.length === 0 ? (
          <p className="muted">Nenhuma solicitação.</p>
        ) : (
          requests.map(({ r }) => (
            <div key={r.id} className="card">
              <div className="row row--between">
                <div>
                  <strong>{TYPES[r.type] ?? r.type}</strong> · {r.requesterName}
                  <div className="small muted">
                    {fmtDateTime(r.createdAt, s.timezone)}
                    {r.patientId && (
                      <>
                        {' · '}
                        <Link href={`/admin/pacientes/${r.patientId}`}>abrir paciente</Link>
                      </>
                    )}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.details && <p className="small" style={{ margin: '8px 0' }}>“{r.details}”</p>}
              {r.status === 'aberta' || r.status === 'em_andamento' ? (
                <ActionForm action={resolveDataRequest} className="row">
                  <input type="hidden" name="id" value={r.id} />
                  <select name="status" defaultValue="concluida" aria-label="Nova situação" style={{ maxWidth: 200 }}>
                    <option value="em_andamento">Em andamento</option>
                    <option value="concluida">Concluída</option>
                    <option value="negada">Negada (com justificativa)</option>
                  </select>
                  <input name="response" placeholder="Resposta ao titular" aria-label="Resposta" style={{ flex: 1, minWidth: 220 }} />
                  <SubmitButton className="btn btn--sm btn--primary">Atualizar</SubmitButton>
                </ActionForm>
              ) : (
                r.response && <p className="small muted" style={{ margin: 0 }}>Resposta: {r.response}</p>
              )}
            </div>
          ))
        )}
        <p className="small muted" style={{ margin: 0 }}>
          A LGPD prevê resposta em prazo razoável (para confirmação e acesso completo, até 15 dias). Para exportar os dados de um paciente sem acesso à área exclusiva, use os
          relatórios e o prontuário.
        </p>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Anonimizar paciente</h2>
        <p className="small">
          Remove de forma irreversível nome, contatos, conta de acesso, mensagens, diário, avaliações, planos, formulários, notas e arquivos. Consultas e lançamentos financeiros
          ficam apenas como registros sem identificação. <strong>Antes, verifique o prazo de guarda do prontuário exigido pelas normas do CFN/CRN e pela legislação.</strong>
        </p>
        <ActionForm action={anonymizePatient} className="stack" confirm="Esta ação é irreversível. Continuar?">
          <div className="form-grid">
            <Field label="Paciente" name="patientId">
              <select name="patientId" defaultValue="">
                <option value="">Selecione</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Digite ANONIMIZAR para confirmar" name="confirm">
              <input name="confirm" autoComplete="off" />
            </Field>
          </div>
          <div>
            <SubmitButton className="btn btn--danger">Anonimizar</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="stack">
        <div className="row row--between">
          <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Trilha de auditoria (últimos 150 registros)</h2>
          <form className="row" method="get">
            <input name="acao" defaultValue={action} placeholder="Filtrar ação (ex.: plano, login)" aria-label="Filtrar por ação" />
            <button className="btn btn--sm" type="submit">
              Filtrar
            </button>
          </form>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Ação</th>
                <th>Registro</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="nowrap small">{fmtDateTime(l.createdAt, s.timezone)}</td>
                  <td className="small">{l.actorLabel}</td>
                  <td className="small">{l.action.replace(/_/g, ' ')}</td>
                  <td className="small">
                    {l.entity}
                    {l.patientId && (
                      <>
                        {' · '}
                        <Link href={`/admin/pacientes/${l.patientId}`}>paciente</Link>
                      </>
                    )}
                  </td>
                  <td className="small muted">{l.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

