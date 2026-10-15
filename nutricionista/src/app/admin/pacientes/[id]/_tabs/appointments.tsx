import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { money } from '@/lib/format'
import { StatusBadge, Empty } from '@/components/ui'

export async function AppointmentsTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const s = await getSettings()
  const list = await db.select().from(schema.appointments).where(eq(schema.appointments.patientId, patient.id)).orderBy(desc(schema.appointments.startAt))
  const count = (st: string) => list.filter((a) => a.status === st).length
  return (
    <div className="stack">
      <div className="row small">
        <span className="badge badge--brand">{count('realizada')} realizadas</span>
        <span className="badge badge--plain">{count('cancelada')} canceladas</span>
        <span className="badge badge--danger">{count('faltou')} faltas</span>
      </div>
      {list.length === 0 ? (
        <Empty
          action={
            <Link href={`/admin/agenda/nova?paciente=${patient.id}`} className="btn btn--primary btn--sm">
              Agendar
            </Link>
          }
        >
          Nenhuma consulta registrada.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Serviço</th>
                <th>Modalidade</th>
                <th className="num">Valor</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{fmtDateTime(a.startAt, s.timezone)}</td>
                  <td>{a.serviceName}</td>
                  <td>{a.modality === 'online' ? 'On-line' : 'Presencial'}</td>
                  <td className="num">{money(a.priceCents)}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>
                    <Link href={`/admin/agenda/${a.id}`}>Abrir</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
