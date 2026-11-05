import 'server-only'
import { redirect } from 'next/navigation'
import { requirePatient } from './session'
import { needsPayment } from '../pagamentos'

/**
 * Cliente com acesso liberado: quem se cadastrou pelo site só usa a área depois do pagamento aprovado.
 * Enquanto isso, ficam abertos apenas Pagamento, Mensagens e Meus dados (essas páginas usam requirePatient).
 */
export async function requireActivePatient() {
  const user = await requirePatient()
  if (await needsPayment(user.patientId)) redirect('/paciente/pagamento')
  return user
}
