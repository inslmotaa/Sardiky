import { describe, expect, it } from 'vitest'
import { availableSlots, fitsWorkingHours, overlaps } from '@/lib/scheduling'
import { zonedParts, zonedToUtc } from '@/lib/time'

const TZ = 'America/Sao_Paulo'
const windows = [
  { weekday: 1, start: '08:00', end: '12:00' },
  { weekday: 1, start: '14:00', end: '18:00' },
]
const monday = '2026-11-16' // segunda-feira
const base = {
  day: monday,
  durationMinutes: 60,
  stepMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 0,
  maxDaysAhead: 60,
  windows,
  busy: [],
  now: new Date('2026-11-10T12:00:00Z'),
  tz: TZ,
}
const times = (slots: Date[]) => slots.map((d) => zonedParts(d, TZ).time)

describe('availableSlots', () => {
  it('oferece horários que cabem inteiros no expediente', () => {
    const t = times(availableSlots(base))
    expect(t[0]).toBe('08:00')
    expect(t).toContain('11:00')
    expect(t).not.toContain('11:30') // terminaria 12:30, fora da janela
    expect(t).toContain('14:00')
    expect(t[t.length - 1]).toBe('17:00')
  })

  it('não oferece horários em dias sem expediente', () => {
    expect(availableSlots({ ...base, day: '2026-11-15' })).toEqual([]) // domingo
  })

  it('bloqueia horários que conflitam com consultas e bloqueios', () => {
    const busy = [{ start: zonedToUtc(monday, '09:00', TZ), end: zonedToUtc(monday, '10:00', TZ) }]
    const t = times(availableSlots({ ...base, busy }))
    expect(t).not.toContain('08:30')
    expect(t).not.toContain('09:00')
    expect(t).not.toContain('09:30')
    expect(t).toContain('08:00')
    expect(t).toContain('10:00')
  })

  it('respeita a folga entre consultas', () => {
    const busy = [{ start: zonedToUtc(monday, '09:00', TZ), end: zonedToUtc(monday, '10:00', TZ) }]
    const t = times(availableSlots({ ...base, busy, bufferMinutes: 15 }))
    expect(t).not.toContain('08:00') // terminaria 09:00, sem os 15 min de folga
    expect(t).not.toContain('10:00')
    expect(t).toContain('10:30')
  })

  it('respeita antecedência mínima e limite de dias', () => {
    const now = zonedToUtc(monday, '10:10', TZ)
    const t = times(availableSlots({ ...base, now, minNoticeHours: 2 }))
    expect(t[0]).toBe('14:00')
    expect(availableSlots({ ...base, maxDaysAhead: 3 })).toEqual([])
  })
})

describe('overlaps / fitsWorkingHours', () => {
  it('intervalos encostados não conflitam', () => {
    const a = { start: new Date('2026-01-01T10:00Z'), end: new Date('2026-01-01T11:00Z') }
    const b = { start: new Date('2026-01-01T11:00Z'), end: new Date('2026-01-01T12:00Z') }
    expect(overlaps(a, b)).toBe(false)
    expect(overlaps(a, { ...b, start: new Date('2026-01-01T10:59Z') })).toBe(true)
  })
  it('verifica se a consulta cabe no expediente', () => {
    expect(fitsWorkingHours(monday, '11:00', 60, windows)).toBe(true)
    expect(fitsWorkingHours(monday, '11:30', 60, windows)).toBe(false)
    expect(fitsWorkingHours(monday, '12:30', 30, windows)).toBe(false)
  })
})
