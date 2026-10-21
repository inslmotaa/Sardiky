import { notFound } from 'next/navigation'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { loadFoods } from '@/lib/foods'
import { recipeById } from '@/lib/recipes'
import { uuid } from '@/lib/validation'
import { deleteRecipe, saveRecipe } from '@/actions/admin/content'
import { RecipeEditor } from '@/components/nutri/RecipeEditor'
import { NoAccess, PageHead } from '@/components/ui'

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criada?: string }> }) {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const { id } = await params
  const isNew = id === 'nova'
  if (!isNew && !uuid.safeParse(id).success) notFound()
  const [r, foods] = await Promise.all([isNew ? null : recipeById(id), loadFoods()])
  if (!isNew && !r) notFound()
  const created = (await searchParams).criada === '1'
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 980 }}>
      <PageHead
        crumbs={[{ href: '/admin/receitas', label: 'Receitas' }]}
        title={r ? r.title : 'Nova receita'}
        actions={
          r ? (
            <form action={deleteRecipe.bind(null, r.id)}>
              <button type="submit" className="btn btn--danger btn--sm">
                Excluir receita
              </button>
            </form>
          ) : null
        }
      />
      {created && (
        <p className="alert alert--ok" role="status">
          Receita criada. Ela já pode ser adicionada às refeições no editor de planos (busque por “Receita:”).
        </p>
      )}
      <RecipeEditor
        key={r?.updatedAt.toISOString() ?? 'nova'}
        action={saveRecipe.bind(null, r?.id ?? null)}
        foods={foods.map((f) => ({ id: f.id, name: f.name, group: f.group, per100: f.per100, measures: f.measures }))}
        initial={{
          title: r?.title ?? '',
          ingredients: r?.ingredients ?? [],
          finalWeightG: r?.finalWeightG ?? null,
          portions: r?.portions ?? 1,
          prepMinutes: r?.prepMinutes ?? null,
          instructions: r?.instructions ?? '',
          tags: r?.tags ?? [],
          visibleToAll: r?.visibleToAll ?? true,
          photoUrl: r?.photoFileId ? `/arquivos/${r.photoFileId}` : null,
        }}
      />
    </div>
  )
}
