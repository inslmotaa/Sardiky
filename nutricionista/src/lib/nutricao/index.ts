/**
 * Cálculos nutricionais — módulo puro (sem banco, sem React), usado no painel,
 * no app do paciente, nas calculadoras e na prévia estática. Coberto por testes.
 *
 * Fórmulas de referência; confirme os parâmetros com o nutricionista responsável.
 */

/* --------------------------------- tipos --------------------------------- */

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number; fiber: number }
export type Sex = 'F' | 'M'
export type MacroKey = 'protein' | 'carbs' | 'fat'

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }

export const FOOD_GROUPS: Record<string, string> = {
  cereais: 'Cereais, pães e tubérculos',
  leguminosas: 'Leguminosas',
  carnes: 'Carnes e ovos',
  laticinios: 'Leite e derivados',
  frutas: 'Frutas',
  verduras: 'Verduras e legumes',
  gorduras: 'Óleos, gorduras e oleaginosas',
  acucares: 'Açúcares e doces',
  bebidas: 'Bebidas',
  outros: 'Outros',
}

/** Macro principal de cada grupo, usado na equivalência por macronutriente. */
export const GROUP_MAIN_MACRO: Record<string, MacroKey | 'kcal'> = {
  cereais: 'carbs',
  leguminosas: 'carbs',
  carnes: 'protein',
  laticinios: 'protein',
  frutas: 'carbs',
  verduras: 'kcal',
  gorduras: 'fat',
  acucares: 'carbs',
  bebidas: 'kcal',
  outros: 'kcal',
}

/* ------------------------------ números e texto ------------------------------ */

/** Aceita vírgula ou ponto decimal ("70,5" → 70.5). Retorna null se inválido. */
export function parseDecimal(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.trim().replace(/\s/g, '')
  if (!s) return null
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return Number.isFinite(n) ? n : null
}

/** 70.5 → "70,5" (pt-BR). */
export function fmt(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits

/** Remove acentos e caixa para busca tolerante ("pao frances" → "Pão francês"). */
export function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Busca tolerante a acentos e a pequenos erros de digitação. */
export function searchFoods<T extends { name: string }>(foods: T[], query: string, limit = 12): T[] {
  const q = normalize(query)
  if (!q) return foods.slice(0, limit)
  const terms = q.split(' ')
  const scored: { f: T; score: number }[] = []
  for (const f of foods) {
    const name = normalize(f.name)
    const words = name.split(' ')
    let score = 0
    let ok = true
    for (const t of terms) {
      if (name.includes(t)) score += name.startsWith(t) ? 3 : 2
      else if (t.length >= 4 && words.some((w) => editDistance(w.slice(0, t.length + 1), t) <= 1)) score += 1
      else {
        ok = false
        break
      }
    }
    if (ok) scored.push({ f, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => x.f)
}

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/* ------------------------------ porções ------------------------------ */

/** nutriente = valor por 100 g × quantidade (g) ÷ 100 */
export function scale(per100: Nutrients, grams: number): Nutrients {
  const k = grams / 100
  return { kcal: per100.kcal * k, protein: per100.protein * k, carbs: per100.carbs * k, fat: per100.fat * k, fiber: per100.fiber * k }
}

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat, fiber: a.fiber + b.fiber }),
    { ...ZERO },
  )
}

export function times(n: Nutrients, k: number): Nutrients {
  return { kcal: n.kcal * k, protein: n.protein * k, carbs: n.carbs * k, fat: n.fat * k, fiber: n.fiber * k }
}

export const measureToGrams = (qty: number, gramsPerMeasure: number) => qty * gramsPerMeasure
export const gramsToMeasure = (grams: number, gramsPerMeasure: number) => (gramsPerMeasure > 0 ? grams / gramsPerMeasure : 0)

/** Peso cozido a partir do cru pelo fator de cocção (cozido ÷ cru), e vice-versa. */
export const rawToCooked = (rawGrams: number, factor: number) => rawGrams * factor
export const cookedToRaw = (cookedGrams: number, factor: number) => (factor > 0 ? cookedGrams / factor : 0)

/** Arredonda para uma quantidade amigável: 5 g até 100 g, 10 g acima. */
export function friendlyGrams(g: number) {
  if (g <= 0) return 0
  const step = g < 20 ? 1 : g <= 100 ? 5 : 10
  return Math.max(step, Math.round(g / step) * step)
}

/** Medida caseira mais próxima de uma quantidade, em meias unidades (ex.: 3 colheres de sopa). */
export function nearestMeasure(grams: number, measures: { name: string; grams: number }[]) {
  let best: { name: string; grams: number; qty: number; error: number } | null = null
  for (const m of measures) {
    if (m.grams <= 0) continue
    const qty = Math.max(0.5, Math.round((grams / m.grams) * 2) / 2)
    const error = Math.abs(qty * m.grams - grams) / grams
    if (qty <= 12 && (!best || error < best.error)) best = { ...m, qty, error }
  }
  return best
}

/** Plural de uma palavra em português (regras simples, suficientes para medidas caseiras). */
function pluralWord(w: string) {
  if (/ão$/.test(w)) return w.replace(/ão$/, 'ões')
  if (/[rz]$/.test(w)) return w + 'es'
  if (/l$/.test(w)) return w.replace(/l$/, 'is')
  if (/m$/.test(w)) return w.replace(/m$/, 'ns')
  if (/[aeiouáéíóúâêô]$/i.test(w)) return w + 's'
  return w
}

/**
 * Plural de uma medida caseira: "colher de sopa cheia" → "colheres de sopa cheias",
 * "fatia" → "fatias". Não altera o complemento após "de" nem o que está entre parênteses.
 */
export function pluralMeasure(name: string, qty: number) {
  if (qty <= 1) return name
  const words = name.split(' ')
  let inParen = false
  return words
    .map((w, i) => {
      if (w.startsWith('(')) inParen = true
      const skip = inParen || ['de', 'da', 'do'].includes(w) || ['de', 'da', 'do'].includes(words[i - 1] ?? '')
      if (w.endsWith(')')) inParen = false
      return skip ? w : pluralWord(w)
    })
    .join(' ')
}

export function formatMeasure(qty: number, name: string) {
  const q = qty === 0.5 ? '½' : Number.isInteger(qty) ? String(qty) : fmt(qty, 2)
  return `${q} ${pluralMeasure(name, qty)}`
}

/**
 * Quantidade de um alimento B que equivale a uma porção do alimento A,
 * pelas calorias ou por um macronutriente.
 */
export function equivalentGrams(fromPer100: Nutrients, fromGrams: number, toPer100: Nutrients, basis: MacroKey | 'kcal' = 'kcal') {
  const target = scale(fromPer100, fromGrams)[basis]
  const per100 = toPer100[basis]
  if (per100 <= 0) return null
  return (target / per100) * 100
}

export type FoodLike = { id: string; name: string; group: string; per100: Nutrients }

/**
 * Sugere substitutos do mesmo grupo com calorias equivalentes: calcula a quantidade
 * que iguala as kcal, arredonda para um valor amigável e mantém só os que ficam
 * dentro da tolerância (padrão ±10%).
 */
export function suggestSubstitutions<F extends FoodLike>(original: F, grams: number, candidates: F[], tolerance = 0.1, limit = 6) {
  const targetKcal = scale(original.per100, grams).kcal
  if (targetKcal <= 0) return []
  const out: { food: F; grams: number; kcal: number; diff: number }[] = []
  for (const c of candidates) {
    if (c.id === original.id || c.group !== original.group || c.per100.kcal <= 0) continue
    const raw = equivalentGrams(original.per100, grams, c.per100, 'kcal')
    if (!raw || raw > 1000) continue
    const g = friendlyGrams(raw)
    const kcal = scale(c.per100, g).kcal
    const diff = (kcal - targetKcal) / targetKcal
    if (Math.abs(diff) <= tolerance) out.push({ food: c, grams: g, kcal, diff })
  }
  return out.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff)).slice(0, limit)
}

/** Nutrientes de uma receita: total, por porção e por 100 g do preparo pronto. */
export function recipeNutrients(ingredients: { per100: Nutrients; grams: number }[], finalWeightGrams: number, portions: number) {
  const total = sum(ingredients.map((i) => scale(i.per100, i.grams)))
  return {
    total,
    perPortion: portions > 0 ? times(total, 1 / portions) : null,
    per100: finalWeightGrams > 0 ? times(total, 100 / finalWeightGrams) : null,
  }
}

/* ------------------------------ antropometria ------------------------------ */

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100
  return weightKg / (m * m)
}

/** Classificação do IMC: OMS para adultos; Lipschitz para idosos (≥ 60 anos). */
export function bmiClass(value: number, age?: number | null) {
  if (age != null && age >= 60) {
    if (value < 22) return { label: 'Baixo peso', ref: 'Lipschitz (idosos)' }
    if (value <= 27) return { label: 'Eutrofia', ref: 'Lipschitz (idosos)' }
    return { label: 'Sobrepeso', ref: 'Lipschitz (idosos)' }
  }
  const ref = 'OMS (adultos)'
  if (value < 18.5) return { label: 'Baixo peso', ref }
  if (value < 25) return { label: 'Eutrofia', ref }
  if (value < 30) return { label: 'Sobrepeso', ref }
  if (value < 35) return { label: 'Obesidade grau I', ref }
  if (value < 40) return { label: 'Obesidade grau II', ref }
  return { label: 'Obesidade grau III', ref }
}

/** Faixa de peso correspondente ao IMC 18,5–24,9 para a altura. */
export function healthyWeightRange(heightCm: number) {
  const m2 = (heightCm / 100) ** 2
  return { min: 18.5 * m2, max: 24.9 * m2 }
}

export function waistHipRatio(waistCm: number, hipCm: number, sex: Sex) {
  const value = waistCm / hipCm
  return { value, increased: sex === 'M' ? value > 0.9 : value > 0.85 }
}

export function waistRisk(waistCm: number, sex: Sex) {
  const [inc, high] = sex === 'M' ? [94, 102] : [80, 88]
  if (waistCm >= high) return 'Risco muito aumentado'
  if (waistCm >= inc) return 'Risco aumentado'
  return 'Sem risco aumentado'
}

/** Massa magra = peso × (1 − %G ÷ 100) */
export const leanMass = (weightKg: number, bodyFatPct: number) => weightKg * (1 - bodyFatPct / 100)

/* ------------------------------ gasto energético ------------------------------ */

export const BMR_FORMULAS = {
  mifflin: 'Mifflin-St Jeor',
  harris: 'Harris-Benedict revisada',
  katch: 'Katch-McArdle (massa magra)',
  cunningham: 'Cunningham (massa magra, atletas)',
} as const
export type BmrFormula = keyof typeof BMR_FORMULAS

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: 'Sedentário' },
  { value: 1.375, label: 'Atividade leve' },
  { value: 1.55, label: 'Atividade moderada' },
  { value: 1.725, label: 'Atividade intensa' },
  { value: 1.9, label: 'Atividade muito intensa' },
] as const

export function mifflin(sex: Sex, w: number, h: number, age: number) {
  return 10 * w + 6.25 * h - 5 * age + (sex === 'M' ? 5 : -161)
}
export function harrisBenedict(sex: Sex, w: number, h: number, age: number) {
  return sex === 'M' ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age : 447.593 + 9.247 * w + 3.098 * h - 4.33 * age
}
export const katchMcArdle = (leanKg: number) => 370 + 21.6 * leanKg
export const cunningham = (leanKg: number) => 500 + 22 * leanKg

export function bmr(
  formula: BmrFormula,
  p: { sex: Sex; weightKg: number; heightCm: number; age: number; leanKg?: number | null },
): number | null {
  switch (formula) {
    case 'mifflin':
      return mifflin(p.sex, p.weightKg, p.heightCm, p.age)
    case 'harris':
      return harrisBenedict(p.sex, p.weightKg, p.heightCm, p.age)
    case 'katch':
      return p.leanKg ? katchMcArdle(p.leanKg) : null
    case 'cunningham':
      return p.leanKg ? cunningham(p.leanKg) : null
  }
}

export const tdee = (bmrKcal: number, activityFactor: number) => bmrKcal * activityFactor

/** Meta calórica: GET − déficit (ou + superávit), em kcal ou em % do GET. */
export function calorieTarget(getKcal: number, adjust: number, unit: 'kcal' | 'pct') {
  return unit === 'kcal' ? getKcal + adjust : getKcal * (1 + adjust / 100)
}

/** Estimativa de variação de gordura: déficit diário × dias ÷ 7.700 kcal. */
export const fatChangeKg = (dailyDeficit: number, days: number) => (dailyDeficit * days) / 7700

/* ------------------------------ macros e água ------------------------------ */

export const KCAL_PER_G: Record<MacroKey, number> = { protein: 4, carbs: 4, fat: 9 }

/** Gramas = kcal × % ÷ 4 (proteína e carboidrato) ou ÷ 9 (gordura). */
export function macrosFromPct(kcal: number, pct: Record<MacroKey, number>) {
  return {
    protein: (kcal * pct.protein) / 100 / 4,
    carbs: (kcal * pct.carbs) / 100 / 4,
    fat: (kcal * pct.fat) / 100 / 9,
  }
}

export function macrosFromGkg(weightKg: number, gkg: Record<MacroKey, number>) {
  const g = { protein: gkg.protein * weightKg, carbs: gkg.carbs * weightKg, fat: gkg.fat * weightKg }
  return { ...g, kcal: g.protein * 4 + g.carbs * 4 + g.fat * 9 }
}

/** Alerta se a proteína ficar fora de 0,8–2,5 g/kg. */
export function proteinAlert(proteinG: number, weightKg: number) {
  const gkg = proteinG / weightKg
  if (gkg < 0.8) return `Proteína em ${fmt(gkg)} g/kg: abaixo de 0,8 g/kg.`
  if (gkg > 2.5) return `Proteína em ${fmt(gkg)} g/kg: acima de 2,5 g/kg.`
  return null
}

/** Água: 35 ml × peso (kg) por dia (configurável) + acréscimo para treino. */
export const waterGoalMl = (weightKg: number, mlPerKg = 35, extraMl = 0) => Math.round(weightKg * mlPerKg + extraMl)

/* ------------------------------ metas do plano ------------------------------ */

/** Verde dentro de ±5% da meta, amarelo até ±10%, vermelho acima. */
export function targetStatus(planned: number, target: number | null | undefined): 'ok' | 'warn' | 'danger' | 'none' {
  if (!target) return 'none'
  const d = Math.abs(planned - target) / target
  return d <= 0.05 ? 'ok' : d <= 0.1 ? 'warn' : 'danger'
}

/* ------------------------------ validação de entradas ------------------------------ */

export const LIMITS = { weight: [20, 350], height: [100, 230], age: [2, 110] } as const

export function inRange(v: number | null, [min, max]: readonly [number, number]) {
  return v != null && v >= min && v <= max
}
