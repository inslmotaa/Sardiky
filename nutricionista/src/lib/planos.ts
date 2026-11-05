export type PlanPriceInput = { priceCents: number; months: number }
/** O que o site e o app do cliente mostram: o preço do plano e o valor por mês. Nada de desconto nem "de R$ …". */
export type PlanPrice = { monthlyCents: number }
export type PlanDiscount = PlanPrice & { discountPct: number; fullCents: number | null }

const monthly = (p: PlanPriceInput) => Math.round(p.priceCents / Math.max(1, p.months))

/** Preços para as páginas públicas e o app do cliente: só o valor por mês (sem desconto). */
export function planPrices<T extends PlanPriceInput>(plans: T[]): (T & PlanPrice)[] {
  return plans.map((p) => ({ ...p, monthlyCents: monthly(p) }))
}

/**
 * Só para relatórios internos (painel): desconto em relação ao plano de maior valor mensal
 * e o valor de referência (valor mensal × meses). Nunca use nas páginas públicas.
 */
export function planDiscounts<T extends PlanPriceInput>(plans: T[]): (T & PlanDiscount)[] {
  const ref = plans.reduce((m, p) => Math.max(m, monthly(p)), 0)
  return plans.map((p) => {
    const monthlyCents = monthly(p)
    const discountPct = ref > 0 ? Math.round((1 - monthlyCents / ref) * 100) : 0
    return { ...p, monthlyCents, discountPct, fullCents: discountPct > 0 ? ref * Math.max(1, p.months) : null }
  })
}

/** Plano em destaque nos cartões: o marcado com selo ou, sem selo, o de menor valor por mês. */
export function featuredPlan<T extends PlanPriceInput & { id: string; highlight?: string | null }>(plans: T[]) {
  return plans.find((p) => p.highlight) ?? [...plans].sort((a, b) => monthly(a) - monthly(b))[0]
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
