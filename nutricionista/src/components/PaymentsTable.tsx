import type { schema } from '@/db'
import { fmtDay, todayIn } from '@/lib/time'
import { money } from '@/lib/format'
import { linkNoPainelMP } from '@/lib/mercadopago-core'
import { markPaymentPaid, setPaymentStatus } from '@/actions/admin/finance'
import { ActionForm, SubmitButton } from './form'
import { StatusBadge, Empty } from './ui'
import { WhatsAppButton } from './WhatsAppButton'

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
                {p.status === 'pago' && (
                  <div>
                    <a className="small" href={`/recibos/${p.id}`} download>
                      Recibo (PDF){p.receiptNumber ? ` nº ${String(p.receiptNumber).padStart(5, '0')}` : ''}
                    </a>
                  </div>
                )}
                {p.status === 'pendente' && phone && (
                  <div>
                    <WhatsAppButton
                      phone={phone}
                      template="waCobranca"
                      label="Cobrar pelo WhatsApp"
                      className="small"
                      vars={{ nome: (name ?? '').split(' ')[0], descricao: p.description, valor: money(p.amountCents - p.discountCents), data: p.dueDate ? fmtDay(p.dueDate) : 'combinado' }}
                    />
                  </div>
                )}
              </td>
              <td>
                {p.source === 'provedor' ? (
                  <>
                    <span className={`badge ${p.status === 'pago' ? 'badge--ok' : 'badge--plain'}`} title={p.providerRef ?? ''}>
                      {p.status === 'pago' ? `Confirmado por ${p.provider}` : p.provider === 'mercadopago' ? 'Mercado Pago' : p.provider}
                    </span>
                    {p.provider === 'mercadopago' && p.providerRef && /^\d+$/.test(p.providerRef) && (
                      <div>
                        <a className="small" href={linkNoPainelMP(p.providerRef)} target="_blank" rel="noopener noreferrer">
                          Ver no Mercado Pago (nº {p.providerRef})
                        </a>
                      </div>
                    )}
                  </>
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
