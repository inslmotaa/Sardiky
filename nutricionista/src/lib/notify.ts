import 'server-only'
import { db, schema } from '@/db'
import { integrationStatus } from './integrations'
import { emailLimits, podeEnviar, type EmailCategory } from './email-cota'
import { emailUsage, logEmail } from './email-quota'

/** Notificação dentro do sistema (sempre funciona). */
export async function notifyUser(userId: string | null | undefined, title: string, body?: string, link?: string) {
  if (!userId) return
  await db.insert(schema.notifications).values({ userId, title, body: body ?? null, link: link ?? null })
}

export type EmailOpts = {
  html?: string
  /** essencial (senha, conta, link de acesso, consulta, vencimento) ou resumo (lembrete opcional). */
  category?: EmailCategory
  /** Cabeçalhos extras (ex.: List-Unsubscribe nos lembretes). */
  headers?: Record<string, string>
}
export type EmailResult = { ok: boolean; reason?: 'sem-integracao' | 'cota' | 'provedor' | 'rede'; simulated?: boolean }

/**
 * Entrega um e-mail respeitando a cota gratuita do provedor (src/lib/email-cota.ts): os essenciais
 * têm prioridade; o resumo do dia só sai se sobrar a reserva. Cada envio fica em email_log (sem
 * destinatário nem conteúdo). Sem RESEND_API_KEY, nada sai do servidor e nada quebra.
 */
export async function deliverEmail(to: string, subject: string, text: string, opts: EmailOpts = {}): Promise<EmailResult> {
  const category = opts.category ?? 'essencial'
  // Só nos testes automáticos (EMAIL_TEST_OUTBOX aponta para um arquivo): grava o e-mail para o teste ler, como se fosse o provedor.
  const outbox = !integrationStatus().email ? process.env.EMAIL_TEST_OUTBOX : undefined
  if (!integrationStatus().email && !outbox) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[e-mail NÃO enviado — integração não configurada]\nPara: ${to}\nAssunto: ${subject}\n${text}\n`)
    } else {
      console.info(`[e-mail não enviado — integração não configurada] assunto="${subject}"`)
    }
    return { ok: false, reason: 'sem-integracao' }
  }
  if (!podeEnviar(category, await emailUsage(), emailLimits())) {
    await logEmail(category, false, 'cota gratuita: não enviado')
    console.warn(`[e-mail] cota gratuita: ${category} não enviado`)
    return { ok: false, reason: 'cota' }
  }
  if (outbox) {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(outbox, `${JSON.stringify({ to, subject, text, category, headers: opts.headers ?? null, at: new Date().toISOString() })}\n`).catch(() => {})
    await logEmail(category, true)
    return { ok: true, simulated: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, ...(opts.html ? { html: opts.html } : {}), ...(opts.headers ? { headers: opts.headers } : {}) }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[e-mail] provedor recusou', res.status, detail)
      await logEmail(category, false, `provedor ${res.status}`)
      return { ok: false, reason: 'provedor' }
    }
    await logEmail(category, true)
    return { ok: true }
  } catch (err) {
    console.error('[e-mail] falha de rede', err)
    await logEmail(category, false, 'falha de rede')
    return { ok: false, reason: 'rede' }
  }
}

/**
 * Envia e-mail (atalho de deliverEmail). Retorna true somente se o provedor real aceitou o envio
 * (nos testes, o e-mail vai para o arquivo e o retorno continua false, como sem integração).
 */
export async function sendEmail(to: string, subject: string, text: string, opts: EmailOpts = {}): Promise<boolean> {
  const r = await deliverEmail(to, subject, text, opts)
  return r.ok && !r.simulated
}

/** Substitui {nome}, {data}, {hora}, {servico}, {codigo} nos modelos de mensagem. */
export function renderTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** E-mail simples com um botão (ex.: Renovar, Entrar): texto escapado e link só https/http. */
export function emailWithButton(o: { greeting: string; body: string; button: string; url: string; footer?: string }) {
  const url = /^https?:\/\//.test(o.url) ? o.url : '#'
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f7f8f5;font-family:Arial,Helvetica,sans-serif;color:#18271e">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:24px"><tr><td>
<p style="font-size:16px;margin:0 0 12px">${esc(o.greeting)}</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 20px">${esc(o.body)}</p>
<p style="margin:0 0 20px"><a href="${esc(url)}" style="display:inline-block;background:#1f5e3b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:bold">${esc(o.button)}</a></p>
<p style="font-size:12px;color:#5f6e64;margin:0">${esc(o.footer ?? `Se o botão não abrir, copie este endereço: ${url}`)}</p>
</td></tr></table></body></html>`
}
