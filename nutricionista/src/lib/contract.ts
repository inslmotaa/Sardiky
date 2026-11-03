import { addMonthsSameDay } from './time'

export type ContractInfo = {
  name: string
  months: number
  sessions: number
  start: string | null
  end: string | null
  /** Dias até o fim da vigência (negativo = vencido); null sem data de início. */
  daysLeft: number | null
  status: 'vigente' | 'vencendo' | 'vencido' | 'sem-inicio'
}

/** Plano de acompanhamento contratado: vigência a partir do início e da duração em meses. */
export function contractInfo(pkg: { name: string; months: number; sessions: number }, start: string | null, today: string): ContractInfo {
  const base = { name: pkg.name, months: pkg.months, sessions: pkg.sessions }
  if (!start) return { ...base, start: null, end: null, daysLeft: null, status: 'sem-inicio' }
  const end = addMonthsSameDay(start, Math.max(1, pkg.months))
  const daysLeft = Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000)
  return { ...base, start, end, daysLeft, status: daysLeft < 0 ? 'vencido' : daysLeft <= 15 ? 'vencendo' : 'vigente' }
}

export const CONTRACT_STATUS: Record<ContractInfo['status'], string> = {
  vigente: 'Em vigor',
  vencendo: 'Perto de vencer',
  vencido: 'Vencido',
  'sem-inicio': 'Início a combinar',
}
