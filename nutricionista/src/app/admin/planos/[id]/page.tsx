import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { audit } from '@/lib/audit'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { uuid } from '@/lib/validation'
import { deletePlanDraft, newPlanVersion, savePlan, savePlanAsTemplate, setPlanHistoryVisibility } from '@/actions/admin/plans'
import { PlanEditor } from '@/components/PlanEditor'
import { PatientPlan } from '@/components/nutri/PatientPlan'
import { loadFoods } from '@/lib/foods'
import { normalizePlan } from '@/lib/plan'
import { measurementsOf, latest } from '@/lib/patient-data'
import { NewPlanForm } from '@/components/NewPlanForm'
import { ActionForm, Field, PrintButton, SubmitButton } from '@/components/form'
import { NoAccess, PageHead, StatusBadge } from '@/components/ui'

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  if (!uuid.safeParse(id).success) notFound()
  const s = await getSettings()
  const [plan] = await db.select().from(schema.mealPlans).where(eq(schema.mealPlans.id, id))
  if (!plan) notFound()
  const [patient] = plan.patientId ? await db.select().from(schema.patients).where(eq(schema.patients.id, plan.patientId)) : []
  const versions = plan.patientId
    ? await db.select().from(schema.mealPlans).where(eq(schema.mealPlans.patientId, plan.patientId)).orderBy(desc(schema.mealPlans.version))
    : []
  const [publisher] = plan.publishedBy ? await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, plan.publishedBy)) : []
  const history = await db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.entityId, plan.id), ne(schema.auditLogs.action, 'plano_visualizado')))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(20)
  const patients = await db
    .select({ id: schema.patients.id, name: schema.patients.fullName })
    .from(schema.patients)
    .where(isNull(schema.patients.anonymizedAt))
    .orderBy(asc(schema.patients.fullName))
  if (patient) await audit(user, 'plano_visualizado', 'plano', { entityId: plan.id, patientId: patient.id })
  const content = normalizePlan(plan.content)
  const foods = plan.status === 'rascunho' ? await loadFoods() : []
  const weight = patient ? latest(await measurementsOf(patient.id), 'weightKg') : null

  const crumbs = patient
    ? [
        { href: '/admin/pacientes', label: 'Pacientes' },
        { href: `/admin/pacientes/${patient.id}?aba=planos`, label: patient.fullName },
      ]
    : [{ href: '/admin/planos', label: 'Planos e modelos' }]

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <div className="print-only">
        <strong>
          {s.professionalName} · {s.professionalTitle}
        </strong>
        {s.registry && <div>{s.registry}</div>}
        {patient && <div>Paciente: {patient.fullName}</div>}
        <div>
          Versão {plan.version}
          {plan.publishedAt && ` · publicada em ${fmtDay(plan.publishedAt.toISOString().slice(0, 10))}`}
          {plan.validUntil && ` · válida até ${fmtDay(plan.validUntil)}`}
        </div>
        <hr />
      </div>
      <PageHead
        crumbs={crumbs}
        title={plan.isTemplate ? `Modelo: ${plan.title}` : plan.title}
        subtitle={
          <>
            <StatusBadge status={plan.status} /> · versão {plan.version}
            {plan.publishedAt && ` · publicado em ${fmtDateTime(plan.publishedAt, s.timezone)}${publisher ? ` por ${publisher.name}` : ''}`}
          </>
        }
        actions={
          <>
            <a className="btn" href={`/admin/planos/${plan.id}/pdf`} download>
              Baixar PDF
            </a>
            {plan.status !== 'rascunho' && <PrintButton label="Imprimir" />}
            {plan.status !== 'rascunho' && plan.patientId && (
              <form action={newPlanVersion.bind(null, plan.id)}>
                <button type="submit" className="btn btn--primary">
                  Criar nova versão
                </button>
              </form>
            )}
          </>
        }
      />

      {plan.status === 'rascunho' ? (
        <>
          <p className="alert alert--warn no-print">
            {plan.isTemplate
              ? 'Modelo reutilizável: não é visto por pacientes.'
              : 'Rascunho — o paciente não vê esta versão até você revisar e publicar.'}
          </p>
          <PlanEditor
            action={savePlan.bind(null, plan.id)}
            initial={content}
            foods={foods}
            patient={patient ? { name: patient.fullName, weightKg: weight?.value ?? null, energyTarget: patient.energy?.targetKcal ?? null } : undefined}
            title={plan.title}
            validFrom={plan.validFrom}
            validUntil={plan.validUntil}
            isTemplate={plan.isTemplate}
          />
        </>
      ) : (
        <>
          {plan.status === 'arquivado' && (
            <div className="alert alert--info row row--between no-print">
              <span>Versão anterior. {plan.visibleInHistory ? 'O paciente pode consultá-la no histórico.' : 'Oculta para o paciente.'}</span>
              <form action={setPlanHistoryVisibility.bind(null, plan.id, !plan.visibleInHistory)}>
                <button className="btn btn--sm" type="submit">
                  {plan.visibleInHistory ? 'Ocultar do paciente' : 'Liberar para o paciente'}
                </button>
              </form>
            </div>
          )}
          <PatientPlan content={content} />
        </>
      )}

      <div className="grid-2 no-print" style={{ alignItems: 'start' }}>
        {versions.length > 0 && (
          <section className="card">
            <h2 style={{ fontSize: '1.05rem' }}>Versões deste paciente</h2>
            <ul className="list">
              {versions.map((v) => (
                <li key={v.id} className="row row--between">
                  {v.id === plan.id ? <strong>v{v.version} (aberta)</strong> : <Link href={`/admin/planos/${v.id}`}>v{v.version}</Link>}
                  <StatusBadge status={v.status} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {!plan.isTemplate && (
          <section className="card">
            <h2 style={{ fontSize: '1.05rem' }}>Salvar como modelo</h2>
            <p className="muted small">Guarda uma cópia sem os dados do paciente, para reutilizar com outros pacientes.</p>
            <ActionForm action={savePlanAsTemplate.bind(null, plan.id)} className="stack">
              <Field label="Nome do modelo" name="templateTitle">
                <input name="templateTitle" maxLength={160} defaultValue={`Modelo — ${plan.title}`} />
              </Field>
              <div>
                <SubmitButton className="btn">Salvar como modelo</SubmitButton>
              </div>
            </ActionForm>
          </section>
        )}
        <section className="card">
          <h2 style={{ fontSize: '1.05rem' }}>Duplicar</h2>
          <p className="muted small">Cria um novo rascunho com este conteúdo, para outro paciente ou como modelo.</p>
          <NewPlanForm patients={patients} sources={[{ id: plan.id, label: 'Este plano' }]} defaultTitle={plan.title} />
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.05rem' }}>Histórico de alterações</h2>
          {history.length === 0 ? (
            <p className="muted small">Sem registros.</p>
          ) : (
            <ul className="list small">
              {history.map((h) => (
                <li key={h.id}>
                  {fmtDateTime(h.createdAt, s.timezone)} · {h.action.replace(/_/g, ' ')} · {h.actorLabel}
                </li>
              ))}
            </ul>
          )}
          {plan.status === 'rascunho' && (
            <form action={deletePlanDraft.bind(null, plan.id)} style={{ marginTop: 12 }}>
              <button className="btn btn--danger btn--sm" type="submit">
                Excluir rascunho
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}
