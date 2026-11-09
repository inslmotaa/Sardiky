import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import { getSettings } from './settings'
import { getPatient, currentPublishedPlan } from './patient-context'
import { normalizePlan } from './plan'
import { todayIn } from './time'
import { clientKeyOf, downloadMark, mealSlots, parseDownloadMark, remindersIcs, scheduleHash, waterSlots } from './lembretes-ics'

export const sha256 = (t: string) => createHash('sha256').update(t).digest('hex')
const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Linha de canais do usuário (criada na primeira vez, com o código de descadastro do e-mail). */
export async function channelsOf(userId: string) {
  const [row] = await db.select().from(schema.reminderChannels).where(eq(schema.reminderChannels.userId, userId))
  if (row) {
    if (row.unsubscribeToken) return row
    const [u] = await db
      .update(schema.reminderChannels)
      .set({ unsubscribeToken: randomBytes(24).toString('base64url') })
      .where(eq(schema.reminderChannels.userId, userId))
      .returning()
    return u
  }
  const [created] = await db
    .insert(schema.reminderChannels)
    .values({ userId, unsubscribeToken: randomBytes(24).toString('base64url') })
    .onConflictDoNothing()
    .returning()
  return created ?? (await db.select().from(schema.reminderChannels).where(eq(schema.reminderChannels.userId, userId)))[0]
}

/** Horários de lembrete do cliente: refeições do plano ativo e água, conforme as preferências. */
export async function reminderSlotsFor(userId: string, patientId: string) {
  const [[u], p, plan] = await Promise.all([
    db.select({ prefs: schema.users.notificationPrefs }).from(schema.users).where(eq(schema.users.id, userId)),
    getPatient(patientId),
    currentPublishedPlan(patientId),
  ])
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...u?.prefs }
  const meals = prefs.refeicoes ? mealSlots(plan ? normalizePlan(plan.content) : null, prefs) : []
  const water = prefs.agua && p.features.agua ? waterSlots(prefs) : []
  return [...meals, ...water]
}

/** Arquivo .ics dos lembretes. `previous` limpa vagas antigas no download; a assinatura não precisa. */
export async function remindersFile(userId: string, patientId: string, opts: { download: boolean }) {
  const s = await getSettings()
  const slots = await reminderSlotsFor(userId, patientId)
  const ch = opts.download ? await channelsOf(userId) : null
  const prev = parseDownloadMark(ch?.calendarDownloadedHash)
  const body = remindersIcs({
    slots,
    clientKey: clientKeyOf(userId),
    appUrl: appUrl(),
    tz: s.timezone,
    today: todayIn(s.timezone),
    calName: `Lembretes · ${s.siteName}`,
    previous: prev ? { refeicao: prev.refeicao, agua: prev.agua } : undefined,
  })
  if (opts.download)
    await db
      .update(schema.reminderChannels)
      .set({ calendarDownloadedHash: downloadMark(slots), calendarDownloadedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.reminderChannels.userId, userId))
  return body
}

/** Os horários mudaram desde o último .ics baixado? (aviso "atualize os lembretes do calendário"). */
export async function calendarOutdated(userId: string, patientId: string) {
  const [row] = await db.select().from(schema.reminderChannels).where(eq(schema.reminderChannels.userId, userId))
  const prev = parseDownloadMark(row?.calendarDownloadedHash)
  if (!prev) return false
  return prev.hash !== scheduleHash(await reminderSlotsFor(userId, patientId))
}

/** Novo link secreto de assinatura (o anterior deixa de funcionar). O banco guarda só o resumo SHA-256. */
export async function newCalendarToken(userId: string) {
  await channelsOf(userId)
  const token = randomBytes(24).toString('base64url')
  await db
    .update(schema.reminderChannels)
    .set({ calendarTokenHash: sha256(token), calendarTokenAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.reminderChannels.userId, userId))
  const https = `${appUrl()}/lembretes/${token}.ics`
  return { https, webcal: https.replace(/^https?:\/\//, 'webcal://') }
}

export async function revokeCalendarToken(userId: string) {
  await db.update(schema.reminderChannels).set({ calendarTokenHash: null, calendarTokenAt: null, updatedAt: new Date() }).where(eq(schema.reminderChannels.userId, userId))
}
