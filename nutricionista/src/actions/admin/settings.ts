'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { STAFF_PERMISSIONS } from '@/lib/auth/permissions'
import { audit } from '@/lib/audit'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { hashToken, newToken } from '@/lib/auth/tokens'
import { onlyDigits, parseMoney } from '@/lib/format'
import { sendEmail } from '@/lib/notify'
import { IMAGE_TYPES, saveUpload } from '@/lib/storage'
import { checkbox, email, int, optDay, optEmail, optStr, str, time, uuid } from '@/lib/validation'

const lines = (v: string | null | undefined) =>
  (v ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function refreshAll() {
  revalidatePath('/', 'layout')
}

/* ------------------------------- perfil ------------------------------- */

const profileSchema = z.object({
  professionalName: str(120, 'Informe o nome'),
  professionalTitle: str(80, 'Informe o título'),
  registry: optStr(120),
  bio: z.string().trim().max(3000),
  specialties: z.string().max(2000).optional(),
  method: z.string().trim().max(3000),
  differentials: z.string().max(3000).optional(),
  howItWorks: z.string().max(3000).optional(),
  address: optStr(300),
  hoursText: optStr(200),
  modalityText: optStr(200),
  whatsapp: z
    .string()
    .optional()
    .transform((v) => (v ? onlyDigits(v) : null))
    .refine((v) => v === null || (v.length >= 12 && v.length <= 13), 'Use o formato 55 + DDD + número'),
  instagram: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\//.test(v), 'Use o link completo (https://…)'),
  contactEmail: optEmail,
  privacyContact: optStr(200),
  anamneseUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\//.test(v), 'Use o link completo (https://…)'),
  waterMlPerKg: z.coerce.number().int().min(20, 'Entre 20 e 60').max(60, 'Entre 20 e 60'),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
  demoBanner: checkbox,
})

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  try {
    const user = await requireTeam('config')
    const howItWorks = lines(d.howItWorks).map((l) => {
      const [title, ...rest] = l.split('|')
      return { title: title.trim(), text: rest.join('|').trim() }
    })
    const update: Partial<typeof schema.settings.$inferInsert> = {
      ...d,
      specialties: lines(d.specialties),
      differentials: lines(d.differentials),
      howItWorks,
      updatedAt: new Date(),
    }
    for (const kind of ['photo', 'logo'] as const) {
      const file = fd.get(kind)
      if (file instanceof File && file.size > 0) {
        const saved = await saveUpload(file, IMAGE_TYPES)
        if ('error' in saved) return { fieldErrors: { [kind]: saved.error! }, error: saved.error }
        const [f] = await db
          .insert(schema.files)
          .values({ kind: 'publico', title: kind === 'photo' ? 'Foto profissional' : 'Logotipo', mime: saved.mime, size: saved.size, storageKey: saved.key, isPublic: true, uploadedBy: user.id })
          .returning({ id: schema.files.id })
        if (kind === 'photo') update.photoFileId = f.id
        else update.logoFileId = f.id
      }
    }
    if (fd.get('removeLogo') === 'on') update.logoFileId = null
    if (fd.get('removePhoto') === 'on') update.photoFileId = null
    await db.update(schema.settings).set(update).where(eq(schema.settings.id, 1))
    await audit(user, 'perfil_atualizado', 'configuracoes')
    refreshAll()
    return { ok: true, message: 'Perfil e identidade visual atualizados.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------------ serviços ------------------------------ */

const serviceSchema = z.object({
  id: z.string().optional(),
  name: str(120, 'Informe o nome'),
  description: z.string().trim().max(500),
  modality: z.enum(['presencial', 'online', 'ambos']),
  durationMinutes: int(10, 240),
  price: z
    .string()
    .optional()
    .transform((v) => (v ? parseMoney(v) : 0))
    .refine((v) => v !== null, 'Valor inválido'),
  sort: int(0, 99),
  isPublic: checkbox,
  active: checkbox,
})

export async function saveService(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = serviceSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const { id, price, ...d } = parsed.data
  try {
    const user = await requireTeam('config')
    const values = { ...d, priceCents: price ?? 0 }
    if (id) {
      if (!uuid.safeParse(id).success) return { error: 'Serviço inválido.' }
      await db.update(schema.services).set(values).where(eq(schema.services.id, id))
    } else {
      await db.insert(schema.services).values(values)
    }
    await audit(user, id ? 'servico_editado' : 'servico_criado', 'servico', { entityId: id ?? null, details: { nome: d.name } })
    refreshAll()
    return { ok: true, message: 'Serviço salvo.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------ horários e agendamento ------------------------ */

export async function saveSchedule(_: ActionState, fd: FormData): Promise<ActionState> {
  const rules = z
    .object({
      slotStepMinutes: int(5, 120),
      bufferMinutes: int(0, 120),
      minNoticeHours: int(0, 720),
      maxDaysAhead: int(1, 365),
      leadRetentionDays: int(30, 730),
      financeEnabled: checkbox,
    })
    .safeParse(formObject(fd))
  if (!rules.success) return zodErrors(rules.error)
  const windows: { weekday: number; start: string; end: string }[] = []
  for (let wd = 0; wd < 7; wd++) {
    for (const n of [1, 2]) {
      const start = String(fd.get(`d${wd}_s${n}`) ?? '')
      const end = String(fd.get(`d${wd}_e${n}`) ?? '')
      if (!start && !end) continue
      if (!time.safeParse(start).success || !time.safeParse(end).success || end <= start) {
        return { error: 'Revise os horários: cada período precisa de início e fim, com o fim depois do início.', fieldErrors: { [`d${wd}`]: 'Período inválido' } }
      }
      windows.push({ weekday: wd, start, end })
    }
  }
  for (let wd = 0; wd < 7; wd++) {
    const w = windows.filter((x) => x.weekday === wd).sort((a, b) => a.start.localeCompare(b.start))
    if (w.length === 2 && w[1].start < w[0].end) return { error: 'Os dois períodos de um mesmo dia não podem se sobrepor.', fieldErrors: { [`d${wd}`]: 'Períodos sobrepostos' } }
  }
  try {
    const user = await requireTeam('config')
    await db.transaction(async (tx) => {
      await tx.delete(schema.workingHours)
      if (windows.length) await tx.insert(schema.workingHours).values(windows)
      await tx.update(schema.settings).set({ ...rules.data, updatedAt: new Date() }).where(eq(schema.settings.id, 1))
    })
    await audit(user, 'horarios_atualizados', 'configuracoes')
    refreshAll()
    return { ok: true, message: 'Horários e regras de agendamento salvos.' }
  } catch (err) {
    return failure(err)
  }
}

export async function saveTemplates(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ confirmacao: str(1000, 'Obrigatório'), lembrete: str(1000, 'Obrigatório'), cancelamento: str(1000, 'Obrigatório') })
    .safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const user = await requireTeam('config')
    await db.update(schema.settings).set({ templates: parsed.data, updatedAt: new Date() }).where(eq(schema.settings.id, 1))
    await audit(user, 'modelos_mensagem_atualizados', 'configuracoes')
    refreshAll()
    return { ok: true, message: 'Modelos de mensagem salvos.' }
  } catch (err) {
    return failure(err)
  }
}

/* ------------------------ depoimentos e dúvidas ------------------------ */

const testimonialSchema = z.object({
  authorDisplay: str(80, 'Como o autor será identificado (ex.: iniciais)'),
  text: str(800, 'Escreva o depoimento'),
  authorizedAt: optDay,
  published: checkbox,
})

export async function addTestimonial(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = testimonialSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  if (parsed.data.published && !parsed.data.authorizedAt) {
    return { fieldErrors: { authorizedAt: 'Informe a data da autorização' }, error: 'Só é possível publicar depoimentos com autorização registrada.' }
  }
  try {
    const user = await requireTeam('site')
    await db.insert(schema.testimonials).values(parsed.data)
    await audit(user, 'depoimento_criado', 'site')
    refreshAll()
    return { ok: true, message: 'Depoimento salvo.' }
  } catch (err) {
    return failure(err)
  }
}

export async function toggleTestimonial(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  const [t] = await db.select().from(schema.testimonials).where(eq(schema.testimonials.id, id))
  if (!t) return
  if (!t.published && !t.authorizedAt) return // sem autorização, nunca publica
  await db.update(schema.testimonials).set({ published: !t.published }).where(eq(schema.testimonials.id, id))
  await audit(user, t.published ? 'depoimento_ocultado' : 'depoimento_publicado', 'site', { entityId: id })
  refreshAll()
}

export async function deleteTestimonial(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  await db.delete(schema.testimonials).where(eq(schema.testimonials.id, id))
  await audit(user, 'depoimento_excluido', 'site', { entityId: id })
  refreshAll()
}

export async function saveFaq(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ id: z.string().optional(), question: str(300, 'Escreva a pergunta'), answer: str(2000, 'Escreva a resposta'), sort: int(0, 99), published: checkbox })
    .safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const { id, ...d } = parsed.data
  try {
    const user = await requireTeam('site')
    if (id && uuid.safeParse(id).success) await db.update(schema.faqs).set(d).where(eq(schema.faqs.id, id))
    else await db.insert(schema.faqs).values(d)
    await audit(user, 'faq_salva', 'site')
    refreshAll()
    return { ok: true, message: 'Pergunta salva.' }
  } catch (err) {
    return failure(err)
  }
}

export async function deleteFaq(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  await db.delete(schema.faqs).where(eq(schema.faqs.id, id))
  await audit(user, 'faq_excluida', 'site', { entityId: id })
  refreshAll()
}

/* -------------------------------- equipe -------------------------------- */

const permList = Object.keys(STAFF_PERMISSIONS)

export async function inviteStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ name: str(120, 'Informe o nome'), email }).safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const permissions = fd.getAll('permissions').map(String).filter((p) => permList.includes(p))
  try {
    const user = await requireTeam('config')
    const [exists] = await db.select().from(schema.users).where(eq(schema.users.email, parsed.data.email))
    if (exists) return { fieldErrors: { email: 'E-mail já cadastrado' }, error: 'Já existe um usuário com este e-mail.' }
    const [u] = await db.insert(schema.users).values({ ...parsed.data, role: 'staff', permissions }).returning({ id: schema.users.id })
    const token = newToken()
    await db.insert(schema.authTokens).values({ id: hashToken(token), userId: u.id, type: 'convite', expiresAt: new Date(Date.now() + 3 * 86_400_000) })
    const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/redefinir-senha?token=${token}`
    const sent = await sendEmail(parsed.data.email, 'Acesso ao painel do consultório', `Olá, ${parsed.data.name}! Crie sua senha de acesso (link válido por 3 dias):\n${url}`)
    await audit(user, 'membro_equipe_convidado', 'usuario', { entityId: u.id, details: { permissions } })
    revalidatePath('/admin/configuracoes')
    return { ok: true, message: `${sent ? 'Convite enviado por e-mail. ' : ''}Link de primeiro acesso (válido por 3 dias, uso único): ${url}` }
  } catch (err) {
    return failure(err)
  }
}

export async function updateStaff(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const permissions = fd.getAll('permissions').map(String).filter((p) => permList.includes(p))
  const active = fd.get('isActive') === 'on'
  try {
    const user = await requireTeam('config')
    if (!uuid.safeParse(id).success) return { error: 'Usuário inválido.' }
    await db.update(schema.users).set({ permissions, isActive: active, updatedAt: new Date() }).where(and(eq(schema.users.id, id), eq(schema.users.role, 'staff')))
    if (!active) await db.delete(schema.sessions).where(eq(schema.sessions.userId, id))
    await audit(user, 'permissoes_alteradas', 'usuario', { entityId: id, details: { permissions, ativo: active } })
    revalidatePath('/admin/configuracoes')
    return { ok: true, message: 'Permissões atualizadas.' }
  } catch (err) {
    return failure(err)
  }
}

/* ----------------------------- interessados ----------------------------- */

export async function setLeadStatus(id: string, status: 'novo' | 'contatado' | 'convertido' | 'descartado'): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  await db.update(schema.leads).set({ status }).where(eq(schema.leads.id, id))
  await audit(user, `interessado_${status}`, 'interessado', { entityId: id })
  revalidatePath('/admin/interessados')
}

export async function deleteLead(id: string): Promise<void> {
  const user = await requireTeam('site')
  if (!uuid.safeParse(id).success) return
  await db.delete(schema.leads).where(eq(schema.leads.id, id))
  await audit(user, 'interessado_excluido', 'interessado', { entityId: id })
  revalidatePath('/admin/interessados')
}

/* ------------------------- acompanhamento e chat ------------------------- */

const trackingSchema = z.object({ adherenceGood: int(10, 100), adherenceLow: int(0, 99) })

/** Limites do painel de Acompanhamento (% de refeições feitas nos últimos 7 dias). */
export async function saveTrackingSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = trackingSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  if (parsed.data.adherenceLow >= parsed.data.adherenceGood) return { fieldErrors: { adherenceLow: 'Use um valor menor que o de “em dia”' }, error: 'O limite de “com dificuldade” precisa ser menor que o de “em dia”.' }
  try {
    const user = await requireTeam('clinico')
    await db.update(schema.settings).set({ ...parsed.data, updatedAt: new Date() }).where(eq(schema.settings.id, 1))
    await audit(user, 'acompanhamento_limites', 'configuracoes', { details: parsed.data })
    revalidatePath('/admin/acompanhamento')
    return { ok: true, message: 'Limites atualizados.' }
  } catch (err) {
    return failure(err)
  }
}

const chatSchema = z.object({
  quickReplies: optStr(3000),
  chatAutoReply: optStr(500),
  chatStart: z.union([z.literal(''), time]).optional(),
  chatEnd: z.union([z.literal(''), time]).optional(),
})

/** Respostas rápidas, horário de atendimento do chat e resposta automática fora dele. */
export async function saveChatSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = chatSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  const d = parsed.data
  const weekdays = fd.getAll('chatDays').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
  const hasHours = !!d.chatStart && !!d.chatEnd
  if (hasHours && d.chatStart! >= d.chatEnd!) return { fieldErrors: { chatEnd: 'O fim precisa ser depois do início' }, error: 'Revise o horário de atendimento.' }
  if (hasHours && weekdays.length === 0) return { error: 'Escolha ao menos um dia de atendimento.' }
  try {
    const user = await requireTeam('config')
    await db
      .update(schema.settings)
      .set({
        quickReplies: lines(d.quickReplies).map((l) => l.slice(0, 300)).slice(0, 20),
        chatAutoReply: d.chatAutoReply,
        chatHours: hasHours ? { start: d.chatStart!, end: d.chatEnd!, weekdays } : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.settings.id, 1))
    await audit(user, 'chat_configurado', 'configuracoes')
    revalidatePath('/admin/configuracoes')
    return { ok: true, message: 'Configurações do chat salvas.' }
  } catch (err) {
    return failure(err)
  }
}
