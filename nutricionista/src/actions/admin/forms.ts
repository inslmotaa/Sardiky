'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { failure, type ActionState } from '@/lib/action'
import { FORM_KINDS, formFieldsSchema } from '@/lib/forms'
import { str, uuid } from '@/lib/validation'

/** Cria ou atualiza um modelo de formulário. Respostas já enviadas não mudam (guardam cópia dos campos). */
export async function saveFormTemplate(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  let json: unknown
  try {
    json = JSON.parse(String(fd.get('fields') ?? '[]'))
  } catch {
    return { error: 'Campos inválidos.' }
  }
  const fields = formFieldsSchema.safeParse(json)
  if (!fields.success) return { error: `Revise as perguntas: ${fields.error.issues[0].message}` }
  for (const f of fields.data) {
    if (['select', 'radio', 'checkbox'].includes(f.type) && f.options.length < 2) return { error: `A pergunta “${f.label}” precisa de pelo menos 2 opções.` }
  }
  if (new Set(fields.data.map((f) => f.id)).size !== fields.data.length) return { error: 'Há perguntas com identificador repetido.' }
  const meta = z
    .object({
      title: str(160, 'Dê um título'),
      description: z.string().trim().max(500).default(''),
      kind: z.enum(Object.keys(FORM_KINDS) as [string, ...string[]]),
    })
    .safeParse({ title: fd.get('title') ?? '', description: fd.get('description') ?? '', kind: fd.get('kind') ?? '' })
  if (!meta.success) return { error: meta.error.issues[0].message }
  let newId = id
  try {
    const user = await requireTeam('clinico')
    if (id) {
      if (!uuid.safeParse(id).success) return { error: 'Modelo inválido.' }
      await db.update(schema.formTemplates).set({ ...meta.data, fields: fields.data, updatedAt: new Date() }).where(eq(schema.formTemplates.id, id))
    } else {
      const [row] = await db.insert(schema.formTemplates).values({ ...meta.data, fields: fields.data }).returning({ id: schema.formTemplates.id })
      newId = row.id
    }
    await audit(user, id ? 'modelo_formulario_editado' : 'modelo_formulario_criado', 'formulario', { entityId: newId })
    revalidatePath('/admin/formularios')
    if (id) return { ok: true, message: 'Modelo salvo.' }
  } catch (err) {
    return failure(err)
  }
  redirect(`/admin/formularios/${newId}`)
}

export async function toggleFormTemplate(id: string): Promise<void> {
  const user = await requireTeam('clinico')
  if (!uuid.safeParse(id).success) return
  const [t] = await db.select().from(schema.formTemplates).where(eq(schema.formTemplates.id, id))
  if (!t) return
  await db.update(schema.formTemplates).set({ active: !t.active }).where(eq(schema.formTemplates.id, id))
  await audit(user, t.active ? 'modelo_formulario_desativado' : 'modelo_formulario_ativado', 'formulario', { entityId: id })
  revalidatePath('/admin/formularios')
}
