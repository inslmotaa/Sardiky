import Link from 'next/link'
import { asc, count } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { FORM_KINDS } from '@/lib/forms'
import { toggleFormTemplate } from '@/actions/admin/forms'
import { NoAccess, PageHead } from '@/components/ui'

export default async function FormsPage() {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const [templates, usage] = await Promise.all([
    db.select().from(schema.formTemplates).orderBy(asc(schema.formTemplates.title)),
    db.select({ id: schema.formAssignments.templateId, n: count() }).from(schema.formAssignments).groupBy(schema.formAssignments.templateId),
  ])
  return (
    <div className="stack">
      <PageHead
        title="Formulários"
        subtitle="Modelos de anamnese, questionários e termos. Envie a um cliente pela aba “Formulários” da ficha. A anamnese principal é preenchida pelo cliente no próprio site (aba “Anamnese”)."
        actions={
          <Link href="/admin/formularios/novo" className="btn btn--primary">
            Novo modelo
          </Link>
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Modelo</th>
              <th>Tipo</th>
              <th className="num">Perguntas</th>
              <th className="num">Envios</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/admin/formularios/${t.id}`}>{t.title}</Link>
                </td>
                <td>{FORM_KINDS[t.kind] ?? t.kind}</td>
                <td className="num">{t.fields.length}</td>
                <td className="num">{usage.find((u) => u.id === t.id)?.n ?? 0}</td>
                <td>{t.active ? <span className="badge badge--ok">Ativo</span> : <span className="badge badge--plain">Inativo</span>}</td>
                <td>
                  <form action={toggleFormTemplate.bind(null, t.id)}>
                    <button className="link-btn small" type="submit">
                      {t.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

