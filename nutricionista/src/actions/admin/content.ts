'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import type { RecipeIngredient } from '@/db/schema'
import { requireTeam } from '@/lib/auth/session'
import { assertPatientAccess } from '@/lib/team-access'
import { audit } from '@/lib/audit'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { DOC_TYPES, IMAGE_TYPES, saveUpload } from '@/lib/storage'
import { checkbox, optNum, optStr, str, uuid } from '@/lib/validation'
import { notifyUser } from '@/lib/notify'
import { pushToUser } from '@/lib/push'

/* ------------------------------ receitas ------------------------------ */

const recipeSchema = z.object({
  title: str(160, 'Dê um nome à receita'),
  finalWeightG: optNum(1, 20000),
  portions: z.coerce.number().int('Use um número inteiro').min(1, 'Ao menos 1 porção').max(100),
  prepMinutes: optNum(0, 1440),
  instructions: optStr(8000),
  tags: optStr(300),
  visibleToAll: checkbox,
})
const ingredientsSchema = z.array(z.object({ foodId: z.uuid().nullable(), name: z.string().trim().min(1).max(160), grams: z.number().positive().max(10000) })).max(40)

/** Cria ou atualiza uma receita. Os nutrientes vêm sempre da base de alimentos do servidor. */
export async function saveRecipe(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = recipeSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  let raw: unknown
  try {
    raw = JSON.parse(String(fd.get('ingredients') || '[]'))
  } catch {
    return { error: 'Lista de ingredientes inválida.' }
  }
  const ing = ingredientsSchema.safeParse(raw)
  if (!ing.success) return { error: 'Revise os ingredientes.' }
  if (ing.data.length === 0) return { error: 'Adicione ao menos um ingrediente.' }
  let newId = id
  try {
    const user = await requireTeam('clinico')
    if (id && !uuid.safeParse(id).success) return { error: 'Receita inválida.' }
    const ids = ing.data.map((i) => i.foodId).filter((v): v is string => !!v)
    const rows = ids.length ? await db.select().from(schema.foods).where(inArray(schema.foods.id, ids)) : []
    const ingredients: RecipeIngredient[] = ing.data.map((i) => {
      const f = rows.find((r) => r.id === i.foodId)
      return f
        ? { foodId: f.id, name: f.name, grams: i.grams, per100: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber } }
        : { foodId: null, name: i.name, grams: i.grams, per100: null }
    })
    let photoFileId: string | undefined
    const photo = fd.get('photo')
    if (photo instanceof File && photo.size > 0) {
      const saved = await saveUpload(photo, IMAGE_TYPES)
      if ('error' in saved) return { fieldErrors: { photo: saved.error! }, error: saved.error }
      // Foto de receita não é dado pessoal: pode ser servida a qualquer paciente.
      const [f] = await db
        .insert(schema.files)
        .values({ uploadedBy: user.id, kind: 'receita', title: parsed.data.title, mime: saved.mime, size: saved.size, storageKey: saved.key, isPublic: true })
        .returning({ id: schema.files.id })
      photoFileId = f.id
    }
    const d = parsed.data
    const values = {
      title: d.title,
      ingredients,
      finalWeightG: d.finalWeightG,
      portions: d.portions,
      prepMinutes: d.prepMinutes,
      instructions: d.instructions ?? '',
      tags: (d.tags ?? '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8),
      visibleToAll: d.visibleToAll,
      updatedAt: new Date(),
      ...(photoFileId ? { photoFileId } : {}),
    }
    if (id) await db.update(schema.recipes).set(values).where(eq(schema.recipes.id, id))
    else [{ id: newId }] = await db.insert(schema.recipes).values({ ...values, createdBy: user.id }).returning({ id: schema.recipes.id })
    await audit(user, id ? 'receita_editada' : 'receita_criada', 'receita', { entityId: newId! })
    revalidatePath('/admin/receitas')
    revalidatePath(`/admin/receitas/${newId}`)
  } catch (err) {
    return failure(err)
  }
  if (!id) redirect(`/admin/receitas/${newId}`)
  return { ok: true, message: 'Receita salva. Ela já pode ser adicionada às refeições no editor de planos.' }
}

export async function deleteRecipe(id: string): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  await db.delete(schema.recipes).where(eq(schema.recipes.id, id))
  await audit(user, 'receita_excluida', 'receita', { entityId: id })
  revalidatePath('/admin/receitas')
  redirect('/admin/receitas')
}

/* ------------------------------ materiais ------------------------------ */

const materialSchema = z.object({
  title: str(160, 'Dê um título ao material'),
  kind: z.enum(['ebook', 'video', 'guia', 'link'], 'Escolha o tipo'),
  description: optStr(1000),
  url: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\//.test(v), 'Use um link https://'),
  audience: z.enum(['todos', 'pacientes']),
})

/** Publica um material educativo (arquivo PDF/imagem ou link) para todos ou pacientes escolhidos. */
export async function createMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = materialSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  const patientIds = fd
    .getAll('patientIds')
    .map(String)
    .filter((v) => uuid.safeParse(v).success)
  if (d.audience === 'pacientes' && patientIds.length === 0) return { fieldErrors: { patientIds: 'Escolha ao menos um paciente' }, error: 'Escolha para quais pacientes liberar.' }
  const file = fd.get('file')
  const hasFile = file instanceof File && file.size > 0
  if (!hasFile && !d.url) return { fieldErrors: { url: 'Envie um arquivo ou informe um link' }, error: 'Envie um arquivo (PDF) ou informe um link (vídeo, site).' }
  try {
    const user = await requireTeam('clinico')
    let fileId: string | null = null
    if (hasFile) {
      const saved = await saveUpload(file, DOC_TYPES)
      if ('error' in saved) return { fieldErrors: { file: saved.error! }, error: saved.error }
      const [f] = await db
        .insert(schema.files)
        .values({ uploadedBy: user.id, kind: 'material', title: d.title, mime: saved.mime, size: saved.size, storageKey: saved.key })
        .returning({ id: schema.files.id })
      fileId = f.id
    }
    await db.insert(schema.materials).values({ title: d.title, kind: d.kind, description: d.description ?? '', url: d.url, fileId, audience: d.audience, patientIds: d.audience === 'pacientes' ? patientIds : [], createdBy: user.id })
    // Avisa os pacientes com acesso ao app.
    const targets =
      d.audience === 'pacientes'
        ? await db.select({ userId: schema.patients.userId }).from(schema.patients).where(inArray(schema.patients.id, patientIds))
        : await db.select({ userId: schema.patients.userId }).from(schema.patients).where(eq(schema.patients.status, 'ativo'))
    for (const t of targets) {
      if (!t.userId) continue
      await notifyUser(t.userId, 'Novo material do nutricionista', d.title, '/paciente/materiais')
      await pushToUser(t.userId, 'mensagens', { title: 'Novo material', body: d.title, url: '/paciente/materiais', tag: 'material' })
    }
    await audit(user, 'material_publicado', 'material', { details: { titulo: d.title, publico: d.audience } })
    revalidatePath('/admin/materiais')
    return { ok: true, message: 'Material publicado na área dos pacientes.' }
  } catch (err) {
    return failure(err)
  }
}

export async function toggleMaterial(id: string, active: boolean): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  await db.update(schema.materials).set({ active }).where(eq(schema.materials.id, id))
  await audit(user, active ? 'material_reativado' : 'material_ocultado', 'material', { entityId: id })
  revalidatePath('/admin/materiais')
}

/* ------------------------------ prescrições ------------------------------ */

const prescriptionSchema = z.object({
  type: z.enum(['suplemento', 'fitoterapico', 'exame'], 'Escolha o tipo'),
  name: str(160, 'Informe o nome'),
  dose: optStr(160),
  schedule: optStr(160),
  duration: optStr(120),
  notes: optStr(1000),
})

export async function addPrescription(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = prescriptionSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(patientId).success) return { error: 'Paciente inválido.' }
    await assertPatientAccess(user, patientId)
    const [p] = await db.select({ userId: schema.patients.userId }).from(schema.patients).where(eq(schema.patients.id, patientId))
    if (!p) return { error: 'Paciente não encontrado.' }
    await db.insert(schema.prescriptions).values({ ...parsed.data, patientId, createdBy: user.id })
    if (p.userId) await notifyUser(p.userId, parsed.data.type === 'exame' ? 'Exame solicitado' : 'Nova prescrição', parsed.data.name, '/paciente/plano#prescricoes')
    await audit(user, 'prescricao_criada', 'prescricao', { patientId, details: { tipo: parsed.data.type } })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: 'Prescrição registrada e visível no app do paciente.' }
  } catch (err) {
    return failure(err)
  }
}

export async function setPrescriptionActive(patientId: string, id: string, active: boolean): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  await assertPatientAccess(user, patientId)
  await db.update(schema.prescriptions).set({ active }).where(and(eq(schema.prescriptions.id, id), eq(schema.prescriptions.patientId, patientId)))
  await audit(user, active ? 'prescricao_reativada' : 'prescricao_encerrada', 'prescricao', { entityId: id, patientId })
  revalidatePath(`/admin/pacientes/${patientId}`)
}
