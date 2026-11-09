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
export async function sendEmail(to: string, subject: string, text: string, opts: { html?: string } = {}): Promise<boolean> {
  // Só nos testes automáticos (EMAIL_TEST_OUTBOX aponta para um arquivo): grava o e-mail para o teste ler o link.
  const outbox = process.env.EMAIL_TEST_OUTBOX
  if (outbox && !integrationStatus().email) {
    const { appendFile } = await import('node:fs/promises')
    await appendFile(outbox, `${JSON.stringify({ to, subject, text, at: new Date().toISOString() })}\n`).catch(() => {})
    return false
  }
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
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, ...(opts.html ? { html: opts.html } : {}) }),
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
