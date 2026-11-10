'use server'

import { z } from 'zod'
import { db, schema } from '@/db'
import { clientIp } from '@/lib/auth/session'
import { failure, formObject, zodErrors, type ActionState } from '@/lib/action'
import { rateLimit } from '@/lib/rate-limit'
import { notifyTeam } from '@/lib/team'
import { originFromForm, originLabel } from '@/lib/utm'
import { siteUrl } from '@/lib/seo'
import { optEmail, optStr, phone, str } from '@/lib/validation'

const leadSchema = z.object({
  name: str(120, 'Informe seu nome'),
  phone,
  email: optEmail,
  interest: optStr(120),
  message: optStr(1500),
  consent: z.literal('on', 'É preciso concordar com a Política de Privacidade'),
  // De qual formulário veio: contato completo ou o curto "quero saber mais".
  form: z.enum(['contato', 'saber-mais']).optional().default('contato'),
})

export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  if (fd.get('website')) return { ok: true, message: 'Recebemos sua mensagem.' }
  const ip = (await clientIp()) ?? 'local'
  if (!rateLimit(`lead:${ip}`, 5, 60 * 60_000)) return { error: 'Muitas mensagens seguidas. Tente mais tarde.' }
  const parsed = leadSchema.safeParse(formObject(fd))
  if (!parsed.success) return zodErrors(parsed.error)
  try {
    const d = parsed.data
    // Origem (UTM, página de entrada e domínio de quem indicou), revalidada no servidor.
    const origin = originFromForm(formObject(fd), new URL(siteUrl()).hostname)
    await db
      .insert(schema.leads)
      .values({ name: d.name, phone: d.phone, email: d.email, interest: d.interest, message: d.message, consentAt: new Date(), form: d.form, ...origin })
    const via = originLabel(origin)
    await notifyTeam('site', 'Novo interessado pelo site', `${d.name}${d.interest ? ` · ${d.interest}` : ''}${via ? ` · ${via}` : ''}`, '/admin/interessados')
    return {
      ok: true,
      message:
        d.form === 'saber-mais'
          ? 'Obrigado! Recebemos seu contato e vamos chamar você no WhatsApp informado.'
          : 'Obrigado! Recebemos seu contato e retornaremos em breve pelo telefone informado.',
    }
  } catch (err) {
    return failure(err)
  }
}
