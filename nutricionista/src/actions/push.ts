'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { z } from 'zod'
import { db, schema } from '@/db'
import { DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import { getCurrentUser, requirePatient } from '@/lib/auth/session'
import { formObject, zodErrors, type ActionState } from '@/lib/action'
import { audit } from '@/lib/audit'
import { pushToUser } from '@/lib/push'
import { checkbox, int, time } from '@/lib/validation'

const subSchema = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'Endereço inválido'),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
})

/** Guarda a inscrição de push deste aparelho para o usuário logado. */
export async function savePushSubscription(sub: unknown): Promise<{ ok?: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Entre na sua conta para ativar as notificações.' }
  const parsed = subSchema.safeParse(sub)
  if (!parsed.success) return { error: 'Inscrição inválida.' }
  const ua = ((await headers()).get('user-agent') ?? '').slice(0, 300)
  const { endpoint, keys } = parsed.data
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: ua } })
  await audit(user, 'push_ativado', 'usuario', { entityId: user.id })
  // Confirmação imediata: o usuário vê que funcionou.
  await pushToUser(user.id, user.role === 'patient' ? 'plano' : 'equipe', { title: 'Notificações ativadas', body: 'Você vai receber os avisos por aqui.', tag: 'push-ok' }, { ignoreQuiet: true })
  return { ok: true }
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user || typeof endpoint !== 'string') return
  await db.delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.userId, user.id), eq(schema.pushSubscriptions.endpoint, endpoint)))
}

const prefsSchema = z.object({
  refeicoes: checkbox,
  agua: checkbox,
  plano: checkbox,
  mensagens: checkbox,
  consultas: checkbox,
  lembretes: checkbox,
  pesagem: checkbox,
  quietStart: time,
  quietEnd: time,
  waterEveryH: int(1, 6),
  waterStart: time,
  waterEnd: time,
})

/** Preferências de notificação do paciente: cada tipo liga/desliga e horário de silêncio. */
export async function saveNotificationPrefs(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = prefsSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  if (parsed.data.waterStart >= parsed.data.waterEnd) return { fieldErrors: { waterEnd: 'O fim precisa ser depois do início' }, error: 'Revise o horário dos lembretes de água.' }
  await db
    .update(schema.users)
    .set({ notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...parsed.data }, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
  revalidatePath('/paciente/notificacoes')
  return { ok: true, message: 'Preferências salvas.' }
}
