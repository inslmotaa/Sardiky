import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { deleteUpload, IMAGE_TYPES, saveUpload } from './storage'
import type { ProgressPhoto } from '@/components/nutri/ProgressPhotos'

export const PHOTO_ANGLES = ['frente', 'lado', 'costas'] as const

/** Salva as fotos de evolução enviadas (campos frente, lado, costas). Retorna quantas foram salvas ou o erro. */
export async function saveProgressPhotos(patientId: string, uploaderId: string, date: string, fd: FormData) {
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
  return { saved }
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

export async function photosOf(patientId: string, viewerId: string, viewerIsTeam: boolean): Promise<ProgressPhoto[]> {
  const rows = await db.select().from(schema.progressPhotos).where(eq(schema.progressPhotos.patientId, patientId)).orderBy(asc(schema.progressPhotos.date))
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    angle: r.angle as ProgressPhoto['angle'],
    url: `/arquivos/${r.fileId}`,
    canDelete: viewerIsTeam || r.createdBy === viewerId,
  }))
}
