import 'server-only'
import { and, asc, desc, eq, inArray, isNotNull, isNull, max } from 'drizzle-orm'
import { db, schema } from '@/db'
import { PRIVACY_VERSION } from './constants'
import { ageOn, bmiBand, bmiOf, daysSince, heightOn, missingBodyData, weightChange, type HeightEntry, type WeightPoint } from './corpo'

/** Altura: registros próprios (height_logs) e alturas medidas nas avaliações. */
export async function heightEntries(patientId: string): Promise<(HeightEntry & { source: string })[]> {
  const [logs, evals] = await Promise.all([
    db.select().from(schema.heightLogs).where(eq(schema.heightLogs.patientId, patientId)).orderBy(asc(schema.heightLogs.date), asc(schema.heightLogs.createdAt)),
    db
      .select({ date: schema.measurements.date, heightCm: schema.measurements.heightCm, source: schema.measurements.source })
      .from(schema.measurements)
      .where(and(eq(schema.measurements.patientId, patientId), isNotNull(schema.measurements.heightCm))),
  ])
  return [
    ...logs.map((l) => ({ date: l.date, heightCm: Number(l.heightCm), source: l.source as string })),
    ...evals.map((e) => ({ date: e.date, heightCm: Number(e.heightCm), source: e.source as string })),
  ].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Registra uma altura no histórico e, se for a mais recente, atualiza a altura do cadastro
 * (usada nos cálculos de gasto energético). Mesma data e mesma altura: não repete.
 */
export async function recordHeight(patientId: string, date: string, heightCm: number, source: 'paciente' | 'profissional', createdBy: string | null) {
  const cm = Math.round(heightCm * 10) / 10
  const [same] = await db
    .select({ id: schema.heightLogs.id })
    .from(schema.heightLogs)
    .where(and(eq(schema.heightLogs.patientId, patientId), eq(schema.heightLogs.date, date), eq(schema.heightLogs.heightCm, cm)))
  if (!same) await db.insert(schema.heightLogs).values({ patientId, date, heightCm: cm, source, createdBy })
  const entries = await heightEntries(patientId)
  const newest = entries[entries.length - 1]
  if (!newest || newest.date <= date) await db.update(schema.patients).set({ heightCm: cm, updatedAt: new Date() }).where(eq(schema.patients.id, patientId))
}

export type BodyProfile = Awaited<ReturnType<typeof bodyProfile>>

/** Tudo o que o card "Meu corpo" mostra, calculado na hora (nada de idade ou IMC gravados). */
export async function bodyProfile(patientId: string, today: string) {
  const [[p], weights, heights, [photo]] = await Promise.all([
    db.select({ birthDate: schema.patients.birthDate, sex: schema.patients.sex, heightCm: schema.patients.heightCm }).from(schema.patients).where(eq(schema.patients.id, patientId)),
    db
      .select({ date: schema.measurements.date, value: schema.measurements.weightKg, source: schema.measurements.source })
      .from(schema.measurements)
      .where(and(eq(schema.measurements.patientId, patientId), isNotNull(schema.measurements.weightKg)))
      .orderBy(asc(schema.measurements.date), asc(schema.measurements.createdAt)),
    heightEntries(patientId),
    db.select({ last: max(schema.progressPhotos.date) }).from(schema.progressPhotos).where(eq(schema.progressPhotos.patientId, patientId)),
  ])
  const points: WeightPoint[] = weights.map((w) => ({ date: w.date, value: Number(w.value), source: w.source }))
  const last = points[points.length - 1] ?? null
  const heightCm = heightOn(today, heights, p?.heightCm ?? null)
  const age = ageOn(p?.birthDate, today)
  const bmi = last ? bmiOf(last.value, heightOn(last.date, heights, p?.heightCm ?? null)) : null
  return {
    weight: last,
    heightCm,
    age,
    sex: p?.sex ?? null,
    birthDate: p?.birthDate ?? null,
    bmi,
    band: bmi != null ? bmiBand(bmi, age) : null,
    change: weightChange(points),
    lastPhotoDate: photo?.last ?? null,
    missing: missingBodyData({ birthDate: p?.birthDate ?? null, sex: p?.sex ?? null, heightCm }),
    daysSinceWeight: daysSince(last?.date, today),
    weights: points,
    heights,
  }
}

/** Clientes ativos sem registrar peso há `days` dias ou mais (Acompanhamento do painel). */
export async function withoutWeight(today: string, days = 14, patientIds?: string[]) {
  const rows = await db
    .select({ id: schema.patients.id, name: schema.patients.fullName, phone: schema.patients.phone, features: schema.patients.features, last: max(schema.measurements.date), since: schema.patients.createdAt })
    .from(schema.patients)
    .leftJoin(schema.measurements, and(eq(schema.measurements.patientId, schema.patients.id), isNotNull(schema.measurements.weightKg)))
    .where(and(eq(schema.patients.status, 'ativo'), isNull(schema.patients.anonymizedAt), isNotNull(schema.patients.userId), patientIds ? inArray(schema.patients.id, patientIds.length ? patientIds : ['00000000-0000-0000-0000-000000000000']) : undefined))
    .groupBy(schema.patients.id)
  return rows
    .filter((r) => r.features?.peso !== false)
    .map((r) => ({ id: r.id, name: r.name, phone: r.phone, lastDate: r.last, days: daysSince(r.last ?? r.since.toISOString().slice(0, 10), today) ?? 0 }))
    .filter((r) => r.days >= days)
    .sort((a, b) => b.days - a.days)
}

/* ------------------------------ consentimentos de fotos ------------------------------ */

export const FOTOS_CORPO = 'fotos_corpo'
export const FOTOS_RELATORIO = 'fotos_relatorio'

export async function hasConsent(patientId: string, kind: string) {
  const [c] = await db
    .select({ id: schema.consents.id })
    .from(schema.consents)
    .where(and(eq(schema.consents.patientId, patientId), eq(schema.consents.kind, kind), isNull(schema.consents.revokedAt)))
    .orderBy(desc(schema.consents.grantedAt))
    .limit(1)
  return Boolean(c)
}

export async function setConsent(userId: string, patientId: string, kind: string, on: boolean) {
  if (on) {
    if (!(await hasConsent(patientId, kind))) await db.insert(schema.consents).values({ userId, patientId, kind, version: PRIVACY_VERSION })
  } else {
    await db.update(schema.consents).set({ revokedAt: new Date() }).where(and(eq(schema.consents.patientId, patientId), eq(schema.consents.kind, kind), isNull(schema.consents.revokedAt)))
  }
}
