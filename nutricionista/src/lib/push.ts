import 'server-only'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { and, eq, inArray } from 'drizzle-orm'
import webpush from 'web-push'
import { db, schema } from '@/db'
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from '@/db/schema'
import { localDataDir } from './data-dir'
import { timeToMinutes } from './time'
import { can, type Permission } from './auth/permissions'

/**
 * Notificações push (Web Push com chaves VAPID).
 * Produção: defina VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e VAPID_SUBJECT (mailto:…).
 * Desenvolvimento: sem as variáveis, um par de chaves local é criado na pasta de dados.
 */

type Keys = { publicKey: string; privateKey: string; subject: string }
let keys: Keys | null | undefined

export function vapidKeys(): Keys | null {
  if (keys !== undefined) return keys
  const subject = process.env.VAPID_SUBJECT || 'mailto:contato@example.com'
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, subject }
  } else if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_PGLITE === '1') {
    const file = localDataDir('vapid.json')
    if (existsSync(file)) keys = { ...JSON.parse(readFileSync(file, 'utf8')), subject }
    else {
      const k = webpush.generateVAPIDKeys()
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(k), { mode: 0o600 })
      keys = { ...k, subject }
    }
  } else keys = null
  return keys ?? null
}

export const pushConfigured = () => vapidKeys() !== null

export type PushKind = 'refeicoes' | 'agua' | 'plano' | 'mensagens' | 'consultas' | 'lembretes' | 'pesagem' | 'equipe'
export type PushPayload = { title: string; body?: string; url?: string; tag?: string }

/** Está dentro do horário de silêncio? (janela pode atravessar a meia-noite: 22:00–07:00). */
export function inQuietHours(prefs: Pick<NotificationPrefs, 'quietStart' | 'quietEnd'>, nowHHMM: string) {
  const now = timeToMinutes(nowHHMM)
  const a = timeToMinutes(prefs.quietStart)
  const b = timeToMinutes(prefs.quietEnd)
  if (a === b) return false
  return a < b ? now >= a && now < b : now >= a || now < b
}

/** Envia para todos os aparelhos do usuário, respeitando as preferências do tipo. Remove inscrições expiradas. */
export async function pushToUser(userId: string, kind: PushKind, payload: PushPayload, opts: { nowHHMM?: string; ignoreQuiet?: boolean } = {}) {
  const k = vapidKeys()
  if (!k) return 0
  const [u] = await db.select({ prefs: schema.users.notificationPrefs, role: schema.users.role }).from(schema.users).where(eq(schema.users.id, userId))
  if (!u) return 0
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...u.prefs }
  if (u.role === 'patient' && kind !== 'equipe' && prefs[kind] === false) return 0
  if (u.role === 'patient' && !opts.ignoreQuiet && opts.nowHHMM && inQuietHours(prefs, opts.nowHHMM)) return 0
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId))
  let sent = 0
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ ...payload, url: payload.url ?? '/' }),
        { vapidDetails: { subject: k.subject, publicKey: k.publicKey, privateKey: k.privateKey }, TTL: 60 * 60 * 6, urgency: 'normal' },
      )
      sent++
      await db.update(schema.pushSubscriptions).set({ lastSuccessAt: new Date() }).where(eq(schema.pushSubscriptions.id, s.id))
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      // 404/410: o navegador cancelou a inscrição.
      if (code === 404 || code === 410) await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id))
      else console.error('[push] falha ao enviar', code ?? err)
    }
  }
  return sent
}

/** Push para a equipe com a permissão indicada (respeitando nutricionistas com pacientes próprios). */
export async function pushToTeam(perm: Permission, payload: PushPayload, patientId?: string | null) {
  const { teamFor } = await import('./team')
  for (const u of await teamFor(perm, patientId)) await pushToUser(u.id, 'equipe', payload)
}

/** Registra o envio de um lembrete; devolve false se ele já tinha sido enviado (evita duplicar). */
export async function claimReminder(userId: string, kind: string, key: string) {
  const r = await db.insert(schema.reminderLog).values({ userId, kind, key }).onConflictDoNothing().returning({ id: schema.reminderLog.id })
  return r.length > 0
}
