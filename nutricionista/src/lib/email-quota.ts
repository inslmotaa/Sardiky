import 'server-only'
import { readFileSync } from 'node:fs'
import { and, eq, gte, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { PRIVACY_VERSION } from './constants'
import { emailLimits, quaseNoLimite, type EmailCategory, type EmailLimits } from './email-cota'
import { integrationStatus } from './integrations'

const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
const startOfUtcMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))

/** E-mails aceitos pelo provedor hoje e no mês (UTC). */
export async function emailUsage(now = new Date()) {
  const rows = await db
    .select({ at: schema.emailLog.createdAt })
    .from(schema.emailLog)
    .where(and(eq(schema.emailLog.ok, true), gte(schema.emailLog.createdAt, startOfUtcMonth(now))))
  const day = startOfUtcDay(now).getTime()
  return { day: rows.filter((r) => r.at.getTime() >= day).length, month: rows.length }
}

export async function logEmail(category: EmailCategory, ok: boolean, error?: string) {
  await db.insert(schema.emailLog).values({ category, ok, error: error?.slice(0, 300) ?? null }).catch((e) => console.error('[e-mail] falha ao registrar envio', e))
}

/**
 * Limites em vigor (EMAIL_DAILY_LIMIT / EMAIL_MONTHLY_LIMIT). Só nos testes automáticos — e-mails
 * indo para o arquivo EMAIL_TEST_OUTBOX, sem provedor configurado — o arquivo
 * `<EMAIL_TEST_OUTBOX>.limites.json` pode trocá-los, para o teste ponta a ponta chegar ao limite.
 */
export function currentEmailLimits(): EmailLimits {
  const base = emailLimits()
  const outbox = process.env.EMAIL_TEST_OUTBOX
  if (!outbox || integrationStatus().email) return base
  try {
    const o = JSON.parse(readFileSync(`${outbox}.limites.json`, 'utf8')) as Partial<EmailLimits>
    const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : d)
    return { day: n(o.day, base.day), month: n(o.month, base.month), reserve: n(o.reserve, base.reserve) }
  } catch {
    return base
  }
}

/** Situação da cota para o painel. */
export async function emailQuotaStatus(now = new Date()) {
  const used = await emailUsage(now)
  const limits = currentEmailLimits()
  return { used, limits, warn: quaseNoLimite(used, limits, now) }
}

/** Consentimento do resumo por e-mail (tipo lembretes_email): registra ao ligar, revoga ao desligar. */
export async function setEmailConsent(userId: string, patientId: string | null, on: boolean) {
  if (on) {
    await db.insert(schema.consents).values({ userId, patientId, kind: 'lembretes_email', version: PRIVACY_VERSION })
  } else {
    await db
      .update(schema.consents)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.consents.userId, userId), eq(schema.consents.kind, 'lembretes_email'), isNull(schema.consents.revokedAt)))
  }
}
