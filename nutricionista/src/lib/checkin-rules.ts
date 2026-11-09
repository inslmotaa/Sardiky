/**
 * Regras puras dos check-ins periódicos (testadas em tests/unit/parte4.test.ts).
 * O coach define "a cada N dias" por cliente; cada check-in tem um prazo (dueDate).
 * Ele abre alguns dias antes do prazo e, se não for enviado até o prazo, fica atrasado.
 */
import { addDays } from './time'

/** Quantos dias antes do prazo o check-in já pode ser respondido. */
export const CHECKIN_OPEN_DAYS = 3
/** Frequências sugeridas no painel (dias). */
export const CHECKIN_FREQUENCIES = [7, 14, 15, 21, 30] as const

export type CheckinState = 'aguardando' | 'aberto' | 'atrasado' | 'enviado'

export function checkinState(c: { status: string; dueDate: string }, today: string): CheckinState {
  if (c.status === 'enviado') return 'enviado'
  if (today > c.dueDate) return 'atrasado'
  if (today >= addDays(c.dueDate, -CHECKIN_OPEN_DAYS)) return 'aberto'
  return 'aguardando'
}

/** Dias de atraso (0 se ainda no prazo). */
export function daysLate(dueDate: string, today: string): number {
  if (today <= dueDate) return 0
  return Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${dueDate}T12:00:00Z`)) / 86_400_000)
}

/**
 * Próximo prazo depois de um check-in: o anterior + N dias (o calendário não "escorrega" se o
 * cliente responder antes ou depois). Se ficou muito para trás, pula para o primeiro prazo
 * depois de hoje.
 */
export function nextDueDate(prevDue: string, everyDays: number, today: string): string {
  let next = addDays(prevDue, everyDays)
  while (next <= today) next = addDays(next, everyDays)
  return next
}

export const CHECKIN_SCALES = {
  adesao: { label: 'Quanto você seguiu o plano?', low: 'Quase nada', high: 'Tudo' },
  energia: { label: 'Energia no dia a dia', low: 'Muito baixa', high: 'Muito boa' },
  fome: { label: 'Fome entre as refeições', low: 'Muita fome', high: 'Sem fome' },
  sono: { label: 'Qualidade do sono', low: 'Muito ruim', high: 'Muito boa' },
} as const
export type CheckinScale = keyof typeof CHECKIN_SCALES

export const CHECKIN_STATE_LABEL: Record<CheckinState, string> = {
  aguardando: 'Aguardando',
  aberto: 'Aberto',
  atrasado: 'Atrasado',
  enviado: 'Enviado',
}
