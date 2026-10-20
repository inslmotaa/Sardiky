import { and, eq, inArray } from 'drizzle-orm'
import { readUpload } from '@/lib/storage'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { currentPublishedPlan, getPatient } from '@/lib/patient-context'
import { normalizePlan } from '@/lib/plan'
import { planPdf } from '@/lib/plan-pdf'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { uuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Prescrições ativas e assinatura do consultório para o PDF. */
async function pdfExtras(patientId: string | null, s: Awaited<ReturnType<typeof getSettings>>) {
  const prescriptions = patientId
    ? await db
        .select()
        .from(schema.prescriptions)
        .where(and(eq(schema.prescriptions.patientId, patientId), eq(schema.prescriptions.active, true)))
    : []
  let image: { bytes: Uint8Array; mime: string } | null = null
  if (s.signatureFileId) {
    const [f] = await db.select().from(schema.files).where(eq(schema.files.id, s.signatureFileId))
    const bytes = f ? await readUpload(f.storageKey).catch(() => null) : null
    if (f && bytes && (f.mime === 'image/png' || f.mime === 'image/jpeg')) image = { bytes: new Uint8Array(bytes), mime: f.mime }
  }
  let logo: { bytes: Uint8Array; mime: string } | null = null
  if (s.logoFileId) {
    const [f] = await db.select().from(schema.files).where(eq(schema.files.id, s.logoFileId))
    const bytes = f ? await readUpload(f.storageKey).catch(() => null) : null
    if (f && bytes && (f.mime === 'image/png' || f.mime === 'image/jpeg')) logo = { bytes: new Uint8Array(bytes), mime: f.mime }
  }
  return { prescriptions, logo, signature: s.signatureText || image ? { text: s.signatureText, image } : undefined }
}

/** PDF do plano ativo (ou de uma versão liberada no histórico, com ?id=) do paciente logado. */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'patient' || !user.patientId) return new Response('Não encontrado', { status: 404 })
  const id = new URL(req.url).searchParams.get('id')
  let plan = null
  if (id) {
    if (!uuid.safeParse(id).success) return new Response('Não encontrado', { status: 404 })
    const [p] = await db
      .select()
      .from(schema.mealPlans)
      .where(and(eq(schema.mealPlans.id, id), eq(schema.mealPlans.patientId, user.patientId), inArray(schema.mealPlans.status, ['publicado', 'arquivado'])))
    plan = p && (p.status === 'publicado' || p.visibleInHistory) ? p : null
  } else plan = await currentPublishedPlan(user.patientId)
  if (!plan) return new Response('Plano não encontrado', { status: 404 })
  const [s, patient] = await Promise.all([getSettings(), getPatient(user.patientId)])
  const bytes = await planPdf(normalizePlan(plan.content), {
    professionalName: s.professionalName,
    professionalTitle: s.professionalTitle,
    registry: s.registry,
    brandColor: s.brandColor,
    patientName: patient.fullName,
    title: plan.title,
    validity: plan.validUntil ? `Válido até ${fmtDay(plan.validUntil)}` : null,
    generatedAt: fmtDateTime(new Date(), s.timezone),
    showKcal: patient.features.calorias,
    showMacros: patient.features.macros,
    contact: s.whatsapp ? `WhatsApp ${s.whatsapp}` : s.contactEmail,
    ...(await pdfExtras(user.patientId, s)),
  })
  await audit(user, 'plano_pdf_baixado', 'plano', { entityId: plan.id, patientId: user.patientId })
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="plano-alimentar-v${plan.version}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
