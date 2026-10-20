import 'server-only'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type { FormAnswers, FormField } from './forms'
import { restrictionsFromText } from './restricoes'

/**
 * Leva as respostas da anamnese para a ficha: restrições alimentares (alertas no editor de planos)
 * e objetivo, nos campos marcados pelo nutricionista no construtor (“levar a resposta para a ficha”).
 * Também marca a anamnese como recebida.
 */
export async function applyAnamnesis(patientId: string, fields: FormField[], answers: FormAnswers) {
  const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, patientId))
  if (!p) return
  const restrictionValues: string[] = []
  let objective: string | null = null
  for (const f of fields) {
    const v = answers[f.id]
    if (f.mapsTo === 'restricoes') {
      if (Array.isArray(v)) restrictionValues.push(...v)
      else if (typeof v === 'string' && v) restrictionValues.push(...v.split(/[,;\n]/))
    }
    if (f.mapsTo === 'objetivo' && typeof v === 'string' && v.trim()) objective = v.trim().slice(0, 300)
  }
  const restrictions = [...new Set([...(p.restrictions ?? []), ...restrictionsFromText(restrictionValues)])]
  await db
    .update(schema.patients)
    .set({
      restrictions,
      objective: p.objective || objective,
      anamnesisReceivedAt: p.anamnesisReceivedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.patients.id, patientId))
  return restrictions
}

/** Envia um modelo de formulário ao paciente (cópia dos campos: mudar o modelo não altera respostas antigas). */
export async function assignTemplate(patientId: string, templateId: string) {
  const [t] = await db.select().from(schema.formTemplates).where(eq(schema.formTemplates.id, templateId))
  if (!t || !t.active) return null
  const [row] = await db.insert(schema.formAssignments).values({ templateId: t.id, patientId, title: t.title, kind: t.kind, fields: t.fields }).returning({ id: schema.formAssignments.id })
  return row.id
}
