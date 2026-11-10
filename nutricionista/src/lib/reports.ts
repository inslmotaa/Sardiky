import 'server-only'
import { and, asc, count, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { db, schema } from '@/db'

export type Range = { from: string; to: string; tz: string } // to = exclusivo

export async function patientsByStatus() {
  return db.select({ status: schema.patients.status, n: count() }).from(schema.patients).where(isNull(schema.patients.anonymizedAt)).groupBy(schema.patients.status)
}

/** Variação de peso entre a primeira e a última medição profissional de cada paciente ativo. */
export async function weightEvolution() {
  const rows = await db.execute<{ id: string; name: string; first_date: string; first_w: number; last_date: string; last_w: number; n: number }>(sql`
    select p.id, p.full_name as name,
      (array_agg(m.date order by m.date asc))[1] as first_date,
      (array_agg(m.weight_kg order by m.date asc))[1]::float as first_w,
      (array_agg(m.date order by m.date desc))[1] as last_date,
      (array_agg(m.weight_kg order by m.date desc))[1]::float as last_w,
      count(*)::int as n
    from measurements m join patients p on p.id = m.patient_id
    where m.source = 'profissional' and m.weight_kg is not null and p.status = 'ativo' and p.anonymized_at is null
    group by p.id, p.full_name
    having count(*) >= 2
    order by p.full_name`)
  // postgres-js devolve array; PGlite devolve { rows }.
  return (Array.isArray(rows) ? rows : (rows as unknown as { rows: typeof rows }).rows) as unknown as {
    id: string
    name: string
    first_date: string
    first_w: number
    last_date: string
    last_w: number
    n: number
  }[]
}

export async function paymentsInRange(r: Range) {
  return db
    .select({ pay: schema.payments, name: schema.patients.fullName })
    .from(schema.payments)
    .leftJoin(schema.patients, eq(schema.patients.id, schema.payments.patientId))
    .where(and(eq(schema.payments.status, 'pago'), gte(schema.payments.paidAt, r.from), lt(schema.payments.paidAt, r.to)))
    .orderBy(asc(schema.payments.paidAt))
}

export { csvCell, toCsv } from './csv'
