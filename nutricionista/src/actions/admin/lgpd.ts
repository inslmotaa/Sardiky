'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { notifyUser } from '@/lib/notify'
import { deleteUpload } from '@/lib/storage'
import { optStr, uuid } from '@/lib/validation'

export async function resolveDataRequest(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ id: uuid, status: z.enum(['em_andamento', 'concluida', 'negada']), response: optStr(2000) })
    .safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('config')
    const [r] = await db.select().from(schema.dataRequests).where(eq(schema.dataRequests.id, parsed.data.id))
    if (!r) return { error: 'Solicitação não encontrada.' }
    if (parsed.data.status === 'negada' && !parsed.data.response) return { error: 'Explique o motivo da negativa (ex.: obrigação legal de guarda).' }
    await db
      .update(schema.dataRequests)
      .set({ status: parsed.data.status, response: parsed.data.response, resolvedAt: parsed.data.status === 'em_andamento' ? null : new Date() })
      .where(eq(schema.dataRequests.id, r.id))
    if (r.patientId) {
      const [p] = await db.select({ userId: schema.patients.userId }).from(schema.patients).where(eq(schema.patients.id, r.patientId))
      await notifyUser(p?.userId, 'Sua solicitação de privacidade foi atualizada', parsed.data.response ?? undefined, '/paciente/meus-dados')
    }
    await audit(user, 'lgpd_solicitacao_atualizada', 'solicitacao', { entityId: r.id, patientId: r.patientId, details: { status: parsed.data.status } })
    revalidatePath('/admin/privacidade')
    return { ok: true, message: 'Solicitação atualizada.' }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Anonimiza um paciente: remove dados identificadores, contas, mensagens, diário,
 * fotos e documentos. Mantém registros mínimos sem identificação (consultas e
 * lançamentos financeiros) para estatística e obrigações fiscais.
 * Atenção: o prontuário pode ter prazo legal de guarda — confirme antes.
 */
export async function anonymizePatient(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get('patientId') ?? '')
  if (!uuid.safeParse(id).success) return { error: 'Escolha o cliente.' }
  if (fd.get('confirm') !== 'ANONIMIZAR') return { error: 'Digite ANONIMIZAR para confirmar.', fieldErrors: { confirm: 'Confirmação necessária' } }
  try {
    const user = await requireTeam('config')
    const [p] = await db.select().from(schema.patients).where(and(eq(schema.patients.id, id), isNull(schema.patients.anonymizedAt)))
    if (!p) return { error: 'Cliente não encontrado.' }
    const files = await db.select().from(schema.files).where(eq(schema.files.patientId, id))
    await db.transaction(async (tx) => {
      await tx.delete(schema.diaryEntries).where(eq(schema.diaryEntries.patientId, id))
      await tx.delete(schema.messages).where(eq(schema.messages.patientId, id))
      await tx.delete(schema.clinicalNotes).where(eq(schema.clinicalNotes.patientId, id))
      await tx.delete(schema.formAssignments).where(eq(schema.formAssignments.patientId, id))
      await tx.delete(schema.measurements).where(eq(schema.measurements.patientId, id))
      await tx.delete(schema.goals).where(eq(schema.goals.patientId, id))
      await tx.delete(schema.mealPlans).where(eq(schema.mealPlans.patientId, id))
      await tx.delete(schema.files).where(eq(schema.files.patientId, id))
      await tx
        .update(schema.appointments)
        .set({ contactName: 'Cliente anonimizado', contactEmail: 'anonimizado@invalid', contactPhone: '0000000000', patientNotes: null, internalNotes: null, meetingUrl: null })
        .where(eq(schema.appointments.patientId, id))
      if (p.userId) await tx.delete(schema.users).where(eq(schema.users.id, p.userId))
      await tx
        .update(schema.patients)
        .set({ fullName: 'Cliente anonimizado', email: null, phone: null, birthDate: null, objective: null, userId: null, status: 'inativo', anonymizedAt: new Date() })
        .where(eq(schema.patients.id, id))
    })
    for (const f of files) await deleteUpload(f.storageKey)
    await audit(user, 'paciente_anonimizado', 'paciente', { entityId: id, patientId: id })
    revalidatePath('/admin/privacidade')
    revalidatePath('/admin/pacientes')
    return { ok: true, message: 'Dados do cliente anonimizados.' }
  } catch (err) {
    return failure(err)
  }
}
