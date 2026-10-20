/**
 * Planos de exemplo (dados fictícios), compartilhados entre o seed do banco e a
 * prévia estática. `resolve` devolve o alimento da base com o id de cada ambiente.
 */
import { dayTotals, normalizePlan, uid, type PlanContent } from '../lib/plan'
import { equivalentGrams, friendlyGrams, nearestMeasure, type Nutrients } from '../lib/nutricao'
import { TACO_FOODS } from './foods-taco'

export type ResolvedFood = { id: string; name: string; group: string; per100: Nutrients }

export function buildDemoPlans(resolve: (name: string) => ResolvedFood) {
  const food = (name: string) => {
    const row = resolve(name)
    const seedFood = TACO_FOODS.find((f) => f.name.startsWith(name))
    if (!seedFood) throw new Error(`Alimento não encontrado: ${name}`)
    return { row, seedFood, per100: row.per100 }
  }
  const measureFor = (name: string, grams: number) => {
    const m = nearestMeasure(grams, food(name).seedFood.measures.map(([n, g]) => ({ name: n, grams: g })))
    return m && m.error < 0.15 ? { name: m.name, grams: m.grams, qty: m.qty } : null
  }
  /** Substituição com a mesma quantidade de calorias, arredondada para valor amigável. */
  const sub = (name: string, original: string, origGrams: number) => {
    const f = food(name)
    const grams = friendlyGrams(equivalentGrams(food(original).per100, origGrams, f.per100, 'kcal')!)
    return { foodId: f.row.id, name: f.row.name, per100: f.per100, grams, measure: measureFor(name, grams), text: '' }
  }
  const item = (name: string, grams: number, opts: { notes?: string; subs?: string[]; locked?: boolean } = {}) => {
    const f = food(name)
    return {
      id: uid(),
      foodId: f.row.id,
      name: f.row.name,
      group: f.row.group,
      per100: f.per100,
      grams,
      measure: measureFor(name, grams),
      text: '',
      notes: opts.notes ?? '',
      locked: opts.locked ?? false,
      subs: (opts.subs ?? []).map((n) => sub(n, name, grams)),
    }
  }
  const meal = (name: string, time: string, options: ReturnType<typeof item>[][], notes = '') => ({
    id: uid(),
    name,
    time,
    notes,
    options: options.map((items, i) => ({ id: uid(), label: `Opção ${i + 1}`, items })),
  })

  const reeducacaoDay = () => ({
    id: uid(),
    label: 'Todos os dias',
    weekdays: [] as number[],
    meals: [
      meal('Café da manhã', '07:00', [
        [
          item('Pão de forma integral', 50, { subs: ['Polvilho doce', 'Cuscuz de milho'] }),
          item('Ovo de galinha, inteiro, cozido', 100, { subs: ['Queijo minas frescal'] }),
          item('Mamão papaia', 155, { subs: ['Banana prata', 'Morango'] }),
          item('Café, infusão', 50, { notes: 'Sem açúcar' }),
        ],
        [item('Iogurte natural', 170), item('Aveia em flocos', 30), item('Morango', 140, { subs: ['Banana prata', 'Kiwi'] })],
      ]),
      meal(
        'Almoço',
        '12:30',
        [
          [
            item('Alface crespa', 40),
            item('Tomate', 100),
            item('Arroz, integral', 100, { subs: ['Batata-doce', 'Mandioca', 'Arroz, tipo 1'] }),
            item('Feijão carioca', 80, { subs: ['Lentilha', 'Feijão preto'] }),
            item('Frango, peito', 120, { subs: ['Merluza', 'Carne bovina, patinho'] }),
            item('Azeite de oliva', 8, { locked: true }),
          ],
        ],
        'Comece pela salada.',
      ),
      meal('Lanche da tarde', '16:00', [
        [item('Iogurte natural', 170), item('Aveia em flocos', 15), item('Banana prata', 60, { subs: ['Maçã Fuji', 'Pera'] })],
        [item('Pão francês', 50), item('Queijo minas frescal', 30)],
      ]),
      meal('Jantar', '19:30', [
        [
          item('Batata-doce', 130, { subs: ['Arroz, integral', 'Mandioca'] }),
          item('Merluza', 120, { subs: ['Frango, peito', 'Ovo de galinha, inteiro, cozido'] }),
          item('Brócolis', 60),
          item('Azeite de oliva', 8, { locked: true }),
        ],
      ]),
    ],
  })

  const withTargets = (content: PlanContent): PlanContent => {
    const t = dayTotals(content.days[0])
    const r = (n: number, step: number) => Math.round(n / step) * step
    return { ...content, targets: { kcal: r(t.kcal, 50), protein: r(t.protein, 5), carbs: r(t.carbs, 5), fat: r(t.fat, 5), fiber: r(t.fiber, 5) } }
  }
  const guidance =
    'Beba água ao longo do dia (meta combinada: 2 litros). Prefira preparações assadas, cozidas ou grelhadas. Mastigue devagar e faça as refeições sem telas sempre que possível.'

  const beatrizPlan = withTargets({ v: 2, mode: 'calculado', targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null }, days: [reeducacaoDay()], guidance })

  // Versão anterior em "modo livre" (orientações qualitativas, sem cálculo).
  const beatrizV1 = normalizePlan({
    meals: [
      { name: 'Café da manhã', time: '07:30', items: [{ food: 'Pão integral', quantity: '2 fatias' }, { food: 'Ovo mexido', quantity: '2 unidades' }, { food: 'Fruta', quantity: '1 porção' }] },
      { name: 'Almoço', time: '12:30', items: [{ food: 'Salada à vontade' }, { food: 'Arroz e feijão', quantity: '4 colheres + 1 concha' }, { food: 'Proteína magra', quantity: '1 filé' }] },
      { name: 'Jantar', time: '19:30', items: [{ food: 'Repetir a estrutura do almoço, em menor quantidade' }] },
    ],
    guidance: 'Primeira fase: organizar os horários das refeições.',
  })

  const treinoDay = reeducacaoDay()
  treinoDay.label = 'Dia de treino'
  treinoDay.weekdays = [1, 3, 5]
  treinoDay.meals.splice(
    3,
    0,
    meal('Pré-treino', '17:30', [[item('Banana prata', 120, { subs: ['Maçã Fuji'] }), item('Aveia em flocos', 20), item('Mel', 15)]], 'Cerca de 1 hora antes do treino.'),
  )
  const descansoDay = reeducacaoDay()
  descansoDay.label = 'Dia de descanso'
  descansoDay.weekdays = [0, 2, 4, 6]
  const lucasPlan = withTargets({
    v: 2,
    mode: 'calculado',
    targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null },
    days: [treinoDay, descansoDay],
    guidance: 'Nos dias de treino longo, reforce a hidratação e faça o pré-treino cerca de 1 hora antes.',
  })

  return { beatrizPlan, beatrizV1, lucasPlan }
}
