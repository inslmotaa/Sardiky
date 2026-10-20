import { requirePatient } from '@/lib/auth/session'
import { currentPublishedPlan } from '@/lib/patient-context'
import { loadFoods } from '@/lib/foods'
import { expandRecipes, loadRecipes } from '@/lib/recipes'
import { normalizePlan } from '@/lib/plan'
import { shoppingList, shoppingQuantity } from '@/lib/compras'
import { ShoppingList } from '@/components/nutri/ShoppingList'
import { Empty, PageHead } from '@/components/ui'

export default async function ShoppingPage() {
  const user = await requirePatient()
  const plan = await currentPublishedPlan(user.patientId)
  if (!plan)
    return (
      <div className="stack">
        <PageHead crumbs={[{ href: '/paciente/mais', label: 'Mais' }]} title="Lista de compras" />
        <Empty>A lista aparece quando o seu plano alimentar for ativado.</Empty>
      </div>
    )
  const [foods, recipes] = await Promise.all([loadFoods(), loadRecipes()])
  const content = expandRecipes(normalizePlan(plan.content), recipes)
  const info = new Map(foods.map((f) => [f.id, { cookingFactor: f.cookingFactor, measures: f.measures }]))
  // Grupo do alimento pela base (ingredientes de receitas chegam sem grupo).
  for (const d of content.days) for (const m of d.meals) for (const o of m.options) for (const it of o.items) if (!it.group && it.foodId) it.group = foods.find((f) => f.id === it.foodId)?.group ?? ''
  const rows = shoppingList(content, info).map((i) => ({ key: i.key, name: i.name, groupLabel: i.groupLabel, quantity: shoppingQuantity(i) }))
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 760 }}>
      <PageHead
        crumbs={[{ href: '/paciente/mais', label: 'Mais' }]}
        title="Lista de compras da semana"
        subtitle="Gerada do seu plano (primeira opção de cada refeição, 7 dias). Alimentos cozidos aparecem em peso cru. Quantidades aproximadas."
      />
      <ShoppingList rows={rows} storageKey={`compras-${plan.id}`} />
    </div>
  )
}
