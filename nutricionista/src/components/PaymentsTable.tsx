import type { schema } from '@/db'
import { fmtDay } from '@/lib/time'
import { money } from '@/lib/format'
import { markPaymentPaid, setPaymentStatus } from '@/actions/admin/finance'
import { ActionForm, SubmitButton } from './form'
import { StatusBadge, Empty } from './ui'

type Row = { pay: typeof schema.payments.$inferSelect; name: string | null }

export function PaymentsTable({ rows, showPatient = true }: { rows: Row[]; showPatient?: boolean }) {
  if (rows.length === 0) return <Empty>Nenhum lançamento.</Empty>
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Descrição</th>
            {showPatient && <th>Paciente</th>}
            <th className="num">Valor</th>
            <th>Situação</th>
            <th>Origem</th>
            <th>Datas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pay: p, name }) => (
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
                <StatusBadge status={p.status} />
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
