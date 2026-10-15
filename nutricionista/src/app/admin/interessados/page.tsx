import { desc } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { whatsappLink } from '@/lib/format'
import { deleteLead, setLeadStatus } from '@/actions/admin/settings'
import { NoAccess, PageHead, StatusBadge, Empty } from '@/components/ui'

export default async function LeadsPage() {
  const user = await requireTeam()
  if (!can(user, 'site')) return <NoAccess />
  const s = await getSettings()
  const leads = await db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt))
  return (
    <div className="stack">
      <PageHead title="Interessados" subtitle={`Contatos enviados pelo formulário do site. Não convertidos são eliminados automaticamente após ${s.leadRetentionDays} dias.`} />
      {leads.length === 0 ? (
        <Empty>Nenhum contato recebido.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Recebido</th>
                <th>Contato</th>
                <th>Interesse / mensagem</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const wa = whatsappLink(l.phone.length <= 11 ? `55${l.phone}` : l.phone, `Olá, ${l.name.split(' ')[0]}! Recebemos seu contato pelo site de ${s.professionalName}.`)
                return (
                  <tr key={l.id}>
                    <td className="nowrap small">{fmtDateTime(l.createdAt, s.timezone)}</td>
                    <td>
                      <strong>{l.name}</strong>
                      <div className="small">{l.phone}</div>
                      {l.email && <div className="small muted">{l.email}</div>}
                    </td>
                    <td className="small">
                      {l.interest && <strong>{l.interest}</strong>}
                      {l.message && <div>{l.message}</div>}
                    </td>
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                    <td>
                      <div className="row small" style={{ gap: 8 }}>
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer">
                            WhatsApp
                          </a>
                        )}
                        {(['contatado', 'convertido', 'descartado'] as const)
                          .filter((st) => st !== l.status)
                          .map((st) => (
                            <form key={st} action={setLeadStatus.bind(null, l.id, st)}>
                              <button className="link-btn" type="submit">
                                {st === 'contatado' ? 'Marcar contatado' : st === 'convertido' ? 'Convertido' : 'Descartar'}
                              </button>
                            </form>
                          ))}
                        <form action={deleteLead.bind(null, l.id)}>
                          <button className="link-btn" type="submit" style={{ color: 'var(--danger)' }}>
                            Excluir
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
