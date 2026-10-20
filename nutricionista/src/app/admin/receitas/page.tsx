import Link from 'next/link'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { loadRecipes, recipeInfo } from '@/lib/recipes'
import { fmt, normalize } from '@/lib/nutricao'
import { Empty, NoAccess, PageHead } from '@/components/ui'

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const sp = await searchParams
  const q = normalize(sp.q ?? '')
  const all = await loadRecipes()
  const tags = [...new Set(all.flatMap((r) => r.tags))].sort()
  const list = all.filter((r) => (!q || normalize(r.title).includes(q)) && (!sp.tag || r.tags.includes(sp.tag)))
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead
        title="Receitas"
        subtitle="Ingredientes da base de alimentos, com cálculo automático por porção. Adicione uma receita a uma refeição no editor de planos buscando por “Receita:”."
        actions={
          <Link href="/admin/receitas/nova" className="btn btn--primary">
            Nova receita
          </Link>
        }
      />
      <form className="card row" method="get" role="search">
        <label className="field" style={{ flex: '2 1 220px' }}>
          <span className="field__label">Buscar</span>
          <input type="search" name="q" defaultValue={sp.q ?? ''} />
        </label>
        <label className="field" style={{ flex: '1 1 160px' }}>
          <span className="field__label">Etiqueta</span>
          <select name="tag" defaultValue={sp.tag ?? ''}>
            <option value="">Todas</option>
            {tags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button className="btn" type="submit" style={{ alignSelf: 'flex-end' }}>
          Filtrar
        </button>
      </form>
      {list.length === 0 ? (
        <Empty>Nenhuma receita encontrada.</Empty>
      ) : (
        <div className="recipe-grid">
          {list.map((r) => {
            const info = recipeInfo(r)
            return (
              <Link key={r.id} href={`/admin/receitas/${r.id}`} className="card recipe-card">
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
                  {r.portions} {r.portions === 1 ? 'porção' : 'porções'} · {fmt(info.perPortion.kcal, 0)} kcal/porção{r.prepMinutes ? ` · ${r.prepMinutes} min` : ''}
                </span>
                {r.tags.length > 0 && (
                  <span className="row" style={{ gap: 4 }}>
                    {r.tags.map((t) => (
                      <span key={t} className="badge badge--plain">
                        {t}
                      </span>
                    ))}
                  </span>
                )}
                {!r.visibleToAll && <span className="small muted">Só para pacientes com a receita no plano</span>}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
