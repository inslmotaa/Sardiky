import 'server-only'
import { and, asc, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { consumedOn, dayForWeekday, normalizePlan, optionTotals, sortedMeals, type PlanContent } from './plan'
import { currentPublishedPlan } from './patient-context'
import { sum, ZERO } from './nutricao'
import { addDays, weekdayOf, zonedParts } from './time'
import { adherence, classify, streak, weeklyAdherence, type AdherenceThresholds } from './acompanhamento'
import type { DiaryEntryView, DiaryMeal } from '@/components/nutri/DiaryDay'

type Entry = typeof schema.diaryEntries.$inferSelect

export function entryView(e: Entry): DiaryEntryView {
  return {
    id: e.id,
    time: e.time,
    meal: e.meal,
    foods: e.foods,
    choice: e.adherence,
    items: e.items ?? [],
    hunger: e.hunger,
    satiety: e.satiety,
    mood: e.mood,
    notes: e.notes,
    photoUrl: e.photoFileId ? `/arquivos/${e.photoFileId}` : null,
    comment: e.professionalComment,
  }
}

/** Planos citados pelos registros (para calcular o consumo de dias passados com a versão da época). */
export async function plansById(ids: string[]) {
  const map = new Map<string, PlanContent>()
  const uniq = [...new Set(ids)]
  if (!uniq.length) return map
  const rows = await db.select({ id: schema.mealPlans.id, content: schema.mealPlans.content }).from(schema.mealPlans).where(inArray(schema.mealPlans.id, uniq))
  for (const r of rows) map.set(r.id, normalizePlan(r.content))
  return map
}

/**
 * Um dia do diário: refeições do plano com o registro de cada uma, registros fora do plano,
 * consumo × planejado e um resumo dos dias anteriores. Recebe o patientId já autorizado.
 */
export async function loadDiaryDay(patientId: string, date: string, historyDays = 14) {
  const from = addDays(date, -(historyDays - 1))
  const [plan, logs, entries] = await Promise.all([
    currentPublishedPlan(patientId),
    db
      .select()
      .from(schema.mealLogs)
      .where(and(eq(schema.mealLogs.patientId, patientId), gte(schema.mealLogs.date, from), lte(schema.mealLogs.date, date))),
    db
      .select()
      .from(schema.diaryEntries)
      .where(and(eq(schema.diaryEntries.patientId, patientId), gte(schema.diaryEntries.date, from), lte(schema.diaryEntries.date, date))),
  ])
  const content = plan ? normalizePlan(plan.content) : null
  const day = content ? dayForWeekday(content, weekdayOf(date)) : null
  const dayLogs = logs.filter((l) => l.date === date)
  const dayEntries = entries.filter((e) => e.date === date).sort((a, b) => a.time.localeCompare(b.time))
  const calc = content?.mode === 'calculado'

  const meals: DiaryMeal[] = day
    ? sortedMeals(day).map((m) => {
        const key = `${day.id}:${m.id}`
        const log = dayLogs.find((l) => l.mealKey === key)
        const opt = m.options.find((o) => o.id === log?.optionId) ?? m.options[0]
        const entry = dayEntries.find((e) => e.mealKey === key)
        return {
          key,
          name: m.name,
          time: m.time,
          optionId: opt?.id ?? null,
          summary: (opt?.items ?? []).map((i) => i.name.split(',')[0]).join(' · '),
          planned: calc && opt ? optionTotals(opt) : null,
          entry: entry ? entryView(entry) : log ? statusOnlyEntry(log, m.name) : null,
        }
      })
    : []
  const mealKeys = new Set(meals.map((m) => m.key))
  const extras = dayEntries.filter((e) => !e.mealKey || !mealKeys.has(e.mealKey)).map(entryView)

  const plans = await plansById(logs.map((l) => l.planId).filter((v): v is string => !!v))
  const consumed = consumedOn(plans, dayLogs, dayEntries)
  const planned = calc && day ? sum(sortedMeals(day).map((m) => optionTotals(m.options[0]))) : null

  const history = Array.from({ length: historyDays }, (_, i) => addDays(date, -i)).map((d) => {
    const l = logs.filter((x) => x.date === d)
    const e = entries.filter((x) => x.date === d)
    return { date: d, records: new Set([...l.map((x) => x.mealKey), ...e.map((x) => x.id)]).size, kcal: l.length || e.length ? consumedOn(plans, l, e).kcal : 0 }
  })

  return { plan, content, day, meals, extras, consumed: consumed ?? ZERO, planned, history, targets: content?.targets ?? null }
}

/** Refeição marcada só pela tela Hoje (sem detalhes): aparece no diário como registro simples. */
function statusOnlyEntry(log: typeof schema.mealLogs.$inferSelect, meal: string): DiaryEntryView | null {
  const choice = log.status === 'feita' ? 'total' : log.status === 'parcial' ? 'parcial' : log.status === 'outra' ? 'nao_seguiu' : null
  if (!choice) return null
  return { id: `log-${log.id}`, time: '', meal, foods: choice === 'total' ? 'Marcada como feita na tela Hoje' : choice === 'parcial' ? 'Marcada como parcial na tela Hoje' : 'Comi outra coisa', choice, items: [], hunger: null, satiety: null, mood: null, notes: null, photoUrl: null, comment: null }
}

/** Início do acompanhamento pelo app: primeira publicação de plano do paciente (data local). */
export async function planStartDate(patientId: string, tz: string) {
  const rows = await db
    .select({ at: schema.mealPlans.publishedAt })
    .from(schema.mealPlans)
    .where(and(eq(schema.mealPlans.patientId, patientId), isNotNull(schema.mealPlans.publishedAt)))
    .orderBy(asc(schema.mealPlans.publishedAt))
    .limit(1)
  return rows[0]?.at ? zonedParts(rows[0].at, tz).date : null
}

/**
 * Resumo de adesão de um paciente: % de refeições feitas nos últimos 7 dias, classificação,
 * sequência de dias registrando, último registro e adesão semana a semana.
 */
export async function adherenceSummary(patientId: string, today: string, tz: string, thresholds: AdherenceThresholds, weeks = 6) {
  const from = addDays(today, -(weeks * 7 - 1))
  const [plan, start, logs, entries, water] = await Promise.all([
    currentPublishedPlan(patientId),
    planStartDate(patientId, tz),
    db
      .select({ date: schema.mealLogs.date, status: schema.mealLogs.status })
      .from(schema.mealLogs)
      .where(and(eq(schema.mealLogs.patientId, patientId), gte(schema.mealLogs.date, from))),
    db
      .select({ date: schema.diaryEntries.date })
      .from(schema.diaryEntries)
      .where(and(eq(schema.diaryEntries.patientId, patientId), gte(schema.diaryEntries.date, from))),
    db
      .select({ date: schema.waterLogs.date, ml: schema.waterLogs.ml })
      .from(schema.waterLogs)
      .where(and(eq(schema.waterLogs.patientId, patientId), gte(schema.waterLogs.date, from))),
  ])
  const content = plan ? normalizePlan(plan.content) : null
  // Dias completos: hoje fica de fora porque as refeições do dia ainda podem acontecer.
  const a7 = adherence(content, logs, addDays(today, -7), addDays(today, -1), start)
  const recordDates = [...logs.map((l) => l.date), ...entries.map((e) => e.date), ...water.filter((w) => w.ml > 0).map((w) => w.date)]
  const lastRecord = recordDates.length ? recordDates.reduce((m, d) => (d > m ? d : m)) : null
  return {
    hasPlan: !!content,
    pct7: a7?.pct ?? null,
    klass: classify(a7?.pct ?? null, thresholds),
    streak: streak(recordDates, today),
    lastRecord,
    weekly: weeklyAdherence(content, logs, addDays(today, -1), weeks, start),
  }
}
