'use server'

import { redirect } from 'next/navigation'
import { requirePatient } from '@/lib/auth/session'
import { uuid } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { mpConfigured } from '@/lib/mercadopago'
import { iniciarCobranca } from '@/lib/pagamentos'

/**
 * Cliente clica em "Pagar com Mercado Pago": cria (ou reaproveita) a cobrança do plano escolhido
 * e leva o navegador ao Checkout Pro. O valor vem do banco; do formulário só vem o id do plano.
 */
export async function iniciarPagamento(fd: FormData): Promise<void> {
  const user = await requirePatient()
  const planoId = String(fd.get('planoId') ?? '')
  if (!uuid.safeParse(planoId).success) redirect('/paciente/pagamento?erro=plano')
  if (!mpConfigured()) redirect('/paciente/pagamento')
  if (!rateLimit(`pagar:${user.id}`, 10, 10 * 60_000)) redirect(`/paciente/pagamento?plano=${planoId}&erro=limite`)
  let initPoint = ''
  try {
    initPoint = (await iniciarCobranca(user.patientId, planoId, user)).initPoint
  } catch {
    redirect(`/paciente/pagamento?plano=${planoId}&erro=mp`)
  }
  redirect(initPoint)
}
