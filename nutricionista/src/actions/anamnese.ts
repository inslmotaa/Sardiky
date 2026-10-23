'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient, requireTeam } from '@/lib/auth/session'
import { assertPatientAccess } from '@/lib/team-access'
import { ANAMNESIS_STEPS, stepComplete, stepSchema, type AnamFile } from '@/lib/anamnese-form'
import { anamnesisVersions, currentDraft } from '@/lib/anamnese-store'
import { restrictionsFromText } from '@/lib/restricoes'
import { DOC_TYPES, saveUpload } from '@/lib/storage'
import { notifyUser } from '@/lib/notify'
import { notifyTeam } from '@/lib/team'
import { pushToTeam, pushToUser } from '@/lib/push'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { audit } from '@/lib/audit'
import { failure, type ActionState } from '@/lib/action'
import { uuid } from '@/lib/validation'

const safeNext = (v: unknown) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : null)

/** Salva uma etapa do rascunho (validação da etapa com zod). "Salvar e sair" volta para a área do cliente. */
export async function saveAnamnesisStep(index: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const step = ANAMNESIS_STEPS[index]
  if (!step) return { error: 'Etapa inválida.' }
  const draft = await currentDraft(user.patientId)
  if (!draft) return { error: 'Não há anamnese em andamento.' }
  const raw = Object.fromEntries(
    step.fields.map((f) => {
      if (f.type !== 'files') return [f.id, String(fd.get(f.id) ?? '')]
      try {
        return [f.id, JSON.parse(String(fd.get(f.id) || '[]'))]
      } catch {
        return [f.id, []]
      }
    }),
  )
  const parsed = stepSchema(step).safeParse(raw)
  if (!parsed.success) {
    const fieldErrors = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))
    return { error: 'Confira os campos destacados.', fieldErrors }
  }
  const data = parsed.data as Record<string, unknown>
  // Anexos: só arquivos do próprio paciente.
  for (const f of step.fields.filter((x) => x.type === 'files')) {
    const list = (data[f.id] as AnamFile[]) ?? []
    if (list.length) {
      const own = await db
        .select({ id: schema.files.id, title: schema.files.title })
        .from(schema.files)
        .where(and(inArray(schema.files.id, list.map((x) => x.id)), eq(schema.files.patientId, user.patientId)))
      data[f.id] = own
    }
  }
  try {
    await db
      .update(schema.anamneses)
      .set({ answers: { ...draft.answers, [step.key]: data }, step: Math.max(draft.step, index + 1), updatedAt: new Date() })
      .where(eq(schema.anamneses.id, draft.id))
  } catch (err) {
    return failure(err)
  }
  if (fd.get('sair')) redirect('/paciente?anamnese=salva')
  return { ok: true, message: 'Etapa salva.' }
}

/** Anexo de exame (PDF ou foto) guardado na área privada do paciente. */
export async function uploadAnamnesisFile(fd: FormData): Promise<{ error?: string; file?: AnamFile }> {
  const user = await requirePatient()
  const file = fd.get('file')
  if (!(file instanceof File)) return { error: 'Escolha um arquivo.' }
  const saved = await saveUpload(file, DOC_TYPES)
  if ('error' in saved) return { error: saved.error }
  const title = (file.name || 'Exame').slice(0, 120)
  const [row] = await db
    .insert(schema.files)
    .values({ patientId: user.patientId, uploadedBy: user.id, kind: 'exame', title, mime: saved.mime, size: saved.size, storageKey: saved.key, visibleToPatient: true })
    .returning({ id: schema.files.id, title: schema.files.title })
  await audit(user, 'arquivo_enviado', 'arquivo', { entityId: row.id, patientId: user.patientId, details: { origem: 'anamnese' } })
  return { file: row }
}

/** Envio: confere todas as etapas, leva as respostas para a ficha e avisa o nutricionista. */
export async function submitAnamnesis(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const draft = await currentDraft(user.patientId)
  if (!draft) return { error: 'Não há anamnese em andamento.' }
  const missing = ANAMNESIS_STEPS.filter((s) => !stepComplete(s, draft.answers[s.key]))
  if (missing.length) return { error: `Falta completar: ${missing.map((s) => s.title).join(', ')}.` }
  const a = draft.answers
  const s = await getSettings()
  try {
    const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, user.patientId))
    const sexo = a.pessoais?.sexo === 'Feminino' ? 'F' : a.pessoais?.sexo === 'Masculino' ? 'M' : p?.sex
    const restrictions = [...new Set([...(p?.restrictions ?? []), ...restrictionsFromText([String(a.saude?.alergias ?? '')])])]
    await db.transaction(async (tx) => {
      await tx.update(schema.anamneses).set({ status: 'enviada', submittedAt: new Date(), updatedAt: new Date() }).where(eq(schema.anamneses.id, draft.id))
      await tx
        .update(schema.patients)
        .set({
          birthDate: String(a.pessoais?.nascimento || '') || p?.birthDate,
          sex: sexo ?? null,
          heightCm: Number(a.medidas?.altura) || p?.heightCm,
          objective: String(a.objetivo?.principal || '') || p?.objective,
          restrictions,
          anamnesisReceivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.patients.id, user.patientId))
      // Peso, altura e cintura informados entram na evolução como "informados pelo paciente".
      if (a.medidas?.peso)
        await tx.insert(schema.measurements).values({
          patientId: user.patientId,
          date: todayIn(s.timezone),
          source: 'paciente',
          weightKg: Number(a.medidas.peso),
          heightCm: Number(a.medidas.altura) || null,
          waistCm: Number(a.medidas.cintura) || null,
          notes: `Anamnese (versão ${draft.version})`,
        })
    })
    const title = draft.version > 1 ? 'Reavaliação: anamnese atualizada' : 'Nova anamnese recebida'
    const link = `/admin/pacientes/${user.patientId}?aba=anamnese`
    await notifyTeam('clinico', title, user.name, link, user.patientId)
    await pushToTeam('clinico', { title, body: user.name, url: link, tag: `anamnese-${user.patientId}` }, user.patientId)
    await audit(user, 'anamnese_enviada', 'anamnese', { entityId: draft.id, patientId: user.patientId, details: { versao: draft.version } })
  } catch (err) {
    return failure(err)
  }
  const next = safeNext(fd.get('next'))
  redirect(`/paciente/anamnese?enviada=1${next ? `&next=${encodeURIComponent(next)}` : ''}`)
}

/** Nutricionista pede uma reavaliação: nova versão em rascunho, já com as respostas anteriores. */
export async function requestReassessment(patientId: string): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(patientId).success) return
  await assertPatientAccess(user, patientId)
  const [last] = await anamnesisVersions(patientId)
  if (!last || last.status !== 'enviada') return
  await db.insert(schema.anamneses).values({ patientId, version: last.version + 1, answers: last.answers }).onConflictDoNothing()
  const [p] = await db.select({ userId: schema.patients.userId }).from(schema.patients).where(eq(schema.patients.id, patientId))
  if (p?.userId) {
    await notifyUser(p.userId, 'Reavaliação: atualize sua anamnese', 'Revise e atualize as respostas para a próxima etapa do acompanhamento.', '/paciente/anamnese')
    await pushToUser(p.userId, 'lembretes', { title: 'Reavaliação', body: 'Atualize sua anamnese no app.', url: '/paciente/anamnese', tag: 'anamnese' })
  }
  await audit(user, 'reavaliacao_pedida', 'anamnese', { patientId, details: { versao: last.version + 1 } })
  revalidatePath(`/admin/pacientes/${patientId}`)
}
