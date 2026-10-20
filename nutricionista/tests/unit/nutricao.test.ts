import { describe, expect, it } from 'vitest'
import {
  bmi,
  bmiClass,
  bmr,
  calorieTarget,
  cookedToRaw,
  equivalentGrams,
  fatChangeKg,
  fmt,
  friendlyGrams,
  harrisBenedict,
  healthyWeightRange,
  leanMass,
  macrosFromGkg,
  macrosFromPct,
  measureToGrams,
  mifflin,
  nearestMeasure,
  parseDecimal,
  proteinAlert,
  rawToCooked,
  recipeNutrients,
  scale,
  searchFoods,
  suggestSubstitutions,
  targetStatus,
  tdee,
  waistHipRatio,
  waistRisk,
  waterGoalMl,
} from '@/lib/nutricao'
import { dayForWeekday, dayTotals, normalizePlan, quantityLabel } from '@/lib/plan'
import { TACO_FOODS } from '@/db/foods-taco'

const foods = TACO_FOODS.map((f, i) => ({ id: String(i), name: f.name, group: f.group, per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber } }))
const byName = (n: string) => foods.find((f) => f.name.startsWith(n))!

describe('critérios de aceite da Fase 1', () => {
  it('Mifflin-St Jeor: mulher, 70 kg, 165 cm, 30 anos = 1.420,25 kcal; ×1,55 = 2.201,4 kcal', () => {
    const v = mifflin('F', 70, 165, 30)
    expect(v).toBeCloseTo(1420.25, 2)
    expect(fmt(tdee(v, 1.55))).toBe('2.201,4')
  })
  it('IMC de 70 kg e 1,65 m = 25,7 (sobrepeso)', () => {
    const v = bmi(70, 165)
    expect(fmt(v)).toBe('25,7')
    expect(bmiClass(v, 30).label).toBe('Sobrepeso')
  })
  it('150 g de um alimento com 128 kcal/100 g = 192 kcal; 3 colheres de sopa recalcula', () => {
    const arroz = TACO_FOODS.find((f) => f.name === 'Arroz, tipo 1, cozido')!
    expect(arroz.kcal).toBe(128)
    expect(scale(byName('Arroz, tipo 1').per100, 150).kcal).toBeCloseTo(192, 5)
    const colher = arroz.measures.find((m) => m[0].startsWith('colher de sopa'))![1]
    const g = measureToGrams(3, colher)
    expect(g).toBe(75)
    expect(scale(byName('Arroz, tipo 1').per100, g).kcal).toBeCloseTo(96, 5)
  })
  it('substituições sugeridas ficam dentro de ±10% das kcal do original', () => {
    const arroz = byName('Arroz, tipo 1')
    const subs = suggestSubstitutions(arroz, 100, foods)
    expect(subs.length).toBeGreaterThan(2)
    for (const s of subs) {
      expect(s.food.group).toBe('cereais')
      expect(Math.abs(s.kcal - 128) / 128).toBeLessThanOrEqual(0.1)
    }
  })
})

describe('porções e conversões', () => {
  it('aceita vírgula decimal', () => {
    expect(parseDecimal('70,5')).toBe(70.5)
    expect(parseDecimal('1.200,5')).toBe(1200.5)
    expect(parseDecimal('abc')).toBeNull()
  })
  it('converte cru ↔ cozido pelo fator de cocção', () => {
    expect(rawToCooked(40, 2.5)).toBe(100)
    expect(cookedToRaw(100, 2.5)).toBe(40)
  })
  it('equivalência por calorias e por macronutriente', () => {
    const arroz = byName('Arroz, tipo 1').per100
    const batata = byName('Batata-doce').per100
    expect(equivalentGrams(arroz, 100, batata, 'kcal')!).toBeCloseTo((128 / 77) * 100, 5)
    expect(equivalentGrams(arroz, 100, batata, 'carbs')!).toBeCloseTo((28.1 / 18.4) * 100, 5)
  })
  it('arredonda para quantidades amigáveis e acha a medida caseira', () => {
    expect(friendlyGrams(166.2)).toBe(170)
    expect(friendlyGrams(73)).toBe(75)
    expect(nearestMeasure(75, [{ name: 'colher de sopa', grams: 25 }])).toMatchObject({ qty: 3 })
  })
  it('calcula receita por porção e por 100 g', () => {
    const r = recipeNutrients([{ per100: byName('Aveia').per100, grams: 100 }], 200, 4)
    expect(r.perPortion!.kcal).toBeCloseTo(394 / 4, 5)
    expect(r.per100!.kcal).toBeCloseTo(197, 5)
  })
  it('busca tolerante a acentos e erros de digitação', () => {
    expect(searchFoods(foods, 'pao frances')[0].name).toBe('Pão francês')
    expect(searchFoods(foods, 'brocolis')[0].name).toContain('Brócolis')
    expect(searchFoods(foods, 'feijao pretu')[0].name).toContain('Feijão preto')
  })
})

describe('composição e gasto energético', () => {
  it('classificação do IMC para idosos (Lipschitz)', () => {
    expect(bmiClass(26, 65).label).toBe('Eutrofia')
    expect(bmiClass(21, 70).label).toBe('Baixo peso')
  })
  it('faixa de peso saudável pela altura', () => {
    const r = healthyWeightRange(165)
    expect(r.min).toBeCloseTo(50.37, 1)
    expect(r.max).toBeCloseTo(67.79, 1)
  })
  it('relação cintura-quadril e circunferência da cintura por sexo', () => {
    expect(waistHipRatio(80, 100, 'F').increased).toBe(false)
    expect(waistHipRatio(90, 100, 'F').increased).toBe(true)
    expect(waistRisk(95, 'M')).toBe('Risco aumentado')
    expect(waistRisk(90, 'F')).toBe('Risco muito aumentado')
  })
  it('Harris-Benedict, Katch-McArdle e Cunningham', () => {
    expect(harrisBenedict('M', 80, 180, 30)).toBeCloseTo(88.362 + 13.397 * 80 + 4.799 * 180 - 5.677 * 30, 5)
    const lbm = leanMass(80, 20)
    expect(lbm).toBe(64)
    expect(bmr('katch', { sex: 'M', weightKg: 80, heightCm: 180, age: 30, leanKg: lbm })).toBeCloseTo(370 + 21.6 * 64, 5)
    expect(bmr('cunningham', { sex: 'M', weightKg: 80, heightCm: 180, age: 30, leanKg: lbm })).toBeCloseTo(500 + 22 * 64, 5)
    expect(bmr('katch', { sex: 'M', weightKg: 80, heightCm: 180, age: 30 })).toBeNull()
  })
  it('meta calórica, macros, água e projeção', () => {
    expect(calorieTarget(2000, -500, 'kcal')).toBe(1500)
    expect(calorieTarget(2000, -20, 'pct')).toBe(1600)
    expect(macrosFromPct(2000, { protein: 30, carbs: 40, fat: 30 })).toEqual({ protein: 150, carbs: 200, fat: 2000 * 0.3 / 9 })
    expect(macrosFromGkg(70, { protein: 2, carbs: 3, fat: 1 }).kcal).toBe(140 * 4 + 210 * 4 + 70 * 9)
    expect(proteinAlert(50, 70)).toContain('abaixo')
    expect(proteinAlert(120, 70)).toBeNull()
    expect(waterGoalMl(70)).toBe(2450)
    expect(fatChangeKg(500, 30)).toBeCloseTo(1.948, 2)
  })
  it('cores do painel de metas: ±5% verde, ±10% amarelo, acima vermelho', () => {
    expect(targetStatus(1540, 1500)).toBe('ok')
    expect(targetStatus(1640, 1500)).toBe('warn')
    expect(targetStatus(1700, 1500)).toBe('danger')
    expect(targetStatus(1700, null)).toBe('none')
  })
})

describe('plano alimentar', () => {
  it('converte planos antigos (texto livre) sem perder conteúdo', () => {
    const p = normalizePlan({ meals: [{ id: 'm', name: 'Almoço', time: '12:00', items: [{ food: 'Arroz', quantity: '100 g', householdMeasure: '4 colheres', substitutions: [{ food: 'Batata' }] }] }], guidance: 'Água' })
    expect(p.v).toBe(2)
    expect(p.mode).toBe('livre')
    expect(p.days[0].meals[0].options[0].items[0]).toMatchObject({ name: 'Arroz', text: '4 colheres · 100 g' })
    expect(p.guidance).toBe('Água')
  })
  it('soma o dia pela opção escolhida e escolhe o dia pela semana', () => {
    const per100 = byName('Arroz, tipo 1').per100
    const item = (g: number) => ({ id: 'i' + g, foodId: '0', name: 'Arroz', group: 'cereais', per100, grams: g, measure: null, text: '', notes: '', locked: false, subs: [] })
    const plan = normalizePlan({
      v: 2,
      days: [
        { id: 'd1', label: 'Dia de treino', weekdays: [1, 3, 5], meals: [{ id: 'm1', name: 'Almoço', time: '12:00', options: [{ id: 'o1', label: 'Opção 1', items: [item(100)] }, { id: 'o2', label: 'Opção 2', items: [item(200)] }] }] },
        { id: 'd2', label: 'Descanso', weekdays: [], meals: [] },
      ],
    })
    expect(dayTotals(plan.days[0]).kcal).toBeCloseTo(128, 5)
    expect(dayTotals(plan.days[0], { m1: 'o2' }).kcal).toBeCloseTo(256, 5)
    expect(dayForWeekday(plan, 3).id).toBe('d1')
    expect(dayForWeekday(plan, 0).id).toBe('d2')
    expect(quantityLabel({ grams: 75, measure: { name: 'colher de sopa cheia', grams: 25, qty: 3 }, text: '' })).toBe('3 colheres de sopa cheias · 75 g')
    expect(quantityLabel({ grams: 50, measure: { name: 'fatia', grams: 25, qty: 2 }, text: '' })).toBe('2 fatias · 50 g')
    expect(quantityLabel({ grams: 155, measure: { name: 'unidade', grams: 310, qty: 0.5 }, text: '' })).toBe('½ unidade · 155 g')
    expect(quantityLabel({ grams: 160, measure: { name: 'copo (200 ml)', grams: 200, qty: 0.8 }, text: '' })).toBe('0,8 copo (200 ml) · 160 g')
    expect(quantityLabel({ grams: 200, measure: { name: 'filé médio', grams: 100, qty: 2 }, text: '' })).toBe('2 filés médios · 200 g')
  })
})
