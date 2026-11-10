import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { canSeePatient } from '@/lib/team-access'
import { audit } from '@/lib/audit'
import { evolutionReportPdf } from '@/lib/evolucao-pdf'
import { uuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Relatório de evolução (PDF) para o coach baixar e mandar ao cliente. Fotos só com a autorização do cliente. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const notFound = () => new Response('Não encontrado', { status: 404 })
  const user = await getCurrentUser()
  if (!user || user.role === 'patient' || !can(user, 'clinico') || !uuid.safeParse(id).success) return notFound()
  const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, id))
  if (!p || p.anonymizedAt || !canSeePatient(user, p)) return notFound()
  const bytes = await evolutionReportPdf(p.id)
  await audit(user, 'relatorio_evolucao_baixado', 'paciente', { entityId: p.id, patientId: p.id })
  const slug = p.fullName.normalize('NFD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 40)
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="evolucao-${slug || 'cliente'}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
