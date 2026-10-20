import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { fmtDay } from '@/lib/time'
import { uuid } from '@/lib/validation'
import { submitForm } from '@/actions/patient'
import { FormFill } from '@/components/FormFill'
import { FormAnswersView } from '@/components/FormAnswers'
import { PageHead } from '@/components/ui'

export default async function FillFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) notFound()
  const [a] = await db
    .select()
    .from(schema.formAssignments)
    .where(and(eq(schema.formAssignments.id, id), eq(schema.formAssignments.patientId, user.patientId)))
  if (!a) notFound()
  const consented =
    a.kind !== 'anamnese' ||
    (await db.select({ id: schema.consents.id }).from(schema.consents).where(and(eq(schema.consents.patientId, user.patientId), eq(schema.consents.kind, 'anamnese_dados_saude')))).length > 0
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <PageHead
        title={a.title}
        crumbs={[{ href: '/paciente/formularios', label: 'Formulários' }]}
        subtitle={a.answeredAt ? 'Respostas enviadas.' : a.dueDate ? `Prazo: ${fmtDay(a.dueDate)}` : undefined}
      />
      <div className="card">{a.answeredAt ? <FormAnswersView assignment={a} /> : <FormFill
            fields={a.fields}
            action={submitForm.bind(null, a.id)}
            consentText={
              consented
                ? undefined
                : 'Autorizo o uso dos meus dados de saúde informados nesta anamnese exclusivamente para o meu acompanhamento nutricional, conforme a Política de Privacidade. Posso revogar esta autorização a qualquer momento.'
            }
          />}</div>
    </div>
  )
}
