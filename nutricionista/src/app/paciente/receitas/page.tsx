import Link from 'next/link'
import { requirePatient } from '@/lib/auth/session'
import { featuresOf } from '@/lib/patient-context'
import { recipesForPatient } from '@/lib/patient-content'
import { recipeInfo } from '@/lib/recipes'
import { fmt } from '@/lib/nutricao'
import { Empty, PageHead } from '@/components/ui'

export default async function PatientRecipes() {
  const user = await requirePatient()
  const [list, f] = await Promise.all([recipesForPatient(user.patientId), featuresOf(user.patientId)])
  list.sort((a, b) => Number(b.inPlan) - Number(a.inPlan) || a.title.localeCompare(b.title))
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead crumbs={[{ href: '/paciente/mais', label: 'Mais' }]} title="Receitas" subtitle="Receitas do seu plano e sugestões do seu nutricionista." />
      {list.length === 0 ? (
        <Empty>Ainda não há receitas liberadas para você.</Empty>
      ) : (
        <div className="recipe-grid">
          {list.map((r) => {
            const info = recipeInfo(r)
            return (
              <Link key={r.id} href={`/paciente/receitas/${r.id}`} className="card recipe-card">
                {r.photoFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/arquivos/${r.photoFileId}`} alt="" />
                ) : (
                  <div className="recipe-card__ph" aria-hidden>
                    🍽️
                  </div>
                )}
                <strong>{r.title}</strong>
                <span className="small muted">
                  {r.portions} {r.portions === 1 ? 'porção' : 'porções'}
                  {f.calorias && ` · ${fmt(info.perPortion.kcal, 0)} kcal/porção`}
                  {r.prepMinutes ? ` · ${r.prepMinutes} min` : ''}
                </span>
                {r.inPlan && <span className="badge badge--ok">No seu plano</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
