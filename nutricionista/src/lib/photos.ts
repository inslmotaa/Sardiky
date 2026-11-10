import 'server-only'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { deleteUpload, IMAGE_TYPES, saveUpload } from './storage'
import type { ProgressPhoto } from '@/components/nutri/ProgressPhotos'

export const PHOTO_ANGLES = ['frente', 'lado', 'costas'] as const

/**
 * Salva as fotos do corpo enviadas (campos frente, lado, costas) e o conjunto da data. Com o peso do
 * dia, grava a medida (do cliente ou do coach) ligada às fotos. Retorna quantas foram salvas ou o erro.
 */
export async function saveProgressPhotos(
  patientId: string,
  uploaderId: string,
  date: string,
  fd: FormData,
  opts: { weightKg?: number | null; source?: 'paciente' | 'profissional' } = {},
) {
  const files = PHOTO_ANGLES.map((angle) => ({ angle, file: fd.get(angle) })).filter((x): x is { angle: (typeof PHOTO_ANGLES)[number]; file: File } => x.file instanceof File && x.file.size > 0)
  if (files.length === 0) return { error: 'Escolha ao menos uma foto (frente, lado ou costas).' }
  let saved = 0
  for (const { angle, file } of files) {
    const up = await saveUpload(file, IMAGE_TYPES)
    if ('error' in up) return { error: `Foto de ${angle}: ${up.error}` }
    const [f] = await db
      .insert(schema.files)
      .values({ patientId, uploadedBy: uploaderId, kind: 'foto_evolucao', title: `Evolução ${angle} ${date}`, mime: up.mime, size: up.size, storageKey: up.key, visibleToPatient: true })
      .returning({ id: schema.files.id })
    // Uma foto por ângulo e data: enviar de novo substitui.
    const old = await db
      .select()
      .from(schema.progressPhotos)
      .where(and(eq(schema.progressPhotos.patientId, patientId), eq(schema.progressPhotos.date, date), eq(schema.progressPhotos.angle, angle)))
    for (const o of old) await deletePhoto(patientId, o.id)
    await db.insert(schema.progressPhotos).values({ patientId, date, angle, fileId: f.id, createdBy: uploaderId })
    saved++
  }
  let measurementId: string | null = null
  if (opts.weightKg) {
    const [m] = await db
      .insert(schema.measurements)
      .values({ patientId, date, source: opts.source ?? 'paciente', weightKg: opts.weightKg, notes: 'Junto das fotos do corpo', createdBy: uploaderId })
      .returning({ id: schema.measurements.id })
    measurementId = m.id
  }
  await db
    .insert(schema.photoSets)
    .values({ patientId, date, measurementId })
    .onConflictDoUpdate({ target: [schema.photoSets.patientId, schema.photoSets.date], set: measurementId ? { measurementId } : { date } })
  return { saved }
}

export type PhotoSet = { date: string; weightKg: number | null; comment: string | null; commentedAt: string | null }

/** Conjuntos de fotos por data: peso do dia (o ligado às fotos ou o daquela data) e o comentário do coach. */
export async function photoSetsOf(patientId: string): Promise<PhotoSet[]> {
  const photos = await db.select({ date: schema.progressPhotos.date }).from(schema.progressPhotos).where(eq(schema.progressPhotos.patientId, patientId))
  const dates = [...new Set(photos.map((p) => p.date))].sort()
  if (!dates.length) return []
  const [sets, weights] = await Promise.all([
    db.select().from(schema.photoSets).where(and(eq(schema.photoSets.patientId, patientId), inArray(schema.photoSets.date, dates))),
    db
      .select({ id: schema.measurements.id, date: schema.measurements.date, kg: schema.measurements.weightKg })
      .from(schema.measurements)
      .where(and(eq(schema.measurements.patientId, patientId), inArray(schema.measurements.date, dates))),
  ])
  return dates.map((date) => {
    const set = sets.find((x) => x.date === date)
    const linked = set?.measurementId ? weights.find((w) => w.id === set.measurementId) : undefined
    const sameDay = weights.filter((w) => w.date === date && w.kg != null).pop()
    const kg = linked?.kg ?? sameDay?.kg ?? null
    return { date, weightKg: kg != null ? Number(kg) : null, comment: set?.coachComment ?? null, commentedAt: set?.commentedAt?.toISOString() ?? null }
  })
}

/** Comentário do coach num conjunto de fotos (o cliente vê no app). Vazio apaga o comentário. */
export async function setPhotoComment(patientId: string, date: string, comment: string | null, by: string) {
  await db
    .insert(schema.photoSets)
    .values({ patientId, date, coachComment: comment, commentedBy: by, commentedAt: comment ? new Date() : null })
    .onConflictDoUpdate({
      target: [schema.photoSets.patientId, schema.photoSets.date],
      set: { coachComment: comment, commentedBy: by, commentedAt: comment ? new Date() : null },
    })
}

export async function deletePhoto(patientId: string, photoId: string, onlyCreatedBy?: string) {
  const [p] = await db
    .select({ id: schema.progressPhotos.id, fileId: schema.progressPhotos.fileId, createdBy: schema.progressPhotos.createdBy, key: schema.files.storageKey })
    .from(schema.progressPhotos)
    .innerJoin(schema.files, eq(schema.files.id, schema.progressPhotos.fileId))
    .where(and(eq(schema.progressPhotos.id, photoId), eq(schema.progressPhotos.patientId, patientId)))
  if (!p || (onlyCreatedBy && p.createdBy !== onlyCreatedBy)) return false
  await db.delete(schema.files).where(eq(schema.files.id, p.fileId)) // apaga a foto em cascata
  await deleteUpload(p.key)
  return true
}

/** Fotos do corpo. O próprio cliente pode apagar qualquer foto dele (inclusive as enviadas pelo coach). */
export async function photosOf(patientId: string): Promise<ProgressPhoto[]> {
  const rows = await db.select().from(schema.progressPhotos).where(eq(schema.progressPhotos.patientId, patientId)).orderBy(asc(schema.progressPhotos.date))
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    angle: r.angle as ProgressPhoto['angle'],
    url: `/arquivos/${r.fileId}`,
    canDelete: true,
  }))
}
