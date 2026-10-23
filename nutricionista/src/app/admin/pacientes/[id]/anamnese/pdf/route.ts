import { and, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { assertPatientAccess } from '@/lib/team-access'
import { audit } from '@/lib/audit'
import { anamnesisPdf } from '@/lib/anamnese-pdf'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { uuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Exporta uma versão enviada da anamnese em PDF (equipe com permissão clínica). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role === 'patient' || !can(user, 'clinico')) return new Response('Não encontrado', { status: 404 })
  const { id } = await params
  if (!uuid.safeParse(id).success) return new Response('Não encontrado', { status: 404 })
  if (!(await assertPatientAccess(user, id).then(() => true, () => false))) return new Response('Não encontrado', { status: 404 })
  const version = Number(new URL(req.url).searchParams.get('versao'))
  const [patient] = await db.select().from(schema.patients).where(eq(schema.patients.id, id))
  const [a] = Number.isInteger(version)
    ? await db.select().from(schema.anamneses).where(and(eq(schema.anamneses.patientId, id), eq(schema.anamneses.version, version), eq(schema.anamneses.status, 'enviada')))
    : []
  if (!patient || !a) return new Response('Não encontrado', { status: 404 })
  const s = await getSettings()
  const bytes = await anamnesisPdf(a.answers, {
    professional: s.professionalName,
    registry: s.registry,
    brandColor: s.brandColor,
    patient: patient.fullName,
    version: a.version,
    sentAt: a.submittedAt ? fmtDateTime(a.submittedAt, s.timezone) : '—',
    generatedAt: fmtDateTime(new Date(), s.timezone),
  })
  await audit(user, 'anamnese_pdf_gerado', 'anamnese', { entityId: a.id, patientId: id })
  const slug = patient.fullName.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50)
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="anamnese-${slug}-v${a.version}.pdf"`, 'Cache-Control': 'private, no-store' },
  })
}
