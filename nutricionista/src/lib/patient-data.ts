import 'server-only'
import { and, asc, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { ChartPoint } from '@/components/LineChart'

/**
 * Consultas compartilhadas entre a área do paciente e o painel.
 * Sempre recebem o patientId já autorizado pelo chamador.
 */

export async function currentPlan(patientId: string) {
  const [plan] = await db
    .select()
    .from(schema.mealPlans)
    .where(and(eq(schema.mealPlans.patientId, patientId), eq(schema.mealPlans.status, 'publicado')))
    .orderBy(desc(schema.mealPlans.publishedAt))
    .limit(1)
  return plan ?? null
}

export async function nextAppointment(patientId: string) {
  const [a] = await db
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.patientId, patientId),
        gte(schema.appointments.startAt, new Date()),
        inArray(schema.appointments.status, ['pendente', 'confirmada']),
      ),
    )
    .orderBy(asc(schema.appointments.startAt))
    .limit(1)
  return a ?? null
}

export async function measurementsOf(patientId: string) {
  return db
    .select()
    .from(schema.measurements)
    .where(eq(schema.measurements.patientId, patientId))
    .orderBy(asc(schema.measurements.date), asc(schema.measurements.createdAt))
}

export async function goalsOf(patientId: string) {
  return db.select().from(schema.goals).where(eq(schema.goals.patientId, patientId)).orderBy(asc(schema.goals.status), desc(schema.goals.createdAt))
}

export async function pendingFormsOf(patientId: string) {
  return db
    .select({ id: schema.formAssignments.id, title: schema.formAssignments.title, dueDate: schema.formAssignments.dueDate })
    .from(schema.formAssignments)
    .where(and(eq(schema.formAssignments.patientId, patientId), isNull(schema.formAssignments.answeredAt)))
    .orderBy(asc(schema.formAssignments.dueDate))
}

type M = typeof schema.measurements.$inferSelect

export const METRICS = {
  weightKg: { label: 'Peso', unit: 'kg' },
  waistCm: { label: 'Cintura', unit: 'cm' },
  hipCm: { label: 'Quadril', unit: 'cm' },
  bodyFatPct: { label: 'Gordura corporal', unit: '%' },
  armCm: { label: 'Braço', unit: 'cm' },
  thighCm: { label: 'Coxa', unit: 'cm' },
  chestCm: { label: 'Tórax', unit: 'cm' },
} as const
export type MetricKey = keyof typeof METRICS

export function series(rows: M[], key: MetricKey): ChartPoint[] {
  return rows.filter((r) => r[key] != null).map((r) => ({ date: r.date, value: Number(r[key]), source: r.source }))
}

/** Último valor de uma métrica, preferindo medição profissional quando houver empate de data. */
export function latest(rows: M[], key: MetricKey) {
  const s = series(rows, key)
  return s.length ? s[s.length - 1] : null
}

/** Progresso (0–100) de uma meta numérica a partir do valor inicial até o alvo. */
export function goalProgress(goal: typeof schema.goals.$inferSelect, rows: M[]) {
  if (goal.status === 'concluida') return 100
  if (!goal.metric || goal.targetValue == null || goal.startValue == null) return null
  const cur = latest(rows, goal.metric as MetricKey)
  if (!cur) return null
  const total = goal.targetValue - goal.startValue
  if (total === 0) return 100
  return Math.max(0, Math.min(100, Math.round(((cur.value - goal.startValue) / total) * 100)))
}

export function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm) return null
  const m = heightCm / 100
  return weightKg / (m * m)
}
