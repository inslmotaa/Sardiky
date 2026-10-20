import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { ageFrom, todayIn } from '@/lib/time'
import { whatsappLink } from '@/lib/format'
import { uuid } from '@/lib/validation'
import { NoAccess, PageHead, StatusBadge, Tabs } from '@/components/ui'
import { SummaryTab } from './_tabs/summary'
import { AppointmentsTab } from './_tabs/appointments'
import { EvolutionTab } from './_tabs/evolution'
import { PlansTab } from './_tabs/plans'
import { DiaryTab } from './_tabs/diary'
import { FormsTab } from './_tabs/forms'
import { GoalsTab } from './_tabs/goals'
import { NotesTab } from './_tabs/notes'
import { DocumentsTab } from './_tabs/documents'
import { MessagesTab } from './_tabs/messages'
import { FinanceTab } from './_tabs/finance'

const TABS = [
  { key: 'resumo', label: 'Resumo', perm: 'cadastro' },
  { key: 'consultas', label: 'Consultas', perm: 'cadastro' },
  { key: 'evolucao', label: 'Avaliações e evolução', perm: 'clinico' },
  { key: 'planos', label: 'Planos alimentares', perm: 'clinico' },
  { key: 'diario', label: 'Diário', perm: 'clinico' },
  { key: 'formularios', label: 'Anamnese e formulários', perm: 'clinico' },
  { key: 'metas', label: 'Metas', perm: 'clinico' },
  { key: 'notas', label: 'Notas clínicas', perm: 'clinico' },
  { key: 'documentos', label: 'Documentos', perm: 'clinico' },
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
  if (!p || p.anonymizedAt) notFound()
  const s = await getSettings()

  const visible = TABS.filter((t) => (t.perm === 'cadastro' ? can(user, 'cadastro') || can(user, 'clinico') : t.perm === 'financeiro' ? s.financeEnabled && can(user, 'financeiro') : can(user, t.perm)))
  const tab = visible.find((t) => t.key === sp.aba) ?? visible[0]
  if (tab.perm === 'clinico') {
    // Acesso a dados de saúde fica registrado na trilha de auditoria.
    await audit(user, 'prontuario_visualizado', 'paciente', { entityId: p.id, patientId: p.id, details: { aba: tab.key } })
  }
  const age = ageFrom(p.birthDate, todayIn(s.timezone))
  const wa = p.phone ? whatsappLink(p.phone.length <= 11 ? `55${p.phone}` : p.phone) : null

  return (
    <div>
      <PageHead
        crumbs={[{ href: '/admin/pacientes', label: 'Pacientes' }]}
        title={p.fullName}
        subtitle={
          <>
            <StatusBadge status={p.status} /> · {p.stage}
            {age != null && ` · ${age} anos`}
            {p.objective && ` · ${p.objective}`}
          </>
        }
        actions={
          <>
            {wa && (
              <a href={wa} className="btn btn--sm" target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            )}
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
      <Tabs current={tab.key} items={visible.map((t) => ({ key: t.key, label: t.label, href: `/admin/pacientes/${p.id}?aba=${t.key}` }))} />
      {tab.key === 'resumo' && <SummaryTab patient={p} user={user} />}
      {tab.key === 'consultas' && <AppointmentsTab patient={p} />}
      {tab.key === 'evolucao' && <EvolutionTab patient={p} compare={{ a: sp.a, b: sp.b }} viewerId={user.id} />}
      {tab.key === 'planos' && <PlansTab patient={p} />}
      {tab.key === 'diario' && <DiaryTab patient={p} />}
      {tab.key === 'formularios' && <FormsTab patient={p} view={sp.ver} />}
      {tab.key === 'metas' && <GoalsTab patient={p} />}
      {tab.key === 'notas' && <NotesTab patient={p} />}
      {tab.key === 'documentos' && <DocumentsTab patient={p} />}
      {tab.key === 'mensagens' && <MessagesTab patient={p} />}
      {tab.key === 'financeiro' && <FinanceTab patient={p} />}
    </div>
  )
}
