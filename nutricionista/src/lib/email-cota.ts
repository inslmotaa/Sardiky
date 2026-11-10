/**
 * Cota de e-mail do plano gratuito do Resend (100 por dia e 3.000 por mês). Regras puras, testadas
 * em tests/unit/parte5.test.ts. Os e-mails essenciais (senha, confirmação de conta, link de acesso,
 * vencimento) têm prioridade e reservam 40 por dia; o resumo do dia usa só o que sobra.
 * Para um plano pago, ajuste EMAIL_DAILY_LIMIT e EMAIL_MONTHLY_LIMIT.
 */
export type EmailCategory = 'essencial' | 'resumo'
export type EmailLimits = { day: number; month: number; reserve: number }
export type EmailUsage = { day: number; month: number }

const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : d)
export const emailLimits = (env: Record<string, string | undefined> = process.env): EmailLimits => ({
  day: num(env.EMAIL_DAILY_LIMIT, 100),
  month: num(env.EMAIL_MONTHLY_LIMIT, 3000),
  reserve: 40,
})

/** Dias que faltam no mês (contando hoje), em UTC, como o provedor conta. */
export function daysLeftInMonth(now: Date) {
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  return last - now.getUTCDate() + 1
}

/**
 * Pode enviar mais um e-mail desta categoria?
 * - essencial: até o limite do dia e do mês;
 * - resumo: só se sobrar a reserva dos essenciais hoje (40) e nos dias que faltam do mês.
 */
export function podeEnviar(cat: EmailCategory, used: EmailUsage, limits: EmailLimits, now = new Date()) {
  if (used.day >= limits.day || used.month >= limits.month) return false
  if (cat === 'essencial') return true
  return used.day < limits.day - limits.reserve && used.month < limits.month - limits.reserve * daysLeftInMonth(now)
}

/** Aviso no painel: perto do limite (80% do dia ou 90% do mês) ou o resumo já está sendo pulado. */
export function quaseNoLimite(used: EmailUsage, limits: EmailLimits, now = new Date()) {
  return used.day >= limits.day * 0.8 || used.month >= limits.month * 0.9 || !podeEnviar('resumo', used, limits, now)
}
