/**
 * Utilitários de data e hora no fuso do consultório.
 * Datas "de calendário" circulam como strings YYYY-MM-DD; horários como HH:MM.
 * Instantes (consultas, bloqueios) são Date em UTC no banco.
 */

export const DEFAULT_TZ = 'America/Sao_Paulo'

const partsCache = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(tz: string) {
  let f = partsCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    })
    partsCache.set(tz, f)
  }
  return f
}

export function zonedParts(date: Date, tz = DEFAULT_TZ) {
  const p: Record<string, string> = {}
  for (const { type, value } of partsFormatter(tz).formatToParts(date)) p[type] = value
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    weekday,
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  }
}

/** Diferença (ms) entre o relógio do fuso e UTC no instante informado. */
function offsetMs(date: Date, tz: string) {
  const p = zonedParts(date, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** Converte data + hora locais do consultório em um instante UTC. */
export function zonedToUtc(day: string, time: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = day.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let result = guess - offsetMs(new Date(guess), tz)
  // Segunda passada cobre mudanças de horário de verão próximas ao instante.
  result = guess - offsetMs(new Date(result), tz)
  return new Date(result)
}

export function todayIn(tz = DEFAULT_TZ) {
  return zonedParts(new Date(), tz).date
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

export function weekdayOf(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function startOfWeek(day: string) {
  // Semana começando na segunda-feira.
  const wd = weekdayOf(day)
  return addDays(day, wd === 0 ? -6 : 1 - wd)
}

export function startOfMonth(day: string) {
  return `${day.slice(0, 7)}-01`
}

export function daysInMonth(day: string) {
  const [y, m] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(day: string, n: number) {
  const [y, m] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + n, 1))
  return dt.toISOString().slice(0, 10)
}

export function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isValidDay(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function isValidTime(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

/* ---------------------------- formatação ---------------------------- */

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export const weekdayName = (i: number) => WEEKDAYS[i]
export const weekdayShort = (i: number) => WEEKDAYS_SHORT[i]
export const monthName = (i: number) => MONTHS[i - 1]

/** 15/10/2026 */
export function fmtDay(day: string | null | undefined) {
  if (!day) return '—'
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

/** quinta-feira, 15 de outubro */
export function fmtDayLong(day: string) {
  const [, m, d] = day.split('-').map(Number)
  return `${WEEKDAYS[weekdayOf(day)]}, ${d} de ${MONTHS[m - 1]}`
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** 15/10/2026 às 14:30 (no fuso do consultório) */
export function fmtDateTime(date: Date, tz = DEFAULT_TZ) {
  const p = zonedParts(date, tz)
  return `${fmtDay(p.date)} às ${p.time}`
}

export function fmtTime(date: Date, tz = DEFAULT_TZ) {
  return zonedParts(date, tz).time
}

export function ageFrom(birth: string | null | undefined, today = todayIn()) {
  if (!birth) return null
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age--
  return age
}
