/**
 * Lembretes no calendário do celular (.ics): refeições do plano e água, como eventos recorrentes
 * com alarme. Regras puras, testadas em tests/unit/parte5.test.ts.
 *
 * - UID fixo por cliente, tipo e posição ("vaga"): baixar de novo ATUALIZA os eventos em vez de
 *   duplicar; vagas que deixaram de existir saem como canceladas.
 * - Só nome da refeição e horário: nenhum dado de saúde vai para o calendário.
 * - O horário de silêncio vale aqui também.
 */
import { createHash } from 'node:crypto'
import type { NotificationPrefs } from '@/db/schema'
import { dayForWeekday, sortedMeals, type PlanContent } from './plan'
import { inQuietHours } from './quiet'
import { addDays, timeToMinutes, weekdayOf } from './time'
import { foldLine, icsStamp, icsText } from './ics'

export type ReminderSlot = { kind: 'refeicao' | 'agua'; slot: number; title: string; time: string; weekdays: number[] }

/** Vagas fixas por tipo (as que sobram saem canceladas, para limpar horários antigos). */
export const MAX_SLOTS = { refeicao: 10, agua: 16 } as const

const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** Refeições com horário, agrupando os dias da semana em que cada uma acontece no mesmo horário. */
export function mealSlots(plan: PlanContent | null, prefs: Pick<NotificationPrefs, 'quietStart' | 'quietEnd'>): ReminderSlot[] {
  if (!plan) return []
  const map = new Map<string, { title: string; time: string; weekdays: number[] }>()
  for (let wd = 0; wd < 7; wd++) {
    const day = dayForWeekday(plan, wd)
    for (const m of day ? sortedMeals(day) : []) {
      if (!m.time || !/^\d{2}:\d{2}$/.test(m.time) || inQuietHours(prefs, m.time)) continue
      const key = `${m.name.trim()}|${m.time}`
      const cur = map.get(key) ?? { title: m.name.trim(), time: m.time, weekdays: [] }
      if (!cur.weekdays.includes(wd)) cur.weekdays.push(wd)
      map.set(key, cur)
    }
  }
  return [...map.values()]
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))
    .slice(0, MAX_SLOTS.refeicao)
    .map((m, i) => ({ kind: 'refeicao', slot: i + 1, ...m, weekdays: m.weekdays.sort() }))
}

/** Água a cada N horas dentro da janela escolhida, fora do horário de silêncio (o primeiro aviso é um intervalo depois do início). */
export function waterSlots(prefs: Pick<NotificationPrefs, 'waterEveryH' | 'waterStart' | 'waterEnd' | 'quietStart' | 'quietEnd'>): ReminderSlot[] {
  const start = timeToMinutes(prefs.waterStart)
  const end = timeToMinutes(prefs.waterEnd)
  const every = Math.max(1, prefs.waterEveryH) * 60
  const out: ReminderSlot[] = []
  for (let t = start + every; t < end && out.length < MAX_SLOTS.agua; t += every) {
    const time = minutesToTime(t)
    if (inQuietHours(prefs, time)) continue
    out.push({ kind: 'agua', slot: out.length + 1, title: 'Água', time, weekdays: [0, 1, 2, 3, 4, 5, 6] })
  }
  return out
}

/** Resumo dos horários: muda quando o plano ou as preferências mudam (aviso "atualize os lembretes"). */
export function scheduleHash(slots: ReminderSlot[]) {
  const canon = slots.map((s) => `${s.kind}:${s.slot}:${s.title}:${s.time}:${s.weekdays.join('')}`).join(';')
  return createHash('sha256').update(canon).digest('hex').slice(0, 16)
}

/** O que fica guardado do último download: o resumo e quantas vagas de cada tipo ele tinha. */
export const downloadMark = (slots: ReminderSlot[]) =>
  `${scheduleHash(slots)}|r${slots.filter((s) => s.kind === 'refeicao').length}|a${slots.filter((s) => s.kind === 'agua').length}`
export function parseDownloadMark(mark: string | null | undefined) {
  const m = /^([0-9a-f]{16})\|r(\d+)\|a(\d+)$/.exec(mark ?? '')
  return m ? { hash: m[1], refeicao: Number(m[2]), agua: Number(m[3]) } : null
}

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

// Gerador básico do iCalendar (escapar texto, dobrar linhas, data em UTC): src/lib/ics.ts.
export { foldLine, icsText } from './ics'
const stamp = icsStamp
const local = (day: string, time: string) => `${day.replace(/-/g, '')}T${time.replace(':', '')}00`

/** Deslocamento fixo do fuso (ex.: America/Sao_Paulo → -0300), para o VTIMEZONE. */
export function tzOffset(tz: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(at)
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-03:00'
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(raw)
  return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : '+0000'
}

/** Primeiro dia (a partir de hoje) que cai num dos dias da semana do evento. */
function firstDate(today: string, weekdays: number[]) {
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i)
    if (weekdays.includes(weekdayOf(d))) return d
  }
  return today
}

export function remindersIcs(o: {
  slots: ReminderSlot[]
  /** Identificador estável e não pessoal do cliente (ex.: resumo do id). */
  clientKey: string
  appUrl: string
  tz: string
  today: string
  calName: string
  now?: Date
  /**
   * Vagas usadas no último arquivo baixado: as que deixaram de existir saem canceladas, para o
   * celular apagar horários antigos. Na assinatura (webcal) não é preciso: o feed já reflete o atual.
   */
  previous?: { refeicao: number; agua: number }
}): string {
  const now = o.now ?? new Date()
  const off = tzOffset(o.tz, now)
  // SEQUENCE crescente: o calendário aceita a nova versão do mesmo evento.
  const sequence = Math.floor(now.getTime() / 60_000) % 2_000_000_000
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Farion//Lembretes//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(o.calName)}`,
    `X-WR-TIMEZONE:${o.tz}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    'BEGIN:VTIMEZONE',
    `TZID:${o.tz}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    `TZOFFSETFROM:${off}`,
    `TZOFFSETTO:${off}`,
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  const used = new Set(o.slots.map((s) => `${s.kind}-${s.slot}`))
  for (const s of o.slots) {
    const start = firstDate(o.today, s.weekdays)
    const endTime = minutesToTime(Math.min(timeToMinutes(s.time) + 15, 23 * 60 + 59))
    const rrule = s.weekdays.length === 7 ? 'RRULE:FREQ=DAILY' : `RRULE:FREQ=WEEKLY;BYDAY=${s.weekdays.map((d) => BYDAY[d]).join(',')}`
    const title = `${s.title} · ver no app`
    const url = `${o.appUrl}/paciente${s.kind === 'refeicao' ? '/plano' : ''}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${s.kind}-${s.slot}-${o.clientKey}@farion`,
      `SEQUENCE:${sequence}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;TZID=${o.tz}:${local(start, s.time)}`,
      `DTEND;TZID=${o.tz}:${local(start, endTime)}`,
      rrule,
      `SUMMARY:${icsText(title)}`,
      `DESCRIPTION:${icsText(`Veja no app: ${url}`)}`,
      `URL:${url}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsText(title)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  // Vagas que existiam no arquivo anterior e não existem mais: canceladas (limpa horários antigos).
  for (const kind of ['refeicao', 'agua'] as const) {
    for (let n = 1; n <= Math.min(MAX_SLOTS[kind], o.previous?.[kind] ?? 0); n++) {
      if (used.has(`${kind}-${n}`)) continue
      lines.push(
        'BEGIN:VEVENT',
        `UID:${kind}-${n}-${o.clientKey}@farion`,
        `SEQUENCE:${sequence}`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART;TZID=${o.tz}:${local(o.today, '00:00')}`,
        `DTEND;TZID=${o.tz}:${local(o.today, '00:15')}`,
        'STATUS:CANCELLED',
        `SUMMARY:${icsText(kind === 'agua' ? 'Água (removido)' : 'Refeição (removida)')}`,
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Chave estável e não pessoal do cliente para os UIDs (não expõe o id do banco). */
export const clientKeyOf = (userId: string) => createHash('sha256').update(`lembretes:${userId}`).digest('hex').slice(0, 12)
