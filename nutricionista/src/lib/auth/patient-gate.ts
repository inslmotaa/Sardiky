import 'server-only'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from './session'
import { needsPayment } from '../pagamentos'
import { getSettings } from '../settings'
import { todayIn } from '../time'
import { acessoVencido } from '../renovacao'
import { UserError } from '../action'

/** O plano do cliente terminou (há término definido e ele já passou)? */
export async function accessExpired(patientId: string) {
  const [[p], s] = await Promise.all([db.select({ end: schema.patients.packageEnd }).from(schema.patients).where(eq(schema.patients.id, patientId)), getSettings()])
  return acessoVencido(p?.end, todayIn(s.timezone))
}

/**
 * Cliente com acesso liberado: quem se cadastrou pelo site só usa a área depois do pagamento aprovado
 * (enquanto isso, ficam abertos apenas Pagamento, Mensagens e Meus dados). Com o plano vencido, a área
 * mostra só o histórico e o botão de renovar (/paciente/encerrado).
 */
export async function requireActivePatient() {
  const user = await requirePatient()
  if (await needsPayment(user.patientId)) redirect('/paciente/pagamento')
  if (await accessExpired(user.patientId)) redirect('/paciente/encerrado')
  return user
}

/** Nas ações que gravam dados do dia a dia (diário, check-in, água, peso): recusa com o plano vencido. */
export async function assertActiveAccess(patientId: string) {
  if (await accessExpired(patientId)) throw new UserError('Seu plano terminou. Renove para voltar a registrar.')
}
