import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { money } from '@/lib/format'
import { PaymentForm } from '@/components/PaymentForm'
import { PaymentsTable } from '@/components/PaymentsTable'

export async function FinanceTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const [rows, packages] = await Promise.all([
    db.select().from(schema.payments).where(eq(schema.payments.patientId, patient.id)).orderBy(desc(schema.payments.createdAt)),
    db.select().from(schema.packages).where(eq(schema.packages.active, true)),
  ])
  const paid = rows.filter((r) => r.status === 'pago').reduce((n, r) => n + r.amountCents - r.discountCents, 0)
  const open = rows.filter((r) => r.status === 'pendente').reduce((n, r) => n + r.amountCents - r.discountCents, 0)
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <div className="row">
        <span className="badge badge--ok">Pago: {money(paid)}</span>
        <span className="badge badge--warn">Pendente: {money(open)}</span>
      </div>
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
