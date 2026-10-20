import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { audit } from '@/lib/audit'
import { DEFAULT_FEATURES } from '@/db/schema'
import { normalizePlan } from '@/lib/plan'
import { planPdf } from '@/lib/plan-pdf'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { uuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** PDF de qualquer plano ou modelo, para a equipe com permissão clínica. ?paciente=1 aplica os recursos do app do paciente. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role === 'patient' || !can(user, 'clinico')) return new Response('Não encontrado', { status: 404 })
  const { id } = await params
  if (!uuid.safeParse(id).success) return new Response('Não encontrado', { status: 404 })
  const [plan] = await db.select().from(schema.mealPlans).where(eq(schema.mealPlans.id, id))
  if (!plan) return new Response('Não encontrado', { status: 404 })
  const [patient] = plan.patientId ? await db.select().from(schema.patients).where(eq(schema.patients.id, plan.patientId)) : []
  const asPatient = new URL(req.url).searchParams.get('paciente') === '1'
  const f = { ...DEFAULT_FEATURES, ...patient?.features }
  const s = await getSettings()
  const bytes = await planPdf(normalizePlan(plan.content), {
    professionalName: s.professionalName,
    professionalTitle: s.professionalTitle,
    registry: s.registry,
    brandColor: s.brandColor,
    patientName: patient?.fullName ?? null,
    title: plan.title,
    validity: plan.validUntil ? `Válido até ${fmtDay(plan.validUntil)}` : plan.status === 'rascunho' ? 'RASCUNHO — não enviado ao paciente' : null,
    generatedAt: fmtDateTime(new Date(), s.timezone),
    showKcal: asPatient ? f.calorias : true,
    showMacros: asPatient ? f.macros : true,
    contact: s.whatsapp ? `WhatsApp ${s.whatsapp}` : s.contactEmail,
  })
  await audit(user, 'plano_pdf_gerado', 'plano', { entityId: plan.id, patientId: plan.patientId })
  const slug = plan.title.normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60) || 'plano'
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${slug}.pdf"`, 'Cache-Control': 'private, no-store' },
  })
}
