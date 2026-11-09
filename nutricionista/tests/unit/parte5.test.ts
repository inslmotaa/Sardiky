import { describe, expect, it } from 'vitest'
import { chatChannels, waClienteText, WA_CLIENTE_PADRAO } from '@/lib/chat-mode'
import { daysLeftInMonth, emailLimits, podeEnviar, quaseNoLimite } from '@/lib/email-cota'
import { clientKeyOf, downloadMark, foldLine, icsText, mealSlots, parseDownloadMark, remindersIcs, scheduleHash, tzOffset, waterSlots } from '@/lib/lembretes-ics'
import { inQuietHours, mealPushDue } from '@/lib/quiet'
import { DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import type { PlanContent } from '@/lib/plan'

/** Parte 5: conversa pelo WhatsApp e lembretes gratuitos. */

describe('Chat do app ou WhatsApp', () => {
  const base = { globalMode: 'ambos', patientMode: null, chatFeature: true, whatsapp: '5541991551789' }
  it('padrão: os dois', () => expect(chatChannels(base)).toMatchObject({ mode: 'ambos', app: true, whatsapp: true, any: true }))
  it('a ficha do cliente vale sobre o padrão', () => {
    expect(chatChannels({ ...base, patientMode: 'whatsapp' })).toMatchObject({ app: false, whatsapp: true })
    expect(chatChannels({ ...base, globalMode: 'app' })).toMatchObject({ app: true, whatsapp: false })
    expect(chatChannels({ ...base, globalMode: 'app', patientMode: 'ambos' })).toMatchObject({ app: true, whatsapp: true })
  })
  it('sem número válido, nada de WhatsApp; sem o recurso Mensagens, nada de chat', () => {
    expect(chatChannels({ ...base, whatsapp: '' })).toMatchObject({ whatsapp: false, app: true })
    expect(chatChannels({ ...base, chatFeature: false, globalMode: 'app' })).toMatchObject({ any: false })
  })
  it('texto pronto do cliente', () => {
    expect(WA_CLIENTE_PADRAO).toBe('Oi, {coach}! Aqui é {nome}, cliente da consultoria. ')
    expect(waClienteText(null, { nome: 'Beatriz', coach: 'André' })).toBe('Oi, André! Aqui é Beatriz, cliente da consultoria. ')
    expect(waClienteText('Olá {coach}, sou {nome}', { nome: 'Bia', coach: 'André' })).toBe('Olá André, sou Bia')
  })
})

describe('Cota gratuita de e-mail (Resend: 100/dia, 3.000/mês)', () => {
  const L = emailLimits({})
  const mid = new Date('2026-11-10T12:00:00Z') // 21 dias até o fim do mês
  it('limites padrão e configuráveis', () => {
    expect(L).toEqual({ day: 100, month: 3000, reserve: 40 })
    expect(emailLimits({ EMAIL_DAILY_LIMIT: '500', EMAIL_MONTHLY_LIMIT: 'x' })).toEqual({ day: 500, month: 3000, reserve: 40 })
    expect(daysLeftInMonth(mid)).toBe(21)
  })
  it('essenciais até 100 por dia; resumos só até 60 (reserva de 40)', () => {
    expect(podeEnviar('resumo', { day: 59, month: 100 }, L, mid)).toBe(true)
    expect(podeEnviar('resumo', { day: 60, month: 100 }, L, mid)).toBe(false)
    expect(podeEnviar('essencial', { day: 60, month: 100 }, L, mid)).toBe(true)
    expect(podeEnviar('essencial', { day: 99, month: 100 }, L, mid)).toBe(true)
    expect(podeEnviar('essencial', { day: 100, month: 100 }, L, mid)).toBe(false)
  })
  it('no mês, o resumo para antes de comer a reserva dos dias que faltam', () => {
    // 3.000 − 40 × 21 = 2.160
    expect(podeEnviar('resumo', { day: 0, month: 2159 }, L, mid)).toBe(true)
    expect(podeEnviar('resumo', { day: 0, month: 2160 }, L, mid)).toBe(false)
    expect(podeEnviar('essencial', { day: 0, month: 2999 }, L, mid)).toBe(true)
    expect(podeEnviar('essencial', { day: 0, month: 3000 }, L, mid)).toBe(false)
  })
  it('aviso de "quase no limite"', () => {
    expect(quaseNoLimite({ day: 10, month: 100 }, L, mid)).toBe(false)
    expect(quaseNoLimite({ day: 80, month: 100 }, L, mid)).toBe(true)
    expect(quaseNoLimite({ day: 60, month: 100 }, L, mid)).toBe(true) // resumo já pausado
  })
})

describe('Horário de silêncio e push da refeição', () => {
  const quiet = { quietStart: '22:00', quietEnd: '07:00' }
  it('silêncio atravessando a meia-noite', () => {
    expect(inQuietHours(quiet, '23:30')).toBe(true)
    expect(inQuietHours(quiet, '06:59')).toBe(true)
    expect(inQuietHours(quiet, '07:00')).toBe(false)
  })
  it('refeição marcada não gera push; fora da janela ou no silêncio também não', () => {
    expect(mealPushDue({ now: '12:05', mealTime: '12:00', alreadyLogged: false, quiet })).toBe(true)
    expect(mealPushDue({ now: '12:05', mealTime: '12:00', alreadyLogged: true, quiet })).toBe(false)
    expect(mealPushDue({ now: '11:59', mealTime: '12:00', alreadyLogged: false, quiet })).toBe(false)
    expect(mealPushDue({ now: '12:15', mealTime: '12:00', alreadyLogged: false, quiet })).toBe(false)
    expect(mealPushDue({ now: '22:30', mealTime: '22:30', alreadyLogged: false, quiet })).toBe(false)
  })
})

const plan = {
  v: 2,
  mode: 'calculado',
  targets: { kcal: null, protein: null, carbs: null, fat: null, fiber: null },
  days: [
    {
      id: 'treino',
      label: 'Treino',
      weekdays: [1, 3, 5],
      meals: [
        { id: 'a', name: 'Café da manhã', time: '07:00', options: [] },
        { id: 'b', name: 'Almoço', time: '12:30', options: [] },
        { id: 'c', name: 'Ceia', time: '22:30', options: [] },
      ],
    },
    {
      id: 'descanso',
      label: 'Descanso',
      weekdays: [0, 2, 4, 6],
      meals: [
        { id: 'a', name: 'Café da manhã', time: '08:00', options: [] },
        { id: 'b', name: 'Almoço', time: '12:30', options: [] },
      ],
    },
  ],
} as unknown as PlanContent

describe('Lembretes no calendário (.ics)', () => {
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS }
  const meals = mealSlots(plan, prefs)
  const water = waterSlots(prefs)
  const slots = [...meals, ...water]
  const ics = remindersIcs({ slots, clientKey: clientKeyOf('u1'), appUrl: 'https://farion.com.br', tz: 'America/Sao_Paulo', today: '2026-11-09', calName: 'Lembretes · Farion', now: new Date('2026-11-09T15:00:00Z') })

  it('refeições agrupadas por horário e dias; ceia no horário de silêncio fica de fora', () => {
    expect(meals.map((m) => `${m.title} ${m.time} ${m.weekdays.join('')}`)).toEqual(['Café da manhã 07:00 135', 'Café da manhã 08:00 0246', 'Almoço 12:30 0123456'])
  })
  it('água a cada 2 h dentro da janela, sem o horário de silêncio', () => {
    expect(water.map((w) => w.time)).toEqual(['10:00', '12:00', '14:00', '16:00', '18:00'])
    expect(waterSlots({ ...prefs, waterStart: '20:00', waterEnd: '23:59', waterEveryH: 1 }).map((w) => w.time)).toEqual(['21:00'])
  })
  it('iCalendar válido: CRLF, linhas ≤ 75 octetos, VTIMEZONE, RRULE e alarme', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75)
    expect(ics).toContain('TZID:America/Sao_Paulo')
    expect(ics).toContain(`TZOFFSETTO:${tzOffset('America/Sao_Paulo')}`)
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(slots.length)
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(ics.match(/END:VEVENT/g)!.length)
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('SUMMARY:Almoço · ver no app')
    expect(ics).toContain('URL:https://farion.com.br/paciente/plano')
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20261109T123000')
    expect(ics).toContain('DTSTART;TZID=America/Sao_Paulo:20261109T070000') // segunda-feira, dia de treino
    expect(ics.match(/BEGIN:VALARM/g)!.length).toBe(slots.length)
    expect(ics).not.toMatch(/kcal|prote|peso|kg/i)
  })
  it('UID fixo por cliente e vaga: baixar de novo não duplica', () => {
    const again = remindersIcs({ slots, clientKey: clientKeyOf('u1'), appUrl: 'https://farion.com.br', tz: 'America/Sao_Paulo', today: '2026-11-12', calName: 'x', now: new Date('2026-11-12T15:00:00Z') })
    const uids = (t: string) => [...t.matchAll(/^UID:(.+)$/gm)].map((m) => m[1]).sort()
    expect(uids(again)).toEqual(uids(ics))
    expect(new Set(uids(ics)).size).toBe(uids(ics).length)
    const seq = (t: string) => Number(/SEQUENCE:(\d+)/.exec(t)![1])
    expect(seq(again)).toBeGreaterThan(seq(ics))
    expect(uids(ics)[0]).not.toContain('u1') // não expõe o id
  })
  it('vagas que deixaram de existir saem canceladas no novo download', () => {
    const fewer = remindersIcs({ slots: meals, clientKey: 'k', appUrl: 'https://x', tz: 'America/Sao_Paulo', today: '2026-11-09', calName: 'x', previous: { refeicao: 3, agua: 5 } })
    expect(fewer.match(/STATUS:CANCELLED/g)!.length).toBe(5)
    expect(fewer).toContain('UID:agua-1-k@farion')
  })
  it('resumo dos horários muda quando o plano muda', () => {
    const mark = downloadMark(slots)
    expect(parseDownloadMark(mark)).toEqual({ hash: scheduleHash(slots), refeicao: 3, agua: 5 })
    expect(scheduleHash(slots)).not.toBe(scheduleHash(slots.slice(1)))
    expect(parseDownloadMark('lixo')).toBeNull()
  })
  it('texto escapado e linhas dobradas sem partir acentos', () => {
    expect(icsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne')
    const long = foldLine(`DESCRIPTION:${'ação '.repeat(30)}`)
    for (const l of long.split('\r\n')) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75)
    expect(long.replace(/\r\n /g, '')).toBe(`DESCRIPTION:${'ação '.repeat(30)}`)
  })
})
