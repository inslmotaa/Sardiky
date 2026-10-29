import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { createMaterial, toggleMaterial } from '@/actions/admin/content'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { Empty, NoAccess, PageHead } from '@/components/ui'
import { MATERIAL_KINDS } from '@/lib/constants'
import { isRestricted } from '@/lib/team-access'



export default async function MaterialsPage() {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const s = await getSettings()
  const [list, patients] = await Promise.all([
    db.select().from(schema.materials).orderBy(desc(schema.materials.createdAt)),
    db
      .select({ id: schema.patients.id, name: schema.patients.fullName })
      .from(schema.patients)
      .where(and(eq(schema.patients.status, 'ativo'), isNull(schema.patients.anonymizedAt), isRestricted(user) ? eq(schema.patients.nutritionistId, user.id) : undefined))
      .orderBy(asc(schema.patients.fullName)),
  ])
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead title="Materiais educativos" subtitle="E-books, vídeos e guias liberados para todos os clientes ou para clientes escolhidos." />
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section>
          {list.length === 0 ? (
            <Empty>Nenhum material publicado.</Empty>
          ) : (
            <ul className="card list material-list">
              {list.map((m) => (
                <li key={m.id} style={m.active ? undefined : { opacity: 0.55 }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{m.title}</strong> <span className="badge badge--plain">{MATERIAL_KINDS[m.kind] ?? m.kind}</span>
                    {m.description && <div className="small">{m.description}</div>}
                    <div className="small muted">
                      {m.audience === 'todos' ? 'Todos os clientes' : `${m.patientIds.length} ${m.patientIds.length === 1 ? 'cliente' : 'clientes'}: ${patients.filter((p) => m.patientIds.includes(p.id)).map((p) => p.name).join(', ')}`} ·{' '}
                      {fmtDateTime(m.createdAt, s.timezone)}
                    </div>
                    {m.fileId && (
                      <a className="small" href={`/arquivos/${m.fileId}`} target="_blank" rel="noopener noreferrer">
                        Abrir arquivo
                      </a>
                    )}
                    {m.url && (
                      <a className="small" href={m.url} target="_blank" rel="noopener noreferrer">
                        Abrir link
                      </a>
                    )}
                  </div>
                  <form action={toggleMaterial.bind(null, m.id, !m.active)}>
                    <button type="submit" className="btn btn--sm">
                      {m.active ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Publicar material</h2>
          <ActionForm action={createMaterial} className="stack" resetOnSuccess>
            <Field label="Título" name="title" required>
              <input name="title" maxLength={160} />
            </Field>
            <Field label="Tipo" name="kind">
              <select name="kind" defaultValue="ebook">
                {Object.entries(MATERIAL_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descrição" name="description">
              <textarea name="description" rows={2} maxLength={1000} />
            </Field>
            <Field label="Arquivo (PDF ou imagem, até 5 MB)" name="file">
              <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
            </Field>
            <Field label="Ou link (vídeo, site)" name="url" hint="Ex.: vídeo não listado no YouTube.">
              <input name="url" type="url" placeholder="https://" />
            </Field>
            <fieldset>
              <legend>Para quem</legend>
              <label className="check">
                <input type="radio" name="audience" value="todos" defaultChecked /> Todos os clientes
              </label>
              <label className="check">
                <input type="radio" name="audience" value="pacientes" /> Apenas os clientes marcados abaixo
              </label>
              <div className="choice-grid" style={{ maxHeight: 180, overflowY: 'auto', marginTop: 6 }}>
                {patients.map((p) => (
                  <label key={p.id} className="check">
                    <input type="checkbox" name="patientIds" value={p.id} /> {p.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <SubmitButton>Publicar</SubmitButton>
            </div>
          </ActionForm>
        </section>
      </div>
    </div>
  )
}
