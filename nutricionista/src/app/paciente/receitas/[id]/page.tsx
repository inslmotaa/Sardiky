import { notFound } from 'next/navigation'
import { requirePatient } from '@/lib/auth/session'
import { featuresOf } from '@/lib/patient-context'
import { recipesForPatient } from '@/lib/patient-content'
import { recipeInfo } from '@/lib/recipes'
import { fmt, scale } from '@/lib/nutricao'
import { uuid } from '@/lib/validation'
import { NutriInline } from '@/components/nutri/MacroBars'
import { PageHead } from '@/components/ui'

export default async function PatientRecipe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) notFound()
  const [list, f] = await Promise.all([recipesForPatient(user.patientId), featuresOf(user.patientId)])
  // Só receitas liberadas ou do plano do próprio paciente.
  const r = list.find((x) => x.id === id)
  if (!r) notFound()
  const info = recipeInfo(r)
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 760 }}>
      <PageHead crumbs={[{ href: '/paciente/receitas', label: 'Receitas' }]} title={r.title} subtitle={`${r.portions} ${r.portions === 1 ? 'porção' : 'porções'} de ${fmt(info.portionGrams, 0)} g${r.prepMinutes ? ` · ${r.prepMinutes} minutos` : ''}`} />
      {r.photoFileId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/arquivos/${r.photoFileId}`} alt={`Foto de ${r.title}`} className="recipe-photo" />
      )}
      {r.tags.length > 0 && (
        <div className="row" style={{ gap: 6 }}>
          {r.tags.map((t) => (
            <span key={t} className="badge badge--plain">
              {t}
            </span>
          ))}
        </div>
      )}
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Ingredientes</h2>
        <ul className="list">
          {r.ingredients.map((i, k) => (
            <li key={k} className="row row--between">
              <span>{i.name}</span>
              <span className="muted">
                {fmt(i.grams, 0)} g{f.calorias && i.per100 ? ` · ${fmt(scale(i.per100, i.grams).kcal, 0)} kcal` : ''}
              </span>
            </li>
          ))}
        </ul>
        {(f.calorias || f.macros) && (
          <p className="small" style={{ marginBottom: 0 }}>
            Por porção: <NutriInline n={info.perPortion} showKcal={f.calorias} showMacros={f.macros} />
          </p>
        )}
      </section>
      {r.instructions && (
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Modo de preparo</h2>
          <p className="recipe-steps">{r.instructions}</p>
        </section>
      )}
    </div>
  )
}
