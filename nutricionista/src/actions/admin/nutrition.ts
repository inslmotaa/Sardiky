'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { offUrl, parseOffProduct, validBarcode, type OffSuggestion } from '@/lib/openfoodfacts'
import { isChatMode, type ChatMode } from '@/lib/chat-mode'
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
    const chatMode = isChatMode(fd.get('chatMode')) ? (fd.get('chatMode') as ChatMode) : null
    await db.update(schema.patients).set({ features, chatMode, updatedAt: new Date() }).where(eq(schema.patients.id, patientId))
    await audit(user, 'recursos_app_alterados', 'paciente', { entityId: patientId, patientId, details: { ...features, conversa: chatMode ?? 'padrao' } })
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
  /** Código de barras lido pela câmera ou digitado (produto industrializado). */
  barcode: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null),
  /** Valores vindos do Open Food Facts: o coach confirma que conferiu com o rótulo. */
  fromOff: z.literal('1').optional(),
  offConfirm: z.literal('on').optional(),
})

/** Cadastra alimento próprio (rótulo nutricional, valores por 100 g). */
export async function createFood(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = foodSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  if (d.kcal == null || d.protein == null || d.carbs == null || d.fat == null) return { error: 'Informe calorias, proteína, carboidrato e gordura por 100 g.' }
  if (d.protein + d.carbs + d.fat > 100.5) return { error: 'A soma de proteína, carboidrato e gordura passa de 100 g por 100 g.' }
  const barcode = d.barcode ? validBarcode(d.barcode) : null
  if (d.barcode && !barcode) return { fieldErrors: { barcode: 'Código inválido' }, error: 'O código de barras não é válido (confira os números).' }
  if (d.fromOff && !d.offConfirm)
    return { fieldErrors: { offConfirm: 'Confirme a conferência' }, error: 'Confira os valores com o rótulo do produto e marque a confirmação antes de salvar.' }
  try {
    const user = await requireTeam('clinico')
    if (barcode) {
      const [dup] = await db.select({ id: schema.foods.id, name: schema.foods.name }).from(schema.foods).where(eq(schema.foods.barcode, barcode))
      if (dup) return { fieldErrors: { barcode: 'Já cadastrado' }, error: `Este código já está cadastrado como “${dup.name}”.` }
    }
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
        nutrients: { kcal: d.kcal, proteina: d.protein, carboidrato: d.carbs, lipideos: d.fat, fibra: d.fiber ?? null, sodio: d.sodium ?? null },
        barcode,
        createdBy: user.id,
      })
      .returning({ id: schema.foods.id })
    if (d.measureName && d.measureGrams) await db.insert(schema.householdMeasures).values({ foodId: f.id, name: d.measureName, grams: d.measureGrams })
    await audit(user, 'alimento_criado', 'alimento', { entityId: f.id, details: { nome: d.name, ...(barcode ? { codigoDeBarras: barcode, origem: d.fromOff ? 'Open Food Facts (conferido)' : 'rótulo' } : {}) } })
    revalidatePath('/admin/alimentos')
    return { ok: true, message: `“${d.name}” cadastrado como alimento próprio.` }
  } catch (err) {
    return failure(err)
  }
}

/**
 * Busca um produto pelo código de barras: primeiro na base própria; senão, no Open Food Facts.
 * Só sugere valores; nada é gravado aqui (o coach confere e salva pelo formulário).
 */
export async function lookupBarcode(raw: string): Promise<{ error?: string; existing?: { id: string; name: string }; suggestion?: OffSuggestion; notFound?: string }> {
  try {
    await requireTeam('clinico')
    const code = validBarcode(String(raw ?? ''))
    if (!code) return { error: 'Código de barras inválido. Confira os números (8, 12, 13 ou 14 dígitos).' }
    const [own] = await db.select({ id: schema.foods.id, name: schema.foods.name }).from(schema.foods).where(eq(schema.foods.barcode, code))
    if (own) return { existing: own }
    let json: unknown
    try {
      const res = await fetch(offUrl(code, process.env.OPENFOODFACTS_API_BASE), {
        headers: { 'User-Agent': 'Farion/1.0 (painel do coach; cadastro de alimentos)' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      })
      if (res.status === 404) return { notFound: code }
      if (!res.ok) return { error: 'O Open Food Facts não respondeu agora. Preencha pelo rótulo.' }
      json = await res.json()
    } catch {
      return { error: 'Sem conexão com o Open Food Facts. Preencha pelo rótulo.' }
    }
    const suggestion = parseOffProduct(json, code)
    return suggestion ? { suggestion } : { notFound: code }
  } catch (err) {
    return { error: failure(err).error }
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
    revalidatePath(`/admin/alimentos/${foodId}`)
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
  revalidatePath(`/admin/alimentos/${foodId}`)
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
    revalidatePath(`/admin/alimentos/${foodId}`)
    return { ok: true, message: 'Alimento atualizado.' }
  } catch (err) {
    return failure(err)
  }
}
