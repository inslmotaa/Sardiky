import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { bmiOf, bmiSeries, heightOn, weightChange, weightChangeSince, type WeightPoint } from './corpo'
import { heightEntries } from './corpo-server'
import { photoSetsOf } from './photos'
import { METRICS, type MetricKey } from './patient-data'
import type { ChartPoint } from '@/components/LineChart'

export type TimelineItem =
  | { kind: 'peso'; text: string }
  | { kind: 'imc'; text: string }
  | { kind: 'medidas'; text: string }
  | { kind: 'altura'; text: string }
  | { kind: 'fotos'; text: string; thumbs: string[]; comment: string | null }
  | { kind: 'checkin'; text: string }

export type EvolutionData = Awaited<ReturnType<typeof evolutionData>>

const n1 = (v: number) => v.toFixed(1).replace('.', ',')
const MEASURE_KEYS: MetricKey[] = ['waistCm', 'hipCm', 'abdomenCm', 'armCm', 'thighCm', 'chestCm', 'calfCm', 'bodyFatPct', 'leanMassKg']

/**
 * Evolução em um só lugar (app → Progresso e ficha → Avaliações e evolução): peso, IMC com a altura
 * vigente em cada data, medidas, fotos do corpo e check-ins por data, mais o resumo e as metas.
 */
export async function evolutionData(patientId: string, today: string) {
  const [[p], rows, heights, sets, photos, checkins, goals] = await Promise.all([
    db.select({ heightCm: schema.patients.heightCm }).from(schema.patients).where(eq(schema.patients.id, patientId)),
    db.select().from(schema.measurements).where(eq(schema.measurements.patientId, patientId)).orderBy(asc(schema.measurements.date), asc(schema.measurements.createdAt)),
    heightEntries(patientId),
    photoSetsOf(patientId),
    db.select().from(schema.progressPhotos).where(eq(schema.progressPhotos.patientId, patientId)).orderBy(asc(schema.progressPhotos.date)),
    db
      .select()
      .from(schema.checkins)
      .where(and(eq(schema.checkins.patientId, patientId), eq(schema.checkins.status, 'enviado')))
      .orderBy(asc(schema.checkins.dueDate)),
    db.select().from(schema.goals).where(and(eq(schema.goals.patientId, patientId), eq(schema.goals.status, 'ativa'))),
  ])
  const fallback = p?.heightCm ?? null
  const weights: ChartPoint[] = rows.filter((r) => r.weightKg != null).map((r) => ({ date: r.date, value: Number(r.weightKg), source: r.source }))
  const wp: WeightPoint[] = weights.map((w) => ({ date: w.date, value: w.value, source: w.source }))
  const bmis: ChartPoint[] = bmiSeries(wp, heights, fallback).map((b) => ({ date: b.date, value: b.value, source: (b.source as ChartPoint['source']) ?? 'paciente' }))
  const weightGoal = goals.find((g) => g.metric === 'weightKg')?.targetValue ?? null
  const currentHeight = heightOn(today, heights, fallback)
  const bmiGoal = weightGoal != null ? bmiOf(Number(weightGoal), currentHeight) : null

  // Linha do tempo: tudo por data, da mais recente para a mais antiga.
  const byDate = new Map<string, TimelineItem[]>()
  const add = (date: string, item: TimelineItem) => byDate.set(date, [...(byDate.get(date) ?? []), item])
  for (const r of rows) {
    if (r.weightKg != null) {
      add(r.date, { kind: 'peso', text: `${n1(Number(r.weightKg))} kg · ${r.source === 'profissional' ? 'medido pelo coach' : 'informado pelo cliente'}` })
      const b = bmiOf(Number(r.weightKg), heightOn(r.date, heights, fallback))
      if (b != null) add(r.date, { kind: 'imc', text: `${n1(b)} (altura de ${(heightOn(r.date, heights, fallback)! / 100).toFixed(2).replace('.', ',')} m)` })
    }
    const measures = MEASURE_KEYS.filter((k) => r[k] != null).map((k) => `${METRICS[k].label} ${n1(Number(r[k]))} ${METRICS[k].unit}`)
    if (measures.length) add(r.date, { kind: 'medidas', text: measures.join(' · ') })
  }
  for (const h of heights.filter((h, i) => i === 0 || h.heightCm !== heights[i - 1].heightCm)) add(h.date, { kind: 'altura', text: `${n1(h.heightCm)} cm` })
  for (const s of sets) {
    const ps = photos.filter((x) => x.date === s.date)
    add(s.date, {
      kind: 'fotos',
      text: `${ps.length} ${ps.length === 1 ? 'foto' : 'fotos'} do corpo (${ps.map((x) => x.angle).join(', ')})`,
      thumbs: ps.map((x) => `/arquivos/${x.fileId}`),
      comment: s.comment,
    })
  }
  for (const c of checkins) {
    const date = c.submittedAt ? c.submittedAt.toISOString().slice(0, 10) : c.dueDate
    const parts = [c.answers.adesao ? `seguiu o plano ${c.answers.adesao}/5` : null, c.answers.sono ? `sono ${c.answers.sono}/5` : null, c.weightKg != null ? `${n1(Number(c.weightKg))} kg` : null].filter(Boolean)
    add(date, { kind: 'checkin', text: `Check-in${parts.length ? `: ${parts.join(' · ')}` : ''}${c.coachNote ? ` · coach: “${c.coachNote}”` : ''}` })
  }
  const timeline = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([date, items]) => ({ date, items }))

  const last30 = weightChangeSince(wp, today, 30)
  return {
    weights,
    bmis,
    weightGoal: weightGoal != null ? Number(weightGoal) : null,
    bmiGoal,
    summary: {
      sinceStart: weightChange(wp),
      last30,
      lastWeight: weights[weights.length - 1] ?? null,
      lastBmi: bmis[bmis.length - 1] ?? null,
      photoSets: sets.length,
      checkins: checkins.length,
    },
    timeline,
    rows,
    heights,
    sets,
    photos,
  }
}
