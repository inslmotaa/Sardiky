/** Feriados nacionais do Brasil (fixos e móveis) — módulo puro. */

/** Domingo de Páscoa (algoritmo gregoriano anônimo). */
export function easter(year: number) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const shift = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export type Holiday = { date: string; name: string; optional: boolean }

/** Feriados nacionais e pontos facultativos (Carnaval, Corpus Christi) do ano. */
export function nationalHolidays(year: number): Holiday[] {
  const e = easter(year)
  const fixed: [string, string][] = [
    ['01-01', 'Confraternização Universal'],
    ['04-21', 'Tiradentes'],
    ['05-01', 'Dia do Trabalho'],
    ['09-07', 'Independência do Brasil'],
    ['10-12', 'Nossa Senhora Aparecida'],
    ['11-02', 'Finados'],
    ['11-15', 'Proclamação da República'],
    ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
    ['12-25', 'Natal'],
  ]
  return [
    ...fixed.map(([md, name]) => ({ date: `${year}-${md}`, name, optional: false })),
    { date: shift(e, -48), name: 'Carnaval (segunda-feira)', optional: true },
    { date: shift(e, -47), name: 'Carnaval (terça-feira)', optional: true },
    { date: shift(e, -2), name: 'Sexta-feira Santa', optional: false },
    { date: shift(e, 60), name: 'Corpus Christi', optional: true },
  ].sort((a, b) => a.date.localeCompare(b.date))
}

/** Sala de videochamada no Jitsi Meet (gratuito, sem conta): nome difícil de adivinhar. */
export function jitsiRoom(brand: string, randomPart: string) {
  const slug = brand
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .slice(0, 24)
  return `https://meet.jit.si/${slug || 'Consulta'}-${randomPart}`
}
