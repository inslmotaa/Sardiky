import { ageFrom } from './time'

/**
 * Perfil físico ("Meu corpo"): regras puras, testadas em tests/unit/parte7.test.ts.
 * - idade sempre calculada da data de nascimento, no fuso do consultório (muda sozinha no aniversário);
 * - IMC de cada data com a altura vigente naquela data;
 * - variação de peso desde o primeiro registro.
 */

export type HeightEntry = { date: string; heightCm: number }
export type WeightPoint = { date: string; value: number; source?: string }

/** Idade em anos completos no dia `today` (YYYY-MM-DD no fuso do consultório). Nunca gravada como número. */
export const ageOn = (birthDate: string | null | undefined, today: string) => ageFrom(birthDate, today)

/**
 * Altura vigente numa data: o último registro até aquela data. Antes do primeiro registro, vale o
 * primeiro (melhor do que nada); sem nenhum registro, a altura do cadastro.
 */
export function heightOn(date: string, entries: HeightEntry[], fallback: number | null = null): number | null {
  const sorted = [...entries].filter((e) => e.heightCm > 0).sort((a, b) => a.date.localeCompare(b.date))
  let found: number | null = null
  for (const e of sorted) if (e.date <= date) found = e.heightCm
  return found ?? sorted[0]?.heightCm ?? fallback
}

export function bmiOf(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/** Faixa do IMC em linguagem simples: OMS para adultos, Lipschitz a partir de 60 anos. */
export function bmiBand(value: number, age?: number | null) {
  if (age != null && age >= 60) return value < 22 ? 'Abaixo do peso' : value <= 27 ? 'Peso adequado' : 'Acima do peso'
  if (value < 18.5) return 'Abaixo do peso'
  if (value < 25) return 'Peso adequado'
  if (value < 30) return 'Sobrepeso'
  if (value < 35) return 'Obesidade grau I'
  if (value < 40) return 'Obesidade grau II'
  return 'Obesidade grau III'
}

/** IMC de cada pesagem, com a altura vigente em cada data. */
export function bmiSeries(weights: WeightPoint[], heights: HeightEntry[], fallback: number | null = null) {
  return weights
    .map((w) => ({ date: w.date, value: bmiOf(w.value, heightOn(w.date, heights, fallback)), source: w.source }))
    .filter((p): p is { date: string; value: number; source: string | undefined } => p.value != null)
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const kg = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1).replace('.', ',')} kg`

/** Variação entre o primeiro e o último peso: "−4,2 kg em 10 semanas". */
export function weightChange(points: WeightPoint[]) {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const days = daysBetween(first.date, last.date)
  if (days <= 0) return null
  const diff = Math.round((last.value - first.value) * 10) / 10
  const span = days < 14 ? `${days} ${days === 1 ? 'dia' : 'dias'}` : days < 120 ? `${Math.round(days / 7)} semanas` : `${Math.round(days / 30.44)} meses`
  return { kg: diff, days, label: `${kg(diff)} em ${span}` }
}

/** Variação nos últimos N dias (do último peso antes da janela, ou do primeiro dentro dela, até o último). */
export function weightChangeSince(points: WeightPoint[], today: string, days: number) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return null
  const start = new Date(Date.parse(today) - days * 86_400_000).toISOString().slice(0, 10)
  const before = sorted.filter((p) => p.date <= start).pop()
  const inside = sorted.filter((p) => p.date > start)
  const base = before ?? inside[0]
  const last = sorted[sorted.length - 1]
  if (!base || base === last || last.date <= start) return null
  return Math.round((last.value - base.value) * 10) / 10
}

export const fmtKgDelta = kg

/** O que falta no cadastro para o card "Meu corpo" funcionar. */
export function missingBodyData(p: { birthDate: string | null; sex: string | null; heightCm: number | null }) {
  const out: string[] = []
  if (!p.birthDate) out.push('data de nascimento')
  if (p.sex !== 'F' && p.sex !== 'M') out.push('sexo')
  if (!p.heightCm) out.push('altura')
  return out
}

/** Dias desde a última pesagem (null se nunca registrou). */
export function daysSince(date: string | null | undefined, today: string) {
  return date ? daysBetween(date, today) : null
}
