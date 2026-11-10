import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { canSeePatient } from '@/lib/team-access'
import { can } from '@/lib/auth/permissions'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { ageFrom, fmtDay, todayIn } from '@/lib/time'
import { CONTRACT_STATUS, contractInfo } from '@/lib/contract'
import { uuid } from '@/lib/validation'
import { NoAccess, PageHead, StatusBadge, Tabs } from '@/components/ui'
import { SummaryTab } from './_tabs/summary'
import { AppointmentsTab } from './_tabs/appointments'
import { EvolutionTab } from './_tabs/evolution'
import { PlansTab } from './_tabs/plans'
import { DiaryTab } from './_tabs/diary'
import { CheckinsTab } from './_tabs/checkins'
import { FormsTab } from './_tabs/forms'
import { AnamnesisTab } from './_tabs/anamnesis'
import { GoalsTab } from './_tabs/goals'
import { PrescriptionsTab } from './_tabs/prescriptions'
import { NotesTab } from './_tabs/notes'
import { DocumentsTab } from './_tabs/documents'
import { MessagesTab } from './_tabs/messages'
import { FinanceTab } from './_tabs/finance'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { BodyCard } from '@/components/BodyCard'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { bodyProfile } from '@/lib/corpo-server'
import { updatePatientHeight } from '@/actions/admin/corpo'

const TABS = [
  { key: 'resumo', label: 'Resumo', perm: 'cadastro' },
  { key: 'consultas', label: 'Consultas', perm: 'cadastro' },
  { key: 'evolucao', label: 'Avaliações e evolução', perm: 'clinico' },
  { key: 'planos', label: 'Planos alimentares', perm: 'clinico' },
  { key: 'diario', label: 'Diário', perm: 'clinico' },
  { key: 'checkins', label: 'Check-ins', perm: 'clinico' },
  { key: 'anamnese', label: 'Anamnese', perm: 'clinico' },
  { key: 'formularios', label: 'Formulários', perm: 'clinico' },
  { key: 'metas', label: 'Metas', perm: 'clinico' },
  { key: 'prescricoes', label: 'Prescrições', perm: 'clinico' },
  { key: 'notas', label: 'Notas clínicas', perm: 'clinico' },
  { key: 'documentos', label: 'Documentos e exames', perm: 'clinico' },
  { key: 'mensagens', label: 'Mensagens', perm: 'clinico' },
  { key: 'financeiro', label: 'Financeiro', perm: 'financeiro' },
] as const

export default async function PatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params
  const sp = await searchParams
  const user = await requireTeam()
  if (!can(user, 'cadastro') && !can(user, 'clinico')) return <NoAccess />
  if (!uuid.safeParse(id).success) notFound()
  const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, id))
  if (!p || p.anonymizedAt || !canSeePatient(user, p)) notFound()
  const s = await getSettings()

  const visible = TABS.filter((t) => (t.perm === 'cadastro' ? can(user, 'cadastro') || can(user, 'clinico') : t.perm === 'financeiro' ? s.financeEnabled && can(user, 'financeiro') : can(user, t.perm)))
  const tab = visible.find((t) => t.key === sp.aba) ?? visible[0]
  if (tab.perm === 'clinico') {
    // Acesso a dados de saúde fica registrado na trilha de auditoria.
    await audit(user, 'prontuario_visualizado', 'paciente', { entityId: p.id, patientId: p.id, details: { aba: tab.key } })
  }
  const age = ageFrom(p.birthDate, todayIn(s.timezone))
  const [pkg] = p.packageId ? await db.select().from(schema.packages).where(eq(schema.packages.id, p.packageId)) : []
  const contract = pkg ? contractInfo(pkg, p.packageStart, p.packageEnd, todayIn(s.timezone)) : null
  // Perfil físico no topo da ficha (dados de saúde: só para quem tem acesso clínico).
  const body = can(user, 'clinico') ? await bodyProfile(p.id, todayIn(s.timezone)) : null

  return (
    <div>
      <PageHead
        crumbs={[{ href: '/admin/pacientes', label: 'Clientes' }]}
        title={p.fullName}
        subtitle={
          <>
            <StatusBadge status={p.status} /> · {p.stage}
            {age != null && ` · ${age} anos`}
            {p.objective && ` · ${p.objective}`}
            {contract && (
              <span className="patient-contract" data-status={contract.status}>
                {' · '}Plano {contract.name}
                {contract.end ? ` até ${fmtDay(contract.end)}` : ''} ({CONTRACT_STATUS[contract.status].toLowerCase()})
              </span>
            )}
          </>
        }
        actions={
          <>
            <WhatsAppButton phone={p.phone} template="waContato" vars={{ nome: p.fullName.split(' ')[0] }} />
            {can(user, 'agenda') && (
              <Link href={`/admin/agenda/nova?paciente=${p.id}`} className="btn btn--sm">
                Agendar
              </Link>
            )}
            {can(user, 'clinico') && (
              <Link href={`/admin/pacientes/${p.id}?aba=planos`} className="btn btn--sm btn--primary">
                Plano alimentar
              </Link>
            )}
          </>
        }
      />
      {body && (
        <BodyCard
          data={body}
          who="coach"
          id="corpo-ficha"
          actions={
            <>
              <Link href={`/admin/pacientes/${p.id}?aba=evolucao`} className="btn btn--sm">
                Evolução e fotos
              </Link>
              <a href={`/admin/pacientes/${p.id}/evolucao/pdf`} className="btn btn--sm">
                Relatório de evolução (PDF)
              </a>
              <details className="disclosure">
                <summary>Atualizar altura</summary>
                <ActionForm action={updatePatientHeight.bind(null, p.id)} className="row" resetOnSuccess>
                  <Field label="Altura (cm)" name="heightCm">
                    <input name="heightCm" inputMode="decimal" placeholder={body.heightCm ? String(body.heightCm) : 'Ex.: 170'} style={{ maxWidth: 140 }} />
                  </Field>
                  <Field label="Medida em" name="date">
                    <input type="date" name="date" defaultValue={todayIn(s.timezone)} max={todayIn(s.timezone)} />
                  </Field>
                  <div style={{ alignSelf: 'flex-end' }}>
                    <SubmitButton className="btn btn--sm">Salvar altura</SubmitButton>
                  </div>
                </ActionForm>
              </details>
            </>
          }
        />
      )}
      <Tabs current={tab.key} items={visible.map((t) => ({ key: t.key, label: t.label, href: `/admin/pacientes/${p.id}?aba=${t.key}` }))} />
      {tab.key === 'resumo' && <SummaryTab patient={p} user={user} />}
      {tab.key === 'consultas' && <AppointmentsTab patient={p} />}
      {tab.key === 'evolucao' && <EvolutionTab patient={p} compare={{ a: sp.a, b: sp.b }} />}
      {tab.key === 'planos' && <PlansTab patient={p} />}
      {tab.key === 'diario' && <DiaryTab patient={p} view={sp.vista} />}
      {tab.key === 'checkins' && <CheckinsTab patient={p} />}
      {tab.key === 'anamnese' && <AnamnesisTab patient={p} version={sp.versao} />}
      {tab.key === 'formularios' && <FormsTab patient={p} view={sp.ver} />}
      {tab.key === 'metas' && <GoalsTab patient={p} />}
      {tab.key === 'prescricoes' && <PrescriptionsTab patient={p} />}
      {tab.key === 'notas' && <NotesTab patient={p} />}
      {tab.key === 'documentos' && <DocumentsTab patient={p} />}
      {tab.key === 'mensagens' && <MessagesTab patient={p} />}
      {tab.key === 'financeiro' && <FinanceTab patient={p} />}
    </div>
  )
}
