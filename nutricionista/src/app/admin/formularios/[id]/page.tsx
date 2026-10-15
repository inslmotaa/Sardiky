import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { uuid } from '@/lib/validation'
import { saveFormTemplate } from '@/actions/admin/forms'
import { FormBuilder } from '@/components/FormBuilder'
import { NoAccess, PageHead } from '@/components/ui'

export default async function FormTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  if (id === 'novo') {
    return (
      <div style={{ maxWidth: 900 }}>
        <PageHead title="Novo modelo de formulário" crumbs={[{ href: '/admin/formularios', label: 'Formulários' }]} />
        <FormBuilder
          action={saveFormTemplate.bind(null, null)}
          initial={{ title: '', description: '', kind: 'questionario', fields: [{ id: 'pergunta_1', label: '', type: 'text', required: false, options: [], help: '' }] }}
        />
      </div>
    )
  }
  if (!uuid.safeParse(id).success) notFound()
  const [t] = await db.select().from(schema.formTemplates).where(eq(schema.formTemplates.id, id))
  if (!t) notFound()
  return (
    <div style={{ maxWidth: 900 }}>
      <PageHead
        title={t.title}
        crumbs={[{ href: '/admin/formularios', label: 'Formulários' }]}
        subtitle="Alterações valem para os próximos envios; respostas anteriores mantêm as perguntas originais."
      />
      <FormBuilder action={saveFormTemplate.bind(null, t.id)} initial={{ title: t.title, description: t.description, kind: t.kind, fields: t.fields }} />
    </div>
  )
}
