
import { requirePatient } from '@/lib/auth/session'
import { materialsForPatient } from '@/lib/patient-content'
import { MATERIAL_KINDS } from '@/lib/constants'
import { Empty, PageHead } from '@/components/ui'

export default async function PatientMaterials() {
  const user = await requirePatient()
  const list = (await materialsForPatient(user.patientId)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 760 }}>
      <PageHead crumbs={[{ href: '/paciente/mais', label: 'Mais' }]} title="Materiais" subtitle="E-books, vídeos e guias do seu nutricionista." />
      {list.length === 0 ? (
        <Empty>Ainda não há materiais liberados para você.</Empty>
      ) : (
        <ul className="card list material-list">
          {list.map((m) => (
            <li key={m.id}>
              <div style={{ minWidth: 0 }}>
                <strong>{m.title}</strong> <span className="badge badge--plain">{MATERIAL_KINDS[m.kind] ?? m.kind}</span>
                {m.description && <div className="small">{m.description}</div>}
              </div>
              <a className="btn btn--sm btn--primary" href={m.fileId ? `/arquivos/${m.fileId}` : m.url!} target="_blank" rel="noopener noreferrer">
                {m.kind === 'video' ? 'Assistir' : 'Abrir'}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
