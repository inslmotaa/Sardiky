import { asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { money } from '@/lib/format'
import { mpConfigured } from '@/lib/mercadopago'
import { gerarLinkPagamento, liberarSemPagamentoOnline } from '@/actions/admin/finance'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PaymentForm } from '@/components/PaymentForm'
import { PaymentLinkTool } from '@/components/PaymentLinkTool'
import { PaymentsTable } from '@/components/PaymentsTable'
import { waText } from '@/lib/whatsapp'
import { getSettings } from '@/lib/settings'

export async function FinanceTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const [rows, packages] = await Promise.all([
    db.select().from(schema.payments).where(eq(schema.payments.patientId, patient.id)).orderBy(desc(schema.payments.createdAt)),
    db.select().from(schema.packages).where(eq(schema.packages.active, true)).orderBy(asc(schema.packages.sort)),
  ])
  const paid = rows.filter((r) => r.status === 'pago').reduce((n, r) => n + r.amountCents - r.discountCents, 0)
  const open = rows.filter((r) => r.status === 'pendente').reduce((n, r) => n + r.amountCents - r.discountCents, 0)
  const online = mpConfigured()
  const pkgOptions = packages.map((p) => ({ id: p.id, name: p.name, priceLabel: money(p.priceCents) }))
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <div className="row">
        <span className="badge badge--ok">Pago: {money(paid)}</span>
        <span className="badge badge--warn">Pendente: {money(open)}</span>
        {patient.paymentRequired && <span className="badge badge--warn">Aguardando o primeiro pagamento</span>}
      </div>
      {packages.length > 0 && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <section className="card stack" style={{ ['--gap' as string]: '10px' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Link de pagamento (Mercado Pago)</h2>
            {online ? (
              <PaymentLinkTool
                action={gerarLinkPagamento.bind(null, patient.id)}
                packages={pkgOptions}
                defaultPackageId={patient.packageId}
                firstName={patient.fullName.split(' ')[0]}
                phone={patient.phone}
                message={waText((await getSettings()).templates, 'waLinkPagamento', { nome: patient.fullName.split(' ')[0], link: '{link}' })}
              />
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                Mercado Pago não configurado (Configurações → Integrações). Enquanto isso, use “Liberar sem pagamento on-line”.
              </p>
            )}
          </section>
          <section className="card stack" style={{ ['--gap' as string]: '10px' }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Liberar sem pagamento on-line</h2>
            <p className="small muted" style={{ margin: 0 }}>Para quem pagou por fora (dinheiro, transferência). Cria o lançamento pago e libera o acesso.</p>
            <ActionForm action={liberarSemPagamentoOnline.bind(null, patient.id)} className="stack" confirm="Liberar o acesso sem pagamento on-line?">
              <div className="form-grid">
                <Field label="Plano" name="packageId">
                  <select name="packageId" defaultValue={patient.packageId ?? packages[0]?.id}>
                    {pkgOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.priceLabel}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Como pagou (opcional)" name="method">
                  <input name="method" maxLength={40} placeholder="Ex.: transferência" />
                </Field>
              </div>
              <div>
                <SubmitButton className="btn">Liberar acesso</SubmitButton>
              </div>
            </ActionForm>
          </section>
        </div>
      )}
      <PaymentsTable rows={rows.map((pay) => ({ pay, name: patient.fullName, phone: patient.phone }))} showPatient={false} />
      <details className="disclosure">
        <summary>Novo lançamento</summary>
        <div>
          <PaymentForm patientId={patient.id} packages={packages} />
        </div>
      </details>
    </div>
  )
}
