import 'server-only'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { adherence, classify, daysSince, type AdherenceClass, type AdherenceThresholds } from './acompanhamento'
import { normalizePlan, type PlanContent } from './plan'
import { addDays, zonedParts } from './time'

export type TrackingRow = {
  id: string
  name: string
  objective: string | null
  hasAccess: boolean
  hasPlan: boolean
  pct: number | null
  klass: AdherenceClass
  lastRecord: string | null
  daysWithout: number | null
  weightChange: { kg: number; days: number } | null
  phone: string | null
}

/**
 * Painel de Acompanhamento: pacientes ativos classificados pela adesão dos últimos 7 dias
 * (consultas em lote, sem uma ida ao banco por paciente).
 */
export async function trackingBoard(today: string, tz: string, t: AdherenceThresholds): Promise<TrackingRow[]> {
  const patients = await db
    .select()
    .from(schema.patients)
    .where(and(eq(schema.patients.status, 'ativo'), isNull(schema.patients.anonymizedAt)))
    .orderBy(asc(schema.patients.fullName))
  if (!patients.length) return []
  const ids = patients.map((p) => p.id)
  const from7 = addDays(today, -6)

  const [plans, firstPub, logs, lastLog, lastDiary, lastWater, lastSelf, weights] = await Promise.all([
    db
      .select({ patientId: schema.mealPlans.patientId, content: schema.mealPlans.content, publishedAt: schema.mealPlans.publishedAt })
      .from(schema.mealPlans)
      .where(and(inArray(schema.mealPlans.patientId, ids), eq(schema.mealPlans.status, 'publicado')))
      .orderBy(desc(schema.mealPlans.publishedAt)),
    db
      .select({ patientId: schema.mealPlans.patientId, at: sql<Date>`min(${schema.mealPlans.publishedAt})` })
      .from(schema.mealPlans)
      .where(and(inArray(schema.mealPlans.patientId, ids), isNotNull(schema.mealPlans.publishedAt)))
      .groupBy(schema.mealPlans.patientId),
    db
      .select({ patientId: schema.mealLogs.patientId, date: schema.mealLogs.date, status: schema.mealLogs.status })
      .from(schema.mealLogs)
      .where(and(inArray(schema.mealLogs.patientId, ids), gte(schema.mealLogs.date, from7))),
    db.select({ patientId: schema.mealLogs.patientId, d: max(schema.mealLogs.date) }).from(schema.mealLogs).where(inArray(schema.mealLogs.patientId, ids)).groupBy(schema.mealLogs.patientId),
    db
      .select({ patientId: schema.diaryEntries.patientId, d: max(schema.diaryEntries.date) })
      .from(schema.diaryEntries)
      .where(inArray(schema.diaryEntries.patientId, ids))
      .groupBy(schema.diaryEntries.patientId),
    db
      .select({ patientId: schema.waterLogs.patientId, d: max(schema.waterLogs.date) })
      .from(schema.waterLogs)
      .where(and(inArray(schema.waterLogs.patientId, ids), sql`${schema.waterLogs.ml} > 0`))
      .groupBy(schema.waterLogs.patientId),
    db
      .select({ patientId: schema.measurements.patientId, d: max(schema.measurements.date) })
      .from(schema.measurements)
      .where(and(inArray(schema.measurements.patientId, ids), eq(schema.measurements.source, 'paciente')))
      .groupBy(schema.measurements.patientId),
    db
      .select({ patientId: schema.measurements.patientId, date: schema.measurements.date, kg: schema.measurements.weightKg })
      .from(schema.measurements)
      .where(and(inArray(schema.measurements.patientId, ids), isNotNull(schema.measurements.weightKg), gte(schema.measurements.date, addDays(today, -60))))
      .orderBy(asc(schema.measurements.date), asc(schema.measurements.createdAt)),
  ])

  const planOf = new Map<string, PlanContent>()
  for (const p of plans) if (p.patientId && !planOf.has(p.patientId)) planOf.set(p.patientId, normalizePlan(p.content))
  const startOf = new Map(firstPub.map((r) => [r.patientId!, r.at ? zonedParts(new Date(r.at), tz).date : null]))
  const lastOf = (id: string) =>
    [lastLog, lastDiary, lastWater, lastSelf]
      .map((rows) => rows.find((r) => r.patientId === id)?.d ?? null)
      .filter((d): d is string => !!d)
      .reduce<string | null>((m, d) => (!m || d > m ? d : m), null)

  return patients.map((p) => {
    const plan = planOf.get(p.id) ?? null
    const a = adherence(
      plan,
      logs.filter((l) => l.patientId === p.id),
      from7,
      today,
      startOf.get(p.id),
    )
    const w = weights.filter((x) => x.patientId === p.id && x.kg != null)
    const recent = w[w.length - 1]
    // Variação de peso: último registro × o primeiro dos 30 dias anteriores a ele.
    const base = recent ? w.find((x) => x.date >= addDays(recent.date, -30) && x.date < recent.date) : undefined
    const lastRecord = lastOf(p.id)
    return {
      id: p.id,
      name: p.fullName,
      objective: p.objective,
      hasAccess: !!p.userId,
      hasPlan: !!plan,
      pct: a?.pct ?? null,
      klass: classify(a?.pct ?? null, t),
      lastRecord,
      daysWithout: daysSince(lastRecord, today),
      weightChange: recent && base ? { kg: Math.round((recent.kg! - base.kg!) * 10) / 10, days: daysSince(base.date, recent.date)! } : null,
      phone: p.phone,
    }
  })
}
