import 'server-only'
import { db, schema } from '@/db'
import { integrationStatus } from './integrations'

/** Notificação dentro do sistema (sempre funciona). */
export async function notifyUser(userId: string | null | undefined, title: string, body?: string, link?: string) {
  if (!userId) return
  await db.insert(schema.notifications).values({ userId, title, body: body ?? null, link: link ?? null })
}

/**
 * Envia e-mail pelo Resend quando configurado. Sem configuração, nada sai do
 * servidor: o conteúdo aparece apenas no log, marcado como demonstrativo.
 * Retorna true somente se o provedor aceitou o envio.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!integrationStatus().email) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[e-mail NÃO enviado — integração não configurada]\nPara: ${to}\nAssunto: ${subject}\n${text}\n`)
    } else {
      console.info(`[e-mail não enviado — integração não configurada] assunto="${subject}"`)
    }
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    })
    if (!res.ok) console.error('[e-mail] provedor recusou', res.status, await res.text())
    return res.ok
  } catch (err) {
    console.error('[e-mail] falha de rede', err)
    return false
  }
}

/** Substitui {nome}, {data}, {hora}, {servico}, {codigo} nos modelos de mensagem. */
export function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}
