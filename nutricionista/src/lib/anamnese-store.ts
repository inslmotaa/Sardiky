import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'

export type Anamnesis = typeof schema.anamneses.$inferSelect

/** Versões da anamnese do paciente, da mais nova para a mais antiga. */
export const anamnesisVersions = (patientId: string) =>
  db.select().from(schema.anamneses).where(eq(schema.anamneses.patientId, patientId)).orderBy(desc(schema.anamneses.version))

/** Rascunho em andamento (primeira anamnese ou reavaliação pedida pelo nutricionista). */
export async function currentDraft(patientId: string) {
  const [d] = await db
    .select()
    .from(schema.anamneses)
    .where(and(eq(schema.anamneses.patientId, patientId), eq(schema.anamneses.status, 'rascunho')))
    .orderBy(desc(schema.anamneses.version))
    .limit(1)
  return d ?? null
}

/** Primeira anamnese: cria o rascunho já com o que a ficha tem (nascimento, sexo, altura). */
export async function startFirstDraft(patientId: string) {
  const [p] = await db.select().from(schema.patients).where(eq(schema.patients.id, patientId))
  const sexo = p?.sex === 'F' ? 'Feminino' : p?.sex === 'M' ? 'Masculino' : ''
  const [row] = await db
    .insert(schema.anamneses)
    .values({
      patientId,
      version: 1,
      answers: {
        pessoais: { nascimento: p?.birthDate ?? '', sexo },
        medidas: { altura: p?.heightCm ?? '' },
      },
    })
    .onConflictDoNothing()
    .returning()
  return row ?? (await currentDraft(patientId))
}
