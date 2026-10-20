'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, max } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, UserError, type ActionState } from '@/lib/action'
import { notifyUser, sendEmail } from '@/lib/notify'
import { getSettings } from '@/lib/settings'
import { pushToUser } from '@/lib/push'
import { countItems, emptyPlan, normalizePlan, planContentSchema } from '@/lib/plan'
import { optDay, str, uuid } from '@/lib/validation'

async function planOrThrow(id: string) {
  if (!uuid.safeParse(id).success) throw new UserError('Plano inválido.')
  const [p] = await db.select().from(schema.mealPlans).where(eq(schema.mealPlans.id, id))
  if (!p) throw new UserError('Plano não encontrado.')
  return p
}

function refresh(plan: { id: string; patientId: string | null }) {
  revalidatePath(`/admin/planos/${plan.id}`)
  revalidatePath('/admin/planos')
  if (plan.patientId) revalidatePath(`/admin/pacientes/${plan.patientId}`)
}

/** Cria um rascunho — vazio, a partir de um modelo ou copiando outro plano. */
export async function createPlan(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({
      patientId: z.string().optional(),
      template: z.string().optional(),
      title: str(160, 'Dê um título ao plano'),
      sourceId: z.string().optional(),
    })
    .safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  let id = ''
  try {
    const user = await requireTeam('clinico')
    const asTemplate = parsed.data.template === 'on'
    const patientId = asTemplate ? null : parsed.data.patientId || null
    if (!asTemplate && (!patientId || !uuid.safeParse(patientId).success)) return { error: 'Escolha o paciente.' }
    let content = emptyPlan()
    if (parsed.data.sourceId) {
      const src = await planOrThrow(parsed.data.sourceId)
      content = normalizePlan(src.content)
    }
    const [row] = await db
      .insert(schema.mealPlans)
      .values({ patientId, isTemplate: asTemplate, title: parsed.data.title, status: 'rascunho', version: 1, content, createdBy: user.id })
      .returning({ id: schema.mealPlans.id })
    id = row.id
    await audit(user, 'plano_criado', 'plano', { entityId: id, patientId })
  } catch (err) {
    return failure(err)
  }
  redirect(`/admin/planos/${id}`)
}

/**
 * Salva o rascunho e, quando solicitado, publica.
 * Publicar exige a confirmação explícita de revisão pelo profissional.
 */
export async function savePlan(planId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireTeam('clinico')
    const plan = await planOrThrow(planId)
    if (plan.status !== 'rascunho') return { error: 'Versões publicadas não podem ser alteradas. Crie uma nova versão.' }
    let json: unknown
    try {
      json = JSON.parse(String(fd.get('content') ?? ''))
    } catch {
      return { error: 'Conteúdo do plano inválido.' }
    }
    const content = planContentSchema.safeParse(json)
    if (!content.success) return { error: `Revise o plano: ${content.error.issues[0].message}` }
    const meta = z.object({ title: str(160, 'Dê um título ao plano'), validFrom: optDay, validUntil: optDay }).safeParse({
      title: fd.get('title') ?? '',
      validFrom: fd.get('validFrom') ?? '',
      validUntil: fd.get('validUntil') ?? '',
    })
    if (!meta.success) return { error: meta.error.issues[0].message }
    if (meta.data.validFrom && meta.data.validUntil && meta.data.validUntil < meta.data.validFrom) return { error: 'A validade final precisa ser depois da inicial.' }

    await db
      .update(schema.mealPlans)
      .set({ content: content.data, ...meta.data, updatedAt: new Date() })
      .where(eq(schema.mealPlans.id, plan.id))

    if (fd.get('intent') !== 'publish') {
      await audit(user, 'plano_rascunho_salvo', 'plano', { entityId: plan.id, patientId: plan.patientId })
      refresh(plan)
      return { ok: true, message: 'Rascunho salvo. O paciente ainda não vê esta versão.' }
    }

    if (plan.isTemplate || !plan.patientId) return { error: 'Modelos não são publicados; use-os para criar planos de pacientes.' }
    if (fd.get('reviewed') !== 'on') return { error: 'Confirme que revisou o plano antes de publicar.', fieldErrors: { reviewed: 'Confirmação obrigatória' } }
    if (countItems(content.data) === 0) return { error: 'O plano precisa ter ao menos uma refeição com alimentos.' }
    for (const d of content.data.days) {
      if (d.meals.length === 0) return { error: `O dia “${d.label}” está sem refeições.` }
      for (const m of d.meals)
        for (const o of m.options) {
          if (o.items.length === 0) return { error: `“${m.name}” (${o.label}, ${d.label}) está sem alimentos.` }
          if (content.data.mode === 'calculado' && o.items.some((it) => it.per100 && !(it.grams && it.grams > 0)))
            return { error: `Há alimento sem quantidade em “${m.name}” (${d.label}).` }
        }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.mealPlans)
        .set({ status: 'arquivado', updatedAt: new Date() })
        .where(and(eq(schema.mealPlans.patientId, plan.patientId!), eq(schema.mealPlans.status, 'publicado')))
      await tx
        .update(schema.mealPlans)
        .set({ status: 'publicado', publishedAt: new Date(), publishedBy: user.id, updatedAt: new Date() })
        .where(eq(schema.mealPlans.id, plan.id))
    })
    const [p] = await db
      .select({ userId: schema.patients.userId, email: schema.patients.email, name: schema.patients.fullName })
      .from(schema.patients)
      .where(eq(schema.patients.id, plan.patientId))
    await notifyUser(p?.userId, 'Seu plano alimentar foi atualizado', meta.data.title, '/paciente/plano')
    if (p?.userId) {
      // Push imediato (a tela aberta do paciente também atualiza sozinha em poucos segundos).
      await pushToUser(p.userId, 'plano', { title: 'Seu plano alimentar foi atualizado', body: meta.data.title, url: '/paciente/plano', tag: 'plano' })
      if (p.email) {
        const s = await getSettings()
        await sendEmail(
          p.email,
          'Seu plano alimentar foi atualizado',
          `Olá, ${p.name.split(' ')[0]}!\n\n${s.professionalName} ativou uma nova versão do seu plano alimentar (“${meta.data.title}”).\nAbra a área do paciente para ver: ${process.env.APP_URL ?? 'http://localhost:3000'}/paciente/plano\n`,
        )
      }
    }
    await audit(user, 'plano_publicado', 'plano', { entityId: plan.id, patientId: plan.patientId, details: { versao: plan.version } })
    refresh(plan)
    return { ok: true, message: 'Plano publicado na área do paciente.' }
  } catch (err) {
    return failure(err)
  }
}

/** Nova versão editável a partir de uma versão publicada/arquivada (o histórico é preservado). */
export async function newPlanVersion(planId: string): Promise<void> {
  const user = await requireTeam('clinico')
  const plan = await planOrThrow(planId)
  if (!plan.patientId) redirect(`/admin/planos/${plan.id}`)
  const [draft] = await db
    .select({ id: schema.mealPlans.id })
    .from(schema.mealPlans)
    .where(and(eq(schema.mealPlans.patientId, plan.patientId), eq(schema.mealPlans.status, 'rascunho'), eq(schema.mealPlans.parentId, plan.id)))
  if (draft) redirect(`/admin/planos/${draft.id}`)
  const [{ v }] = await db.select({ v: max(schema.mealPlans.version) }).from(schema.mealPlans).where(eq(schema.mealPlans.patientId, plan.patientId))
  const [row] = await db
    .insert(schema.mealPlans)
    .values({
      patientId: plan.patientId,
      title: plan.title,
      status: 'rascunho',
      version: (v ?? plan.version) + 1,
      parentId: plan.id,
      content: normalizePlan(plan.content),
      validFrom: null,
      validUntil: null,
      createdBy: user.id,
    })
    .returning({ id: schema.mealPlans.id })
  await audit(user, 'plano_nova_versao', 'plano', { entityId: row.id, patientId: plan.patientId })
  redirect(`/admin/planos/${row.id}`)
}

export async function setPlanHistoryVisibility(planId: string, visible: boolean): Promise<void> {
  const user = await requireTeam('clinico')
  const plan = await planOrThrow(planId)
  await db.update(schema.mealPlans).set({ visibleInHistory: visible }).where(eq(schema.mealPlans.id, plan.id))
  await audit(user, visible ? 'plano_versao_liberada' : 'plano_versao_ocultada', 'plano', { entityId: plan.id, patientId: plan.patientId })
  refresh(plan)
}

export async function deletePlanDraft(planId: string): Promise<void> {
  const user = await requireTeam('clinico')
  const plan = await planOrThrow(planId)
  if (plan.status !== 'rascunho') throw new UserError('Somente rascunhos podem ser excluídos.')
  await db.delete(schema.mealPlans).where(eq(schema.mealPlans.id, plan.id))
  await audit(user, 'plano_rascunho_excluido', 'plano', { entityId: plan.id, patientId: plan.patientId })
  refresh(plan)
  redirect(plan.patientId ? `/admin/pacientes/${plan.patientId}?aba=planos` : '/admin/planos')
}

/** Salva uma cópia do plano como modelo reutilizável (sem dados do paciente). */
export async function savePlanAsTemplate(planId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const title = str(160, 'Dê um nome ao modelo').safeParse(fd.get('templateTitle'))
  if (!title.success) return { fieldErrors: { templateTitle: title.error.issues[0].message }, error: title.error.issues[0].message }
  try {
    const user = await requireTeam('clinico')
    const plan = await planOrThrow(planId)
    const [row] = await db
      .insert(schema.mealPlans)
      .values({ patientId: null, isTemplate: true, title: title.data, status: 'rascunho', version: 1, content: normalizePlan(plan.content), createdBy: user.id })
      .returning({ id: schema.mealPlans.id })
    await audit(user, 'modelo_criado_de_plano', 'plano', { entityId: row.id, details: { origem: plan.id } })
    revalidatePath('/admin/planos')
    return { ok: true, message: `Modelo “${title.data}” salvo. Ele aparece em “Começar a partir de” ao criar planos.` }
  } catch (err) {
    return failure(err)
  }
}
