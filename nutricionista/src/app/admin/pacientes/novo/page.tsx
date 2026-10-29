import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { createPatient } from '@/actions/admin/patients'
import { ActionForm, SubmitButton } from '@/components/form'
import { NoAccess, PageHead } from '@/components/ui'
import { PatientFormFields } from '@/components/PatientFormFields'
import { nutritionistOptions } from '@/lib/team-access'

export default async function NewPatientPage() {
  const user = await requireTeam()
  if (!can(user, 'cadastro')) return <NoAccess />
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead title="Novo cliente" crumbs={[{ href: '/admin/pacientes', label: 'Clientes' }]} subtitle="Depois de salvar, você pode liberar o acesso à área do cliente." />
      <div className="card">
        <ActionForm action={createPatient} className="stack">
          <PatientFormFields nutritionists={await nutritionistOptions()} />
          <div>
            <SubmitButton>Cadastrar cliente</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  )
}
