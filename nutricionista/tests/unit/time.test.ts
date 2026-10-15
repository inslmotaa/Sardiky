import { describe, expect, it } from 'vitest'
import { addDays, addMonths, ageFrom, isValidDay, startOfWeek, zonedParts, zonedToUtc } from '@/lib/time'

describe('fuso horário', () => {
  it('converte horário de Brasília para UTC (UTC-3)', () => {
    expect(zonedToUtc('2026-10-15', '14:30', 'America/Sao_Paulo').toISOString()).toBe('2026-10-15T17:30:00.000Z')
  })
  it('ida e volta preserva data e hora locais', () => {
    const d = zonedToUtc('2026-12-31', '23:45', 'America/Sao_Paulo')
    expect(zonedParts(d, 'America/Sao_Paulo')).toMatchObject({ date: '2026-12-31', time: '23:45' })
  })
  it('funciona em fusos com horário de verão', () => {
    expect(zonedToUtc('2026-07-01', '09:00', 'Europe/Lisbon').toISOString()).toBe('2026-07-01T08:00:00.000Z')
  })
})

describe('datas de calendário', () => {
  it('soma dias e meses atravessando limites', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01')
  })
  it('semana começa na segunda-feira', () => {
    expect(startOfWeek('2026-10-15')).toBe('2026-10-12')
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12') // domingo
  })
  it('valida datas reais', () => {
    expect(isValidDay('2026-02-29')).toBe(false)
    expect(isValidDay('2028-02-29')).toBe(true)
    expect(isValidDay('15/10/2026')).toBe(false)
  })
  it('calcula idade considerando o aniversário', () => {
    expect(ageFrom('1990-10-16', '2026-10-15')).toBe(35)
    expect(ageFrom('1990-10-15', '2026-10-15')).toBe(36)
  })
})
