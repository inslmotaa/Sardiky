import 'server-only'
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_FEATURES, DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import { getSettings } from './settings'
import { channelsOf } from './lembretes'
import { claimReminder } from './push'
import { deliverEmail } from './notify'
import { inQuietHours } from './quiet'
import { dayForWeekday, normalizePlan, sortedMeals } from './plan'
import { waterGoalMl } from './nutricao'
import { timeToMinutes, zonedParts } from './time'
import { acessoVencido } from './renovacao'

const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/**
 * No máximo 2 tentativas por lembrete (reminder_log): cada chamada usa uma tentativa; se der certo,
 * marca como enviado e não repete. Uma falha fica registrada e não derruba os outros canais.
 */
export async function tryAtMostTwice(userId: string, kind: string, base: string, run: () => Promise<{ ok: boolean; reason?: string }>) {
  const [done] = await db
    .select({ id: schema.reminderLog.id })
    .from(schema.reminderLog)
    .where(and(eq(schema.reminderLog.userId, userId), eq(schema.reminderLog.kind, kind), eq(schema.reminderLog.key, `${base}:ok`)))
  if (done) return 'ja-enviado' as const
  for (const n of [1, 2]) {
    if (!(await claimReminder(userId, kind, `${base}:tentativa${n}`))) continue
    try {
      const r = await run()
      if (r.ok) {
        await claimReminder(userId, kind, `${base}:ok`)
        return 'enviado' as const
      }
      console.warn(`[lembretes] ${kind} ${base}: tentativa ${n} sem sucesso (${r.reason ?? 'erro'})`)
    } catch (err) {
      console.error(`[lembretes] ${kind} ${base}: tentativa ${n} falhou`, err)
    }
    return 'falhou' as const
  }
  return 'desistiu' as const
}

/** Texto do resumo: refeições e horários de hoje e a meta de água. Sem dados além do plano do próprio cliente. */
export function resumoTexto(o: { firstName: string; dateLabel: string; meals: { name: string; time: string }[]; waterMl: number | null; appUrl: string; unsubscribeUrl: string }) {
  const lines = [
    `Bom dia, ${o.firstName}!`,
    '',
    `Seu dia (${o.dateLabel}):`,
    ...(o.meals.length ? o.meals.map((m) => `• ${m.time ? `${m.time.replace(':', 'h')} · ` : ''}${m.name}`) : ['• O plano de hoje está no app.']),
    ...(o.waterMl ? ['', `Meta de água: ${(o.waterMl / 1000).toFixed(1).replace('.', ',')} litros (cerca de ${Math.ceil(o.waterMl / 250)} copos).`] : []),
    '',
    `Ver o plano completo: ${o.appUrl}/paciente/plano`,
    '',
    `Não quer mais receber este resumo? Descadastre com um clique: ${o.unsubscribeUrl}`,
  ]
  return lines.join('\n')
}

/**
 * Resumo do dia às 7h (tarefa periódica, mesma do push): só para quem ligou em Notificações,
 * fora do horário de silêncio e dentro da cota gratuita de e-mail. Uma vez por dia por cliente.
 */
export async function resumosDoDia(now = new Date()) {
  const s = await getSettings()
  const z = zonedParts(now, s.timezone)
  const nowMin = timeToMinutes(z.time)
  if (nowMin < 7 * 60 || nowMin >= 11 * 60) return { enviados: 0, falhas: 0 }
  const rows = await db
    .select({ p: schema.patients, userId: schema.users.id, email: schema.users.email, name: schema.users.name, prefs: schema.users.notificationPrefs })
    .from(schema.patients)
    .innerJoin(schema.users, eq(schema.users.id, schema.patients.userId))
    .where(and(eq(schema.patients.status, 'ativo'), eq(schema.users.isActive, true)))
  const targets = rows.filter((r) => ({ ...DEFAULT_NOTIFICATION_PREFS, ...r.prefs }).emailResumo && !acessoVencido(r.p.packageEnd, z.date))
  if (!targets.length) return { enviados: 0, falhas: 0 }
  const ids = targets.map((t) => t.p.id)
  const [plans, weights] = await Promise.all([
    db
      .select({ patientId: schema.mealPlans.patientId, content: schema.mealPlans.content })
      .from(schema.mealPlans)
      .where(and(inArray(schema.mealPlans.patientId, ids), eq(schema.mealPlans.status, 'publicado')))
      .orderBy(desc(schema.mealPlans.publishedAt)),
    db
      .select({ patientId: schema.measurements.patientId, kg: schema.measurements.weightKg })
      .from(schema.measurements)
      .where(and(inArray(schema.measurements.patientId, ids), isNotNull(schema.measurements.weightKg)))
      .orderBy(desc(schema.measurements.date)),
  ])
  let enviados = 0
  let falhas = 0
  for (const t of targets) {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...t.prefs }
    if (inQuietHours(prefs, z.time)) continue
    const plan = plans.find((x) => x.patientId === t.p.id)
    const content = plan ? normalizePlan(plan.content) : null
    const day = content ? dayForWeekday(content, z.weekday) : null
    const meals = day ? sortedMeals(day).map((m) => ({ name: m.name, time: m.time ?? '' })) : []
    const kg = weights.find((w) => w.patientId === t.p.id)?.kg
    const waterMl = { ...DEFAULT_FEATURES, ...t.p.features }.agua ? (kg ? waterGoalMl(Number(kg), s.waterMlPerKg) : 2000) : null
    const ch = await channelsOf(t.userId)
    const unsubscribeUrl = `${appUrl()}/descadastrar/${ch.unsubscribeToken}`
    const r = await tryAtMostTwice(t.userId, 'resumo_email', z.date, () =>
      deliverEmail(
        t.email,
        `Seu dia · ${s.siteName}`,
        resumoTexto({ firstName: t.name.split(' ')[0], dateLabel: z.date.split('-').reverse().join('/'), meals, waterMl, appUrl: appUrl(), unsubscribeUrl }),
        { category: 'resumo', headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } },
      ),
    )
    if (r === 'enviado') enviados++
    else if (r === 'falhou') falhas++
  }
  return { enviados, falhas }
}
