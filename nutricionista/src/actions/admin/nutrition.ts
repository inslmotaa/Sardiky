'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { DEFAULT_FEATURES, type AppFeatures } from '@/db/schema'
import { requireTeam } from '@/lib/auth/session'
import { assertPatientAccess } from '@/lib/team-access'
import { audit } from '@/lib/audit'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { BMR_FORMULAS, normalize } from '@/lib/nutricao'
import { RESTRICTIONS } from '@/lib/restricoes'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { checkbox, optNum, optStr, str, uuid } from '@/lib/validation'

/* ------------------------------ gasto energético ------------------------------ */

const energySchema = z.object({
  formula: z.enum(Object.keys(BMR_FORMULAS) as [string, ...string[]]),
  factor: z.number().min(1).max(2.5),
  bmr: z.number().min(500).max(6000),
  tdee: z.number().min(500).max(10000),
  targetKcal: z.number().int().min(600).max(8000),
  adjust: z.number().min(-3000).max(3000),
  adjustUnit: z.enum(['kcal', 'pct']),
})

export async function saveEnergy(patientId: string, e: z.input<typeof energySchema>): Promise<{ ok?: boolean; error?: string; message?: string }> {
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(patientId).success) return { error: 'Cliente inválido.' }
    await assertPatientAccess(user, patientId)
    const parsed = energySchema.safeParse(e)
    if (!parsed.success) return { error: 'Valores fora da faixa esperada. Revise os dados.' }
    const s = await getSettings()
    await db
      .update(schema.patients)
      .set({ energy: { ...parsed.data, date: todayIn(s.timezone) }, updatedAt: new Date() })
      .where(eq(schema.patients.id, patientId))
    await audit(user, 'gasto_energetico_salvo', 'paciente', { entityId: patientId, patientId, details: { formula: parsed.data.formula, meta: parsed.data.targetKcal } })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: `Meta de ${parsed.data.targetKcal} kcal salva na ficha. Ela aparece como sugestão no editor de planos.` }
  } catch (err) {
    const f = failure(err)
    return { error: f.error }
  }
}

/* ------------------------------ recursos do app ------------------------------ */

export async function setPatientFeatures(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(patientId).success) return { error: 'Cliente inválido.' }
    await assertPatientAccess(user, patientId)
    const features = Object.fromEntries((Object.keys(DEFAULT_FEATURES) as (keyof AppFeatures)[]).map((k) => [k, fd.get(k) === 'on'])) as AppFeatures
    await db.update(schema.patients).set({ features, updatedAt: new Date() }).where(eq(schema.patients.id, patientId))
    await audit(user, 'recursos_app_alterados', 'paciente', { entityId: patientId, patientId, details: features })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: 'Recursos do app atualizados.' }
  } catch (err) {
    return failure(err)
  }
}

/* --------------------------- restrições alimentares --------------------------- */

export async function setRestrictions(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(patientId).success) return { error: 'Cliente inválido.' }
    await assertPatientAccess(user, patientId)
    const restrictions = fd.getAll('restriction').map(String).filter((k) => k in RESTRICTIONS)
    await db.update(schema.patients).set({ restrictions, updatedAt: new Date() }).where(eq(schema.patients.id, patientId))
    await audit(user, 'restricoes_alteradas', 'paciente', { entityId: patientId, patientId, details: { restricoes: restrictions } })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: restrictions.length ? 'Restrições salvas. O editor de planos vai alertar os alimentos que conflitam.' : 'Sem restrições registradas.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ anamnese ------------------------------ */

export async function setAnamnesis(patientId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(patientId).success) return { error: 'Cliente inválido.' }
    await assertPatientAccess(user, patientId)
    const received = fd.get('received') === 'on'
    const notes = String(fd.get('notes') ?? '').trim().slice(0, 20000) || null
    const [p] = await db.select({ at: schema.patients.anamnesisReceivedAt }).from(schema.patients).where(eq(schema.patients.id, patientId))
    await db
      .update(schema.patients)
      .set({ anamnesisReceivedAt: received ? (p?.at ?? new Date()) : null, anamnesisNotes: notes, updatedAt: new Date() })
      .where(eq(schema.patients.id, patientId))
    await audit(user, 'anamnese_registrada', 'paciente', { entityId: patientId, patientId, details: { recebida: received } })
    revalidatePath(`/admin/pacientes/${patientId}`)
    return { ok: true, message: received ? 'Anamnese marcada como recebida.' : 'Anamnese atualizada.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ base de alimentos ------------------------------ */

const foodSchema = z.object({
  name: str(160, 'Informe o nome'),
  group: z.enum(['cereais', 'leguminosas', 'carnes', 'laticinios', 'frutas', 'verduras', 'gorduras', 'acucares', 'bebidas', 'outros']),
  kcal: optNum(0, 900),
  protein: optNum(0, 100),
  carbs: optNum(0, 100),
  fat: optNum(0, 100),
  fiber: optNum(0, 100),
  sodium: optNum(0, 40000),
  cookingFactor: optNum(0.1, 5),
  measureName: optStr(60),
  measureGrams: optNum(0.1, 2000),
})

/** Cadastra alimento próprio (rótulo nutricional, valores por 100 g). */
export async function createFood(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = foodSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  if (d.kcal == null || d.protein == null || d.carbs == null || d.fat == null) return { error: 'Informe calorias, proteína, carboidrato e gordura por 100 g.' }
  if (d.protein + d.carbs + d.fat > 100.5) return { error: 'A soma de proteína, carboidrato e gordura passa de 100 g por 100 g.' }
  try {
    const user = await requireTeam('clinico')
    const [f] = await db
      .insert(schema.foods)
      .values({
        name: d.name,
        search: normalize(d.name),
        group: d.group,
        source: 'proprio',
        kcal: d.kcal,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
        fiber: d.fiber ?? 0,
        sodium: d.sodium,
        cookingFactor: d.cookingFactor,
        createdBy: user.id,
      })
      .returning({ id: schema.foods.id })
    if (d.measureName && d.measureGrams) await db.insert(schema.householdMeasures).values({ foodId: f.id, name: d.measureName, grams: d.measureGrams })
    await audit(user, 'alimento_criado', 'alimento', { entityId: f.id, details: { nome: d.name } })
    revalidatePath('/admin/alimentos')
    return { ok: true, message: `“${d.name}” cadastrado como alimento próprio.` }
  } catch (err) {
    return failure(err)
  }
}

export async function addMeasure(foodId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ name: str(60, 'Nome da medida'), grams: optNum(0.1, 2000) }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  if (parsed.data.grams == null) return { fieldErrors: { grams: 'Informe os gramas' }, error: 'Informe os gramas.' }
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(foodId).success) return { error: 'Alimento inválido.' }
    await db.insert(schema.householdMeasures).values({ foodId, name: parsed.data.name, grams: parsed.data.grams })
    await audit(user, 'medida_caseira_criada', 'alimento', { entityId: foodId })
    revalidatePath('/admin/alimentos')
    return { ok: true, message: 'Medida adicionada.' }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteMeasure(foodId: string, measureId: string): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(measureId).success) return
  await db.delete(schema.householdMeasures).where(and(eq(schema.householdMeasures.id, measureId), eq(schema.householdMeasures.foodId, foodId)))
  await audit(user, 'medida_caseira_excluida', 'alimento', { entityId: foodId })
  revalidatePath('/admin/alimentos')
}

export async function updateCookingFactor(foodId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ cookingFactor: optNum(0.1, 5), active: checkbox }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('clinico')
    if (!uuid.safeParse(foodId).success) return { error: 'Alimento inválido.' }
    await db.update(schema.foods).set({ cookingFactor: parsed.data.cookingFactor, active: parsed.data.active }).where(eq(schema.foods.id, foodId))
    await audit(user, 'alimento_editado', 'alimento', { entityId: foodId })
    revalidatePath('/admin/alimentos')
    return { ok: true, message: 'Alimento atualizado.' }
  } catch (err) {
    return failure(err)
  }
}
