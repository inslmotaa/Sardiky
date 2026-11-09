/**
 * Regras puras da renovação (testadas em tests/unit/parte4.test.ts).
 * Avisos: um aos 7 dias (de 7 a 3 dias antes) e outro aos 2 dias (de 2 dias até o dia do término).
 * Ao vencer, a área do cliente mostra só o histórico e o botão de renovar.
 */

/** Qual aviso cabe hoje: '7', '2' ou nenhum. */
export function renovacaoEtapa(daysLeft: number): '7' | '2' | null {
  if (daysLeft < 0 || daysLeft > 7) return null
  return daysLeft <= 2 ? '2' : '7'
}

/** Acesso encerrado: há término definido e ele já passou. Sem término = sem prazo (nunca vence). */
export function acessoVencido(packageEnd: string | null | undefined, today: string): boolean {
  return !!packageEnd && packageEnd < today
}
