import 'server-only'
import { mkdir, statfs } from 'node:fs/promises'
import { count, sum } from 'drizzle-orm'
import { db, schema } from '@/db'
import { uploadRoot } from './storage'

const KIND_LABEL: Record<string, string> = {
  foto_evolucao: 'Fotos do corpo',
  foto_refeicao: 'Fotos dos pratos',
  checkin: 'Fotos dos check-ins',
  documento: 'Documentos e exames',
  chat: 'Anexos do chat',
  material: 'Materiais educativos',
  lgpd_exportacao: 'Exportações LGPD (guardadas 30 dias)',
}

/** Espaço ocupado pelos arquivos (por tipo, do banco) e o disco do servidor onde ficam (livre/total). */
export async function storageUsage() {
  const rows = await db.select({ kind: schema.files.kind, n: count(), bytes: sum(schema.files.size) }).from(schema.files).groupBy(schema.files.kind)
  const byKind = rows
    .map((r) => ({ kind: r.kind, label: KIND_LABEL[r.kind] ?? (r.kind === 'publico' ? 'Imagens do site' : r.kind), files: Number(r.n), bytes: Number(r.bytes ?? 0) }))
    .sort((a, b) => b.bytes - a.bytes)
  const photos = byKind.filter((k) => ['foto_evolucao', 'foto_refeicao', 'checkin'].includes(k.kind))
  let disk: { free: number; total: number } | null = null
  try {
    await mkdir(uploadRoot(), { recursive: true })
    const st = await statfs(uploadRoot())
    disk = { free: st.bavail * st.bsize, total: st.blocks * st.bsize }
  } catch {
    disk = null
  }
  return {
    byKind,
    photosBytes: photos.reduce((a, b) => a + b.bytes, 0),
    photosFiles: photos.reduce((a, b) => a + b.files, 0),
    totalBytes: byKind.reduce((a, b) => a + b.bytes, 0),
    disk,
  }
}

export function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1).replace('.', ',')} MB`
  return `${(b / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
}
