import { and, desc, eq, gte } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { featuresOf } from '@/lib/patient-context'
import { redirect } from 'next/navigation'
import { getSettings } from '@/lib/settings'
import { addDays, todayIn, zonedParts } from '@/lib/time'
import { addDiaryEntry, deleteDiaryEntry } from '@/actions/patient'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PageHead, Empty } from '@/components/ui'
import { DiaryList } from '@/components/DiaryList'

const MEALS = ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia', 'Outro']

export default async function DiaryPage() {
  const user = await requirePatient()
  if (!(await featuresOf(user.patientId)).diario) redirect('/paciente')
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const entries = await db
    .select()
    .from(schema.diaryEntries)
    .where(and(eq(schema.diaryEntries.patientId, user.patientId), gte(schema.diaryEntries.date, addDays(today, -30))))
    .orderBy(desc(schema.diaryEntries.date), desc(schema.diaryEntries.time))
  const now = zonedParts(new Date(), s.timezone).time

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Diário alimentar" subtitle="Registre o que comeu, como se sentiu e se conseguiu seguir o plano. Não existe registro “certo” — o importante é ser sincero." />

      <section className="card">
        <h2 style={{ fontSize: '1.15rem' }}>Novo registro</h2>
        <ActionForm action={addDiaryEntry} className="stack" resetOnSuccess>
          <div className="form-grid form-grid--3">
            <Field label="Refeição" name="meal" required>
              <select name="meal" defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {MEALS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Data" name="date" required>
              <input type="date" name="date" defaultValue={today} max={today} />
            </Field>
            <Field label="Horário" name="time" required>
              <input type="time" name="time" defaultValue={now} />
            </Field>
          </div>
          <Field label="O que você comeu e bebeu?" name="foods" required>
            <textarea name="foods" rows={2} maxLength={1000} placeholder="Ex.: arroz, feijão, frango grelhado e salada" />
          </Field>
          <Field label="Quantidades aproximadas" name="quantity" hint="Use medidas caseiras: colheres, conchas, unidades…">
            <input name="quantity" maxLength={300} />
          </Field>
          <div className="form-grid form-grid--3">
            <Field label="Fome antes (1 a 5)" name="hunger">
              <select name="hunger" defaultValue="">
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? '(pouca)' : n === 5 ? '(muita)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Saciedade depois (1 a 5)" name="satiety">
              <select name="satiety" defaultValue="">
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? '(pouca)' : n === 5 ? '(muita)' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Seguiu o plano?" name="adherence">
              <select name="adherence" defaultValue="">
                <option value="">—</option>
                <option value="total">Sim</option>
                <option value="parcial">Em parte</option>
                <option value="nao_seguiu">Não</option>
              </select>
            </Field>
          </div>
          <Field label="Observações" name="notes" hint="Rotina, dificuldades, como se sentiu…">
            <textarea name="notes" rows={2} maxLength={1000} />
          </Field>
          <Field label="Foto da refeição (opcional)" name="photo" hint="JPG, PNG ou WebP, até 5 MB. Visível apenas para você e para o nutricionista.">
            <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment" />
          </Field>
          <div>
            <SubmitButton>Salvar registro</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section>
        <h2 style={{ fontSize: '1.15rem' }}>Últimos 30 dias</h2>
        {entries.length === 0 ? <Empty>Nenhum registro ainda.</Empty> : <DiaryList entries={entries} onDelete={deleteDiaryEntry} />}
      </section>
    </div>
  )
}
