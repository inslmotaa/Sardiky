import { eq, isNotNull, max } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { assertPatientAccess } from '@/lib/team-access'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { fmtDay, todayIn } from '@/lib/time'
import { phoneLabel } from '@/lib/format'
import { reciboNumero, reciboPdf } from '@/lib/recibo-pdf'
import { uuid } from '@/lib/validation'

export const dynamic = 'force-dynamic'

/** Número do recibo: o próximo da sequência, atribuído na primeira emissão (e mantido depois). */
async function ensureNumber(paymentId: string): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db.select({ n: schema.payments.receiptNumber }).from(schema.payments).where(eq(schema.payments.id, paymentId))
    if (row?.n) return row.n
    const [{ top }] = await db.select({ top: max(schema.payments.receiptNumber) }).from(schema.payments).where(isNotNull(schema.payments.receiptNumber))
    try {
      const [u] = await db
        .update(schema.payments)
        .set({ receiptNumber: (top ?? 0) + 1 })
        .where(eq(schema.payments.id, paymentId))
        .returning({ n: schema.payments.receiptNumber })
      if (u?.n) return u.n
    } catch {
      /* outro recibo pegou o mesmo número: tenta o próximo */
    }
  }
  throw new Error('Não foi possível numerar o recibo.')
}

/**
 * Recibo em PDF de um pagamento confirmado. O cliente baixa os próprios (Meus dados); a equipe com
 * permissão de financeiro, os de qualquer cliente que acompanha. Outros casos: 404.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const notFound = () => new Response('Não encontrado', { status: 404 })
  if (!uuid.safeParse(id).success) return notFound()
  const user = await getCurrentUser()
  if (!user) return new Response('Não autorizado', { status: 401 })
  const [pay] = await db.select().from(schema.payments).where(eq(schema.payments.id, id))
  if (!pay || pay.status !== 'pago' || !pay.patientId) return notFound()
  if (user.role === 'patient') {
    if (user.patientId !== pay.patientId) return notFound()
  } else {
    if (!can(user, 'financeiro')) return notFound()
    const ok = await assertPatientAccess(user, pay.patientId).then(
      () => true,
      () => false,
    )
    if (!ok) return notFound()
  }
  const [[patient], s] = await Promise.all([db.select().from(schema.patients).where(eq(schema.patients.id, pay.patientId)), getSettings()])
  const number = await ensureNumber(pay.id)
  const bytes = await reciboPdf({
    number,
    issuedOn: fmtDay(todayIn(s.timezone)),
    paidOn: pay.paidAt ? fmtDay(pay.paidAt) : null,
    payerName: patient?.fullName ?? 'Cliente',
    payerEmail: patient?.email ?? null,
    description: pay.description,
    amountCents: pay.amountCents - pay.discountCents,
    method: pay.method,
    providerRef: pay.providerRef,
    period: null,
    issuer: {
      name: s.professionalName,
      title: s.professionalTitle,
      document: s.responsibleDocument,
      siteName: s.siteName,
      contact: [s.whatsapp ? `WhatsApp ${phoneLabel(s.whatsapp)}` : null, s.contactEmail].filter(Boolean).join(' · ') || null,
      brandColor: s.brandColor,
    },
  })
  await audit(user, 'recibo_emitido', 'pagamento', { entityId: pay.id, patientId: pay.patientId, details: { numero: number } })
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${reciboNumero(number)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
