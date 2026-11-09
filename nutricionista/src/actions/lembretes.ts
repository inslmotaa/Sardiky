'use server'

import { revalidatePath } from 'next/cache'
import { requirePatient } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { rateLimit } from '@/lib/rate-limit'
import { newCalendarToken, revokeCalendarToken } from '@/lib/lembretes'
import type { ActionState } from '@/lib/action'

export type CalendarLinkState = ActionState & { https?: string; webcal?: string }

/** Novo link de assinatura do calendário (o anterior para de funcionar). Mostrado uma única vez. */
export async function createCalendarLink(_: CalendarLinkState): Promise<CalendarLinkState> {
  const user = await requirePatient()
  if (!rateLimit(`calendario:${user.id}`, 10, 60 * 60_000)) return { error: 'Muitas tentativas. Tente mais tarde.' }
  const links = await newCalendarToken(user.id)
  await audit(user, 'lembretes_calendario_link_criado', 'usuario', { entityId: user.id })
  revalidatePath('/paciente/notificacoes')
  return { ok: true, message: 'Link criado. Copie agora: por segurança, ele não aparece de novo.', ...links }
}

/** Revoga o link de assinatura: o calendário deixa de receber atualizações. */
export async function revokeCalendarLink(): Promise<void> {
  const user = await requirePatient()
  await revokeCalendarToken(user.id)
  await audit(user, 'lembretes_calendario_link_revogado', 'usuario', { entityId: user.id })
  revalidatePath('/paciente/notificacoes')
}
