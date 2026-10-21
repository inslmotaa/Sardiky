/**
 * Preços dos planos de acompanhamento como no material de divulgação:
 * valor por mês, desconto em relação ao plano de maior valor mensal (normalmente o Mensal)
 * e o "de R$ …" (valor mensal de referência × meses).
 */
export type PlanPriceInput = { priceCents: number; months: number }
export type PlanPrice = { monthlyCents: number; discountPct: number; fullCents: number | null }

export function planPrices<T extends PlanPriceInput>(plans: T[]): (T & PlanPrice)[] {
  const monthly = (p: PlanPriceInput) => Math.round(p.priceCents / Math.max(1, p.months))
  const ref = plans.reduce((m, p) => Math.max(m, monthly(p)), 0)
  return plans.map((p) => {
    const monthlyCents = monthly(p)
    const discountPct = ref > 0 ? Math.round((1 - monthlyCents / ref) * 100) : 0
    return { ...p, monthlyCents, discountPct, fullCents: discountPct > 0 ? ref * Math.max(1, p.months) : null }
  })
}

export const monthsLabel = (n: number) => (n === 1 ? '1 mês' : `${n} meses`)

/** "Título | texto" por linha (mesmo formato do "Como funciona" nas Configurações). */
export function titledLines(text: string | null | undefined) {
  return (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [title, ...rest] = l.split('|')
      return { title: title.trim(), text: rest.join('|').trim() }
    })
}
export const titledText = (items: { title: string; text: string }[]) => items.map((i) => (i.text ? `${i.title} | ${i.text}` : i.title)).join('\n')
