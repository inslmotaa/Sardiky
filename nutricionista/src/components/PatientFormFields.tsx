import type { schema } from '@/db'
import { Field } from './form'

export const STAGES = ['Avaliação inicial', 'Acompanhamento', 'Manutenção', 'Reavaliação']

/** Campos do cadastro (somente o necessário para o atendimento). */
export function PatientFormFields({ p }: { p?: typeof schema.patients.$inferSelect }) {
  return (
    <>
      <div className="form-grid">
        <Field label="Nome completo" name="fullName" required className="span-2">
          <input name="fullName" defaultValue={p?.fullName} maxLength={160} />
        </Field>
        <Field label="E-mail" name="email" hint="Necessário para liberar a área do paciente.">
          <input type="email" name="email" defaultValue={p?.email ?? ''} />
        </Field>
        <Field label="Telefone / WhatsApp" name="phone">
          <input type="tel" name="phone" defaultValue={p?.phone ?? ''} />
        </Field>
        <Field label="Data de nascimento" name="birthDate">
          <input type="date" name="birthDate" defaultValue={p?.birthDate ?? ''} />
        </Field>
        <Field label="Sexo (para cálculos de gasto energético)" name="sex">
          <select name="sex" defaultValue={p?.sex ?? ''}>
            <option value="">Não informado</option>
            <option value="F">Feminino</option>
            <option value="M">Masculino</option>
          </select>
        </Field>
        <Field label="Altura (cm)" name="heightCm">
          <input name="heightCm" inputMode="decimal" defaultValue={p?.heightCm ?? ''} />
        </Field>
        <Field label="Situação" name="status">
          <select name="status" defaultValue={p?.status ?? 'ativo'}>
            <option value="ativo">Ativo</option>
            <option value="pausado">Pausado</option>
            <option value="inativo">Inativo</option>
            <option value="alta">Alta</option>
          </select>
        </Field>
        <Field label="Etapa do acompanhamento" name="stage">
          <input name="stage" list="stages" defaultValue={p?.stage ?? 'Avaliação inicial'} maxLength={80} />
        </Field>
        <Field label="Frequência de retorno (dias)" name="followUpDays">
          <input name="followUpDays" inputMode="numeric" defaultValue={p?.followUpDays ?? ''} placeholder="Ex.: 30" />
        </Field>
        <Field label="Próximo retorno previsto" name="nextFollowUp">
          <input type="date" name="nextFollowUp" defaultValue={p?.nextFollowUp ?? ''} />
        </Field>
        <Field label="Objetivo principal" name="objective" className="span-2">
          <input name="objective" defaultValue={p?.objective ?? ''} maxLength={500} />
        </Field>
      </div>
      <datalist id="stages">
        {STAGES.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  )
}
