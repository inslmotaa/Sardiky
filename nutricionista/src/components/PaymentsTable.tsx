import type { schema } from '@/db'
import { fmtDay, todayIn } from '@/lib/time'
import { money, whatsappLink } from '@/lib/format'
import { markPaymentPaid, setPaymentStatus } from '@/actions/admin/finance'
import { ActionForm, SubmitButton } from './form'
import { StatusBadge, Empty } from './ui'

type Row = { pay: typeof schema.payments.$inferSelect; name: string | null; phone?: string | null }

export function PaymentsTable({ rows, showPatient = true, today = todayIn() }: { rows: Row[]; showPatient?: boolean; today?: string }) {
  if (rows.length === 0) return <Empty>Nenhum lançamento.</Empty>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            {showPatient && <th>Cliente</th>}
            <th className="num">Valor</th>
            <th>Situação</th>
            <th>Origem</th>
            <th>Datas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pay: p, name, phone }) => {
            const overdue = p.status === 'pendente' && !!p.dueDate && p.dueDate < today
            const wa =
              p.status === 'pendente' && phone
                ? whatsappLink(
                    phone.length <= 11 ? `55${phone}` : phone,
                    `Olá, ${(name ?? '').split(' ')[0]}! Passando para lembrar do pagamento de “${p.description}” (${money(p.amountCents - p.discountCents)})${p.dueDate ? `, com vencimento em ${fmtDay(p.dueDate)}` : ''}. Qualquer dúvida, estou à disposição.`,
                  )
                : null
            return (
            <tr key={p.id}>
              <td>
                {p.description}
                {p.discountCents > 0 && (
                  <div className="small muted">
                    Desconto {money(p.discountCents)} · {p.discountReason}
                  </div>
                )}
              </td>
              {showPatient && <td>{name ?? '—'}</td>}
              <td className="num nowrap">
                {money(p.amountCents - p.discountCents)}
                {p.discountCents > 0 && <div className="small muted" style={{ textDecoration: 'line-through' }}>{money(p.amountCents)}</div>}
              </td>
              <td>
                {overdue ? <span className="badge badge--danger">Atrasado</span> : <StatusBadge status={p.status} />}
                {wa && (
                  <div>
                    <a className="small" href={wa} target="_blank" rel="noopener noreferrer">
                      Cobrar pelo WhatsApp
                    </a>
                  </div>
                )}
              </td>
              <td>
                {p.source === 'provedor' ? (
                  <span className="badge badge--ok" title={p.providerRef ?? ''}>
                    Confirmado por {p.provider}
                  </span>
                ) : (
                  <span className="badge badge--plain" title="Lançado manualmente pela equipe; não verificado por provedor de pagamento">
                    Registro interno
                  </span>
                )}
              </td>
              <td className="small nowrap">
                {p.paidAt ? `Pago em ${fmtDay(p.paidAt)}` : p.dueDate ? `Vence ${fmtDay(p.dueDate)}` : '—'}
                {p.method && <div className="muted">{p.method}</div>}
              </td>
              <td>
                {p.status === 'pendente' && (
                  <details>
                    <summary className="link-btn small">Registrar pagamento</summary>
                    <ActionForm action={markPaymentPaid} className="stack" >
                      <input type="hidden" name="id" value={p.id} />
                      <select name="method" defaultValue="pix" aria-label="Forma de pagamento">
                        <option value="pix">Pix</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao">Cartão</option>
                        <option value="transferencia">Transferência</option>
                      </select>
                      <input type="date" name="paidAt" aria-label="Data do pagamento" />
                      <SubmitButton className="btn btn--sm btn--primary">Confirmar</SubmitButton>
                    </ActionForm>
                    <form action={setPaymentStatus.bind(null, p.id, 'cancelado')} style={{ marginTop: 6 }}>
                      <button className="link-btn small" type="submit">
                        Cancelar lançamento
                      </button>
                    </form>
                  </details>
                )}
                {p.status === 'pago' && p.source === 'manual' && (
                  <form action={setPaymentStatus.bind(null, p.id, 'estornado')}>
                    <button className="link-btn small" type="submit">
                      Estornar
                    </button>
                  </form>
                )}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
