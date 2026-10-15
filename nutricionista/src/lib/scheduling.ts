import { addDays, timeToMinutes, weekdayOf, zonedToUtc, DEFAULT_TZ } from './time'

export type Interval = { start: Date; end: Date }
export type WorkingWindow = { weekday: number; start: string; end: string }

export type SlotOptions = {
  day: string
  durationMinutes: number
  stepMinutes: number
  bufferMinutes: number
  minNoticeHours: number
  maxDaysAhead: number
  windows: WorkingWindow[]
  busy: Interval[]
  now: Date
  tz?: string
}

/** Status de consulta que ocupam a agenda. */
export const BLOCKING_STATUSES = ['pendente', 'confirmada'] as const

export function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end
}

/** Expande um intervalo ocupado com a folga configurada entre consultas. */
export function withBuffer(i: Interval, bufferMinutes: number): Interval {
  const ms = bufferMinutes * 60_000
  return { start: new Date(i.start.getTime() - ms), end: new Date(i.end.getTime() + ms) }
}

/**
 * Lista os horários livres de um dia. Regras:
 * - o atendimento precisa caber inteiro numa janela de expediente;
 * - não pode sobrepor consultas ativas ou bloqueios (considerando a folga);
 * - respeita a antecedência mínima e o limite de dias à frente.
 */
export function availableSlots(o: SlotOptions): Date[] {
  const tz = o.tz ?? DEFAULT_TZ
  const today = zonedToUtc(o.day, '00:00', tz)
  const lastDay = zonedToUtc(addDays(dayOf(o.now, tz), o.maxDaysAhead + 1), '00:00', tz)
  if (today >= lastDay) return []
  const earliest = new Date(o.now.getTime() + o.minNoticeHours * 3_600_000)
  const weekday = weekdayOf(o.day)
  const busy = o.busy.map((b) => withBuffer(b, o.bufferMinutes))
  const slots: Date[] = []
  const windows = o.windows.filter((w) => w.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start))
  for (const w of windows) {
    const startMin = timeToMinutes(w.start)
    const endMin = timeToMinutes(w.end)
    for (let m = startMin; m + o.durationMinutes <= endMin; m += o.stepMinutes) {
      const start = zonedToUtc(o.day, minutesStr(m), tz)
      const end = new Date(start.getTime() + o.durationMinutes * 60_000)
      if (start < earliest) continue
      if (busy.some((b) => overlaps({ start, end }, b))) continue
      slots.push(start)
    }
  }
  return slots
}

/** Verifica se um intervalo cabe no expediente (usado ao remarcar pelo painel). */
export function fitsWorkingHours(day: string, startTime: string, durationMinutes: number, windows: WorkingWindow[]) {
  const wd = weekdayOf(day)
  const s = timeToMinutes(startTime)
  const e = s + durationMinutes
  return windows.some((w) => w.weekday === wd && timeToMinutes(w.start) <= s && e <= timeToMinutes(w.end))
}

function minutesStr(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function dayOf(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  return f.format(d)
}
