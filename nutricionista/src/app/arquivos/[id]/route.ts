import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { readUpload } from '@/lib/storage'
import { uuid } from '@/lib/validation'

/**
 * Entrega de arquivos privados. Regras:
 * - públicos (logo, foto profissional): qualquer visitante;
 * - do paciente: o próprio paciente (se compartilhado com ele) ou equipe com permissão clínica.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuid.safeParse(id).success) return new Response('Não encontrado', { status: 404 })
  const [file] = await db.select().from(schema.files).where(eq(schema.files.id, id))
  if (!file) return new Response('Não encontrado', { status: 404 })

  if (!file.isPublic) {
    const user = await getCurrentUser()
    const allowed =
      !!user &&
      ((user.role === 'patient' && file.patientId !== null && file.patientId === user.patientId && file.visibleToPatient) ||
        (user.role !== 'patient' && can(user, 'clinico')))
    // Fotos de evolução: nunca públicas, só o próprio paciente e a equipe clínica (regra acima).
    // 404 em vez de 403: não revela a existência do arquivo.
    if (!allowed) return new Response('Não encontrado', { status: 404 })
  }

  const body = await readUpload(file.storageKey).catch(() => null)
  if (!body) return new Response('Arquivo indisponível', { status: 410 })
  const inline = file.mime.startsWith('image/') || file.mime.startsWith('audio/') || file.mime === 'application/pdf'
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(body.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.title)}"`,
      'Cache-Control': file.isPublic ? 'public, max-age=3600' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
