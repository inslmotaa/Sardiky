import { schema } from '@/db'
import { goalProgress, goalsOf, measurementsOf } from '@/lib/patient-data'
import { fmtDay } from '@/lib/time'
import { num } from '@/lib/format'
import { addGoal, setGoalStatus } from '@/actions/admin/patients'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { StatusBadge, Empty } from '@/components/ui'

export async function GoalsTab({ patient }: { patient: typeof schema.patients.$inferSelect }) {
  const [goals, rows] = await Promise.all([goalsOf(patient.id), measurementsOf(patient.id)])
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <section>
        {goals.length === 0 ? (
          <Empty>Nenhuma meta criada.</Empty>
        ) : (
          <ul className="card list">
            {goals.map((g) => {
              const p = goalProgress(g, rows)
              return (
                <li key={g.id}>
                  <div className="row row--between">
                    <strong>{g.title}</strong>
                    <StatusBadge status={g.status} />
                  </div>
                  {g.description && <div className="small muted">{g.description}</div>}
                  {g.targetValue != null && (
                    <div className="small">
                      {g.startValue != null && `de ${num(g.startValue)} `}para {num(g.targetValue)} {g.unit} {g.dueDate && `· até ${fmtDay(g.dueDate)}`}
                    </div>
                  )}
                  {p != null && (
                    <div className="progress" style={{ margin: '6px 0' }}>
                      <span style={{ width: `${p}%` }} />
                    </div>
                  )}
                  <div className="row small" style={{ marginTop: 6 }}>
                    {g.status !== 'concluida' && (
                      <form action={setGoalStatus.bind(null, patient.id, g.id, 'concluida')}>
                        <button className="link-btn" type="submit">
                          Marcar como concluída
                        </button>
                      </form>
                    )}
                    {g.status === 'ativa' && (
                      <form action={setGoalStatus.bind(null, patient.id, g.id, 'cancelada')}>
                        <button className="link-btn" type="submit">
                          Cancelar
                        </button>
                      </form>
                    )}
                    {g.status !== 'ativa' && (
                      <form action={setGoalStatus.bind(null, patient.id, g.id, 'ativa')}>
                        <button className="link-btn" type="submit">
                          Reativar
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Nova meta</h2>
        <ActionForm action={addGoal.bind(null, patient.id)} className="stack" resetOnSuccess>
          <Field label="Meta" name="title" required>
            <input name="title" maxLength={160} placeholder="Ex.: Reduzir a circunferência da cintura" />
          </Field>
          <Field label="Descrição" name="description">
            <textarea name="description" rows={2} />
          </Field>
          <Field label="Indicador (opcional)" name="metric" hint="Para metas numéricas, o progresso é calculado a partir das avaliações.">
            <select name="metric" defaultValue="">
              <option value="">Sem indicador (meta de hábito)</option>
              <option value="weightKg">Peso (kg)</option>
              <option value="waistCm">Cintura (cm)</option>
              <option value="hipCm">Quadril (cm)</option>
              <option value="bodyFatPct">Gordura corporal (%)</option>
            </select>
          </Field>
          <div className="form-grid form-grid--3">
            <Field label="Valor inicial" name="startValue">
              <input name="startValue" inputMode="decimal" />
            </Field>
            <Field label="Valor-alvo" name="targetValue">
              <input name="targetValue" inputMode="decimal" />
            </Field>
            <Field label="Unidade" name="unit">
              <input name="unit" maxLength={10} />
            </Field>
          </div>
          <Field label="Prazo" name="dueDate">
            <input type="date" name="dueDate" />
          </Field>
          <div>
            <SubmitButton>Criar meta</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
