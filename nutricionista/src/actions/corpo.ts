'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { accessExpired } from '@/lib/auth/patient-gate'
import { audit } from '@/lib/audit'
import { failure, formObject, UserError, zodErrors, type ActionState } from '@/lib/action'
import { getSettings } from '@/lib/settings'
import { currentPublishedPlan, featuresOf } from '@/lib/patient-context'
import { FOTOS_CORPO, FOTOS_RELATORIO, hasConsent, recordHeight, setConsent } from '@/lib/corpo-server'
import { deletePhoto, saveProgressPhotos } from '@/lib/photos'
import { deleteUpload, IMAGE_TYPES, saveUpload } from '@/lib/storage'
import { notifyTeam } from '@/lib/team'
import { rateLimit } from '@/lib/rate-limit'
import { dayForWeekday, normalizePlan, sortedMeals } from '@/lib/plan'
import { todayIn, weekdayOf, zonedParts } from '@/lib/time'
import { day, optNum, optStr, uuid } from '@/lib/validation'

/**
 * Parte 7: perfil físico, fotos do corpo e fotos do prato. O patientId vem sempre da sessão.
 */

const revalidateBody = () => {
  revalidatePath('/paciente')
  revalidatePath('/paciente/meu-corpo')
  revalidatePath('/paciente/evolucao')
}

/* ------------------------------ dados do corpo ------------------------------ */

const bodyDataSchema = z.object({
  birthDate: day,
  sex: z.enum(['F', 'M'], { message: 'Escolha uma opção' }),
  heightCm: optNum(100, 230).refine((v) => v != null, 'Informe a altura entre 100 e 230 cm'),
})

/** "Complete seus dados": nascimento, sexo e altura (a altura entra no histórico). */
export async function saveBodyData(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const parsed = bodyDataSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const d = parsed.data
  if (d.birthDate >= today || d.birthDate < '1900-01-01') return { fieldErrors: { birthDate: 'Data inválida' }, error: 'Revise a data de nascimento.' }
  try {
    await db.update(schema.patients).set({ birthDate: d.birthDate, sex: d.sex, updatedAt: new Date() }).where(eq(schema.patients.id, user.patientId))
    await recordHeight(user.patientId, today, d.heightCm!, 'paciente', user.id)
    await audit(user, 'dados_corpo_atualizados', 'paciente', { entityId: user.patientId, patientId: user.patientId, details: { campos: ['nascimento', 'sexo', 'altura'] } })
    revalidateBody()
    return { ok: true, message: 'Dados salvos. Seu card "Meu corpo" já está completo.' }
  } catch (err) {
    return failure(err)
  }
}

/** Nova altura (entra no histórico; o IMC de datas antigas continua com a altura daquela época). */
export async function updateOwnHeight(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const h = optNum(100, 230).safeParse(fd.get('heightCm') ?? '')
  if (!h.success || h.data == null) return { fieldErrors: { heightCm: 'Informe a altura entre 100 e 230 cm' }, error: 'Altura inválida.' }
  const s = await getSettings()
  try {
    await recordHeight(user.patientId, todayIn(s.timezone), h.data, 'paciente', user.id)
    await audit(user, 'altura_registrada', 'paciente', { entityId: user.patientId, patientId: user.patientId, details: { origem: 'cliente' } })
    revalidateBody()
    return { ok: true, message: 'Altura atualizada.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ consentimentos ------------------------------ */

/** Consentimento específico para fotos do corpo (consents, tipo fotos_corpo, com versão e data). */
export async function setBodyPhotoConsent(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const on = fd.get('aceite') === 'on'
  if (fd.get('intent') !== 'revogar' && !on) return { fieldErrors: { aceite: 'Marque para autorizar' }, error: 'Marque a autorização para continuar.' }
  const grant = fd.get('intent') !== 'revogar'
  await setConsent(user.id, user.patientId, FOTOS_CORPO, grant)
  await audit(user, grant ? 'consentimento_fotos_corpo' : 'consentimento_fotos_corpo_revogado', 'consentimento', { patientId: user.patientId })
  revalidateBody()
  revalidatePath('/paciente/meu-corpo/fotos')
  revalidatePath('/paciente/checkin')
  return { ok: true, message: grant ? 'Autorização registrada. Agora você pode enviar fotos do corpo.' : 'Autorização retirada. Novas fotos do corpo não podem ser enviadas.' }
}

/** Fotos no relatório de evolução (PDF): só com esta autorização marcada. */
export async function setReportPhotos(fd: FormData): Promise<void> {
  const user = await requirePatient()
  const on = fd.get('fotos') === 'on'
  await setConsent(user.id, user.patientId, FOTOS_RELATORIO, on)
  await audit(user, on ? 'consentimento_fotos_relatorio' : 'consentimento_fotos_relatorio_revogado', 'consentimento', { patientId: user.patientId })
  revalidatePath('/paciente/evolucao')
}

/* ------------------------------ fotos do corpo ------------------------------ */

/** Envio das fotos do corpo (frente, lado, costas), com o peso do dia opcional ligado às fotos. */
export async function sendBodyPhotos(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  if (await accessExpired(user.patientId)) return { error: 'Seu plano terminou. Renove para voltar a enviar.' }
  if (!(await featuresOf(user.patientId)).fotosCorpo) return { error: 'O envio de fotos do corpo não está liberado para você.' }
  if (!(await hasConsent(user.patientId, FOTOS_CORPO))) return { error: 'Para enviar fotos do corpo, autorize primeiro (é só uma vez).' }
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const date = day.safeParse(fd.get('date') || today)
  if (!date.success || date.data > today) return { fieldErrors: { date: 'Data inválida' }, error: 'Revise a data.' }
  const kg = optNum(20, 350).safeParse(fd.get('weightKg') ?? '')
  if (!kg.success) return { fieldErrors: { weightKg: 'Peso entre 20 e 350 kg' }, error: 'Revise o peso.' }
  if (!rateLimit(`upload:${user.id}`, 30, 3_600_000)) return { error: 'Limite de envios atingido. Tente mais tarde.' }
  try {
    const r = await saveProgressPhotos(user.patientId, user.id, date.data, fd, { weightKg: kg.data, source: 'paciente' })
    if ('error' in r) return { error: r.error }
    await notifyTeam('clinico', 'Novas fotos do corpo', user.name, `/admin/pacientes/${user.patientId}?aba=evolucao`, user.patientId)
    await audit(user, 'fotos_evolucao_enviadas', 'foto', { patientId: user.patientId, details: { quantidade: r.saved, peso: kg.data != null } })
    revalidateBody()
    return { ok: true, message: `${r.saved === 1 ? 'Foto salva' : `${r.saved} fotos salvas`}${kg.data ? ' com o peso do dia' : ''}. Só você e o seu coach podem ver.` }
  } catch (err) {
    return failure(err)
  }
}

/** O cliente pode apagar qualquer foto do corpo dele. */
export async function deleteOwnBodyPhoto(id: string): Promise<void> {
  const user = await requirePatient()
  if (!uuid.safeParse(id).success) return
  if (await deletePhoto(user.patientId, id)) await audit(user, 'foto_evolucao_excluida', 'foto', { entityId: id, patientId: user.patientId })
  revalidateBody()
}

/* ------------------------------ fotos do prato ------------------------------ */

async function savePlateFile(user: { id: string; patientId: string }, file: File, title: string) {
  if (!rateLimit(`upload:${user.id}`, 30, 3_600_000)) throw new UserError('Limite de envios atingido. Tente mais tarde.')
  const up = await saveUpload(file, IMAGE_TYPES)
  if ('error' in up) return { error: up.error! }
  const [f] = await db
    .insert(schema.files)
    .values({ patientId: user.patientId, uploadedBy: user.id, kind: 'foto_refeicao', title, mime: up.mime, size: up.size, storageKey: up.key, visibleToPatient: true })
    .returning({ id: schema.files.id })
  return { id: f.id }
}

async function dropFile(fileId: string | null, patientId: string) {
  if (!fileId) return
  const [f] = await db.select().from(schema.files).where(and(eq(schema.files.id, fileId), eq(schema.files.patientId, patientId)))
  if (!f) return
  await db.delete(schema.files).where(eq(schema.files.id, f.id))
  await deleteUpload(f.storageKey)
}

async function canLogMeals(patientId: string) {
  if (await accessExpired(patientId)) return 'Seu plano terminou. Renove para voltar a registrar.'
  if (!(await featuresOf(patientId)).diario) return 'O diário está desativado para a sua conta.'
  return null
}

/**
 * "Foto do prato" numa refeição de hoje: cria (ou atualiza) o registro do diário daquela refeição
 * com a foto. Sem registro ainda, entra como "segui o plano" (o cliente pode trocar no diário).
 * Reenviar troca a foto do mesmo registro: nunca duplica.
 */
export async function savePlatePhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const blocked = await canLogMeals(user.patientId)
  if (blocked) return { error: blocked }
  const mealKey = String(fd.get('mealKey') ?? '')
  if (!/^[\w-]{1,40}:[\w-]{1,40}$/.test(mealKey)) return { error: 'Refeição inválida.' }
  const photo = fd.get('photo')
  if (!(photo instanceof File) || photo.size === 0) return { fieldErrors: { photo: 'Escolha uma foto' }, error: 'Escolha ou tire uma foto do prato.' }
  const s = await getSettings()
  const today = todayIn(s.timezone)
  // A refeição precisa existir no plano de hoje (nome e horário vêm do servidor, não do navegador).
  const plan = await currentPublishedPlan(user.patientId)
  const content = plan ? normalizePlan(plan.content) : null
  const planDay = content ? dayForWeekday(content, weekdayOf(today)) : null
  const meal = planDay ? sortedMeals(planDay).find((m) => `${planDay.id}:${m.id}` === mealKey) : null
  if (!plan || !planDay || !meal) return { error: 'Esta refeição não está no plano de hoje.' }
  const optionId = String(fd.get('optionId') ?? '').slice(0, 40) || meal.options[0]?.id || null
  try {
    const saved = await savePlateFile(user, photo, `Prato ${meal.name} ${today}`)
    if ('error' in saved) return { fieldErrors: { photo: saved.error ?? 'Formato não permitido' }, error: saved.error }
    const [existing] = await db
      .select({ id: schema.diaryEntries.id, photoFileId: schema.diaryEntries.photoFileId })
      .from(schema.diaryEntries)
      .where(and(eq(schema.diaryEntries.patientId, user.patientId), eq(schema.diaryEntries.date, today), eq(schema.diaryEntries.mealKey, mealKey)))
    if (existing) {
      await db.update(schema.diaryEntries).set({ photoFileId: saved.id }).where(eq(schema.diaryEntries.id, existing.id))
      if (existing.photoFileId && existing.photoFileId !== saved.id) await dropFile(existing.photoFileId, user.patientId)
    } else {
      await db.insert(schema.diaryEntries).values({
        patientId: user.patientId,
        date: today,
        time: meal.time || zonedParts(new Date(), s.timezone).time,
        meal: meal.name,
        mealKey,
        foods: 'Segui o plano',
        adherence: 'total',
        photoFileId: saved.id,
      })
    }
    // Marca a refeição na tela Hoje, sem trocar o que o cliente já tinha marcado.
    await db
      .insert(schema.mealLogs)
      .values({ patientId: user.patientId, date: today, planId: plan.id, mealKey, optionId, status: 'feita' })
      .onConflictDoNothing({ target: [schema.mealLogs.patientId, schema.mealLogs.date, schema.mealLogs.mealKey] })
    await audit(user, 'foto_prato_enviada', 'diario', { patientId: user.patientId, details: { refeicao: meal.name, substituiu: Boolean(existing?.photoFileId) } })
    revalidatePath('/paciente')
    revalidatePath('/paciente/diario')
    return { ok: true, message: existing ? `Foto do ${meal.name.toLowerCase()} atualizada.` : `Foto salva no diário: ${meal.name} (segui o plano).` }
  } catch (err) {
    return failure(err)
  }
}

/** Foto avulsa ("comi outra coisa"), com texto opcional: vira um registro do diário fora do plano. */
export async function saveLoosePhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requirePatient()
  const blocked = await canLogMeals(user.patientId)
  if (blocked) return { error: blocked }
  const photo = fd.get('photo')
  if (!(photo instanceof File) || photo.size === 0) return { fieldErrors: { photo: 'Escolha uma foto' }, error: 'Escolha ou tire uma foto do prato.' }
  const text = optStr(300).safeParse(fd.get('text') ?? '')
  if (!text.success) return { fieldErrors: { text: 'Texto longo demais' }, error: 'Revise o texto.' }
  const s = await getSettings()
  const now = zonedParts(new Date(), s.timezone)
  try {
    const saved = await savePlateFile(user, photo, `Prato avulso ${now.date}`)
    if ('error' in saved) return { fieldErrors: { photo: saved.error ?? 'Formato não permitido' }, error: saved.error }
    await db.insert(schema.diaryEntries).values({
      patientId: user.patientId,
      date: now.date,
      time: now.time,
      meal: 'Fora do plano',
      foods: text.data || 'Foto do prato',
      adherence: 'nao_seguiu',
      photoFileId: saved.id,
    })
    await audit(user, 'foto_prato_enviada', 'diario', { patientId: user.patientId, details: { avulsa: true } })
    revalidatePath('/paciente')
    revalidatePath('/paciente/diario')
    return { ok: true, message: 'Foto salva no seu diário.' }
  } catch (err) {
    return failure(err)
  }
}
