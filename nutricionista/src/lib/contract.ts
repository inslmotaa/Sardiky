export type ContractInfo = {
  name: string
  sessions: number
  start: string | null
  /** Término definido pelo coach; null = sem prazo. */
  end: string | null
  /** Dias até o término (negativo = encerrado); null quando não há prazo. */
  daysLeft: number | null
  status: 'sem-prazo' | 'vigente' | 'vencendo' | 'vencido'
}

/**
 * Plano de acompanhamento contratado. Não há prazo automático: o acompanhamento vale até o coach
 * definir uma data de término (ou trocar o plano). Com término definido, avisa quando estiver perto.
 */
export function contractInfo(pkg: { name: string; sessions: number }, start: string | null, end: string | null, today: string): ContractInfo {
  const base = { name: pkg.name, sessions: pkg.sessions, start }
  if (!end) return { ...base, end: null, daysLeft: null, status: 'sem-prazo' }
  const daysLeft = Math.round((Date.parse(end) - Date.parse(today)) / 86_400_000)
  return { ...base, end, daysLeft, status: daysLeft < 0 ? 'vencido' : daysLeft <= 15 ? 'vencendo' : 'vigente' }
}

export const CONTRACT_STATUS: Record<ContractInfo['status'], string> = {
  'sem-prazo': 'Sem prazo definido',
  vigente: 'Em vigor',
  vencendo: 'Perto do término',
  vencido: 'Encerrado',
}
