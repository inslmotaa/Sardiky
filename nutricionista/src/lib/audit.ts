import 'server-only'
import { db, schema } from '@/db'
import { clientIp, type CurrentUser } from './auth/session'

/** Registra ações relevantes e acessos a dados sensíveis. Nunca grava o conteúdo clínico em si. */
export async function audit(
  actor: Pick<CurrentUser, 'id' | 'name' | 'role'> | null,
  action: string,
  entity: string,
  opts: { entityId?: string | null; patientId?: string | null; details?: Record<string, unknown> } = {},
) {
  try {
    await db.insert(schema.auditLogs).values({
      actorId: actor?.id ?? null,
      actorLabel: actor ? `${actor.name} (${actor.role})` : 'visitante',
      action,
      entity,
      entityId: opts.entityId ?? null,
      patientId: opts.patientId ?? null,
      details: opts.details ?? null,
      ip: await clientIp().catch(() => null),
    })
  } catch (err) {
    // A auditoria não deve derrubar a operação principal, mas a falha precisa aparecer nos logs.
    console.error('[auditoria] falha ao registrar', action, err)
  }
}
