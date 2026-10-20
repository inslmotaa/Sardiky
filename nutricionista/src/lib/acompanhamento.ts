import { dayForWeekday, type PlanContent } from './plan'
import { addDays, weekdayOf } from './time'

/**
 * Adesão ao plano (módulo puro, usado no painel de Acompanhamento e no Progresso do paciente).
 * Refeição "feita" conta 1, "parcial" conta ½, "pulada" ou sem registro conta 0.
 */

export type MealStatus = 'feita' | 'parcial' | 'pulada'
export type LogLite = { date: string; status: string }

export const ADHERENCE_DEFAULTS = { good: 80, low: 40 } as const
export type AdherenceThresholds = { good: number; low: number }
export type AdherenceClass = 'em_dia' | 'dificuldade' | 'sem_progresso'

export const ADHERENCE_LABEL: Record<AdherenceClass, string> = {
  em_dia: 'Em dia',
  dificuldade: 'Com dificuldade',
  sem_progresso: 'Sem progresso',
}

export const STATUS_WEIGHT: Record<string, number> = { feita: 1, parcial: 0.5, pulada: 0 }

/** Lista de datas (AAAA-MM-DD) de `from` até `to`, inclusive. */
export function dateRange(from: string, to: string) {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** Refeições previstas no plano para a data (pelo dia da semana). */
export function plannedMealsOn(plan: PlanContent, date: string) {
  return dayForWeekday(plan, weekdayOf(date))?.meals.length ?? 0
}

/**
 * Adesão no período. Só conta dias a partir do início do plano (`planStart`), para
 * não penalizar quem acabou de receber o plano. Devolve null se não houver refeição prevista.
 */
export function adherence(plan: PlanContent | null, logs: LogLite[], from: string, to: string, planStart?: string | null) {
  if (!plan) return null
  const start = planStart && planStart > from ? planStart : from
  if (start > to) return null
  let planned = 0
  for (const d of dateRange(start, to)) planned += plannedMealsOn(plan, d)
  if (planned === 0) return null
  const done = logs.filter((l) => l.date >= start && l.date <= to).reduce((n, l) => n + (STATUS_WEIGHT[l.status] ?? 0), 0)
  return { pct: Math.min(100, Math.round((done / planned) * 100)), done, planned }
}

export function classify(pct: number | null, t: AdherenceThresholds = ADHERENCE_DEFAULTS): AdherenceClass {
  if (pct == null) return 'sem_progresso'
  if (pct >= t.good) return 'em_dia'
  if (pct >= t.low) return 'dificuldade'
  return 'sem_progresso'
}

/** Dias seguidos com algum registro, terminando hoje (ou ontem, se hoje ainda não houve registro). */
export function streak(datesWithRecords: Iterable<string>, today: string) {
  const set = new Set(datesWithRecords)
  let d = set.has(today) ? today : addDays(today, -1)
  let n = 0
  while (set.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

/** Adesão semana a semana (blocos de 7 dias terminando hoje), da mais antiga para a mais recente. */
export function weeklyAdherence(plan: PlanContent | null, logs: LogLite[], today: string, weeks = 6, planStart?: string | null) {
  const out: { from: string; to: string; pct: number | null }[] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const to = addDays(today, -7 * w)
    const from = addDays(to, -6)
    out.push({ from, to, pct: adherence(plan, logs, from, to, planStart)?.pct ?? null })
  }
  return out
}

/** Dias sem nenhum registro até hoje (null se nunca registrou). */
export function daysSince(lastDate: string | null | undefined, today: string) {
  if (!lastDate) return null
  const a = Date.UTC(+lastDate.slice(0, 4), +lastDate.slice(5, 7) - 1, +lastDate.slice(8, 10))
  const b = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  return Math.round((b - a) / 86400000)
}
