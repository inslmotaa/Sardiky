'use server'

import { redirect } from 'next/navigation'
import { requirePatient } from '@/lib/auth/session'
import { uuid } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { mpConfigured } from '@/lib/mercadopago'
import { cancelarAssinatura, iniciarAssinatura, iniciarCobranca } from '@/lib/pagamentos'
import { revalidatePath } from 'next/cache'

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

/** "Assinar: renova todo mês" (só o plano mensal): leva ao Mercado Pago para autorizar a cobrança recorrente. */
export async function iniciarAssinaturaMensal(fd: FormData): Promise<void> {
  const user = await requirePatient()
  const planoId = String(fd.get('planoId') ?? '')
  if (!uuid.safeParse(planoId).success) redirect('/paciente/pagamento?erro=plano')
  if (!mpConfigured()) redirect('/paciente/pagamento')
  if (!rateLimit(`pagar:${user.id}`, 10, 10 * 60_000)) redirect(`/paciente/pagamento?plano=${planoId}&erro=limite`)
  let initPoint = ''
  try {
    initPoint = await iniciarAssinatura(user.patientId, planoId, user)
  } catch {
    redirect(`/paciente/pagamento?plano=${planoId}&erro=mp`)
  }
  if (!initPoint) redirect(`/paciente/pagamento?plano=${planoId}&erro=mp`)
  redirect(initPoint)
}

/** Cancela a assinatura mensal: nada mais é cobrado; o acesso segue até o fim do período pago. */
export async function cancelarAssinaturaMensal(): Promise<void> {
  const user = await requirePatient()
  try {
    await cancelarAssinatura(user.patientId, user)
  } catch {
    redirect('/paciente/meus-dados?assinatura=erro')
  }
  revalidatePath('/paciente/meus-dados')
  redirect('/paciente/meus-dados?assinatura=cancelada')
}

