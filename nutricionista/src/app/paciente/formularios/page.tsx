import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { PageHead, Empty } from '@/components/ui'

export default async function PatientForms() {
  const user = await requirePatient()
  const s = await getSettings()
  const list = await db
    .select()
    .from(schema.formAssignments)
    .where(eq(schema.formAssignments.patientId, user.patientId))
    .orderBy(desc(schema.formAssignments.createdAt))
  const pending = list.filter((a) => !a.answeredAt)
  const done = list.filter((a) => a.answeredAt)
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Formulários e avaliações" subtitle="Questionários enviados pelo nutricionista. Pedimos somente o necessário para o seu atendimento." />
      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Para preencher</h2>
        {pending.length === 0 ? (
          <Empty>Nenhum formulário pendente.</Empty>
        ) : (
          <div className="grid-2">
            {pending.map((a) => (
              <div key={a.id} className="card row row--between">
                <div>
                  <strong>{a.title}</strong>
                  <div className="muted small">{a.dueDate ? `Prazo: ${fmtDay(a.dueDate)}` : 'Sem prazo definido'}</div>
                </div>
                <Link href={`/paciente/formularios/${a.id}`} className="btn btn--primary btn--sm">
                  Preencher
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Enviados</h2>
        {done.length === 0 ? (
          <Empty>Nenhum formulário enviado ainda.</Empty>
        ) : (
          <ul className="card list">
            {done.map((a) => (
              <li key={a.id} className="row row--between">
                <span>
                  {a.title} <span className="muted small">· enviado em {fmtDateTime(a.answeredAt!, s.timezone)}</span>
                </span>
                <Link href={`/paciente/formularios/${a.id}`} className="small">
                  Ver respostas
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
