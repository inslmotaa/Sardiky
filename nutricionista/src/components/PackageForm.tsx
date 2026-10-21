import { savePackage } from '@/actions/admin/finance'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { titledText } from '@/lib/planos'
import type { schema } from '@/db'

/** Formulário de plano de acompanhamento (criar ou editar). */
export function PackageForm({ pk }: { pk?: typeof schema.packages.$inferSelect }) {
  return (
    <ActionForm action={savePackage} className="stack" resetOnSuccess={!pk}>
      {pk && <input type="hidden" name="id" value={pk.id} />}
      <div className="form-grid form-grid--3">
        <Field label="Nome" name="name" required>
          <input name="name" maxLength={80} defaultValue={pk?.name} placeholder="Ex.: Trimestral" />
        </Field>
        <Field label="Duração (meses)" name="months" required>
          <input name="months" inputMode="numeric" defaultValue={pk?.months ?? 1} />
        </Field>
        <Field label="Valor total (R$)" name="price" required>
          <input name="price" inputMode="decimal" defaultValue={pk ? (pk.priceCents / 100).toFixed(2).replace('.', ',') : ''} />
        </Field>
      </div>
      <Field label="Descrição (opcional)" name="description">
        <input name="description" maxLength={300} defaultValue={pk?.description} />
      </Field>
      <div className="form-grid">
        <Field label="Selo de destaque (opcional)" name="highlight" hint="Ex.: Melhor custo-benefício">
          <input name="highlight" maxLength={40} defaultValue={pk?.highlight ?? ''} />
        </Field>
        <Field label="Ordem no site" name="sort">
          <input name="sort" inputMode="numeric" defaultValue={pk?.sort ?? 0} />
        </Field>
      </div>
      <Field label="Benefícios exclusivos (opcional)" name="perks" hint="Um por linha, no formato Título | texto. Ex.: Vale avaliação física | Avaliação completa sem custo adicional.">
        <textarea name="perks" rows={3} maxLength={2000} defaultValue={pk ? titledText(pk.perks) : ''} />
      </Field>
      <p className="small muted" style={{ margin: 0 }}>
        O valor por mês e o desconto aparecem sozinhos no site, comparando com o plano de maior valor mensal.
      </p>
      <div>
        <SubmitButton>{pk ? 'Salvar plano' : 'Criar plano'}</SubmitButton>
      </div>
    </ActionForm>
  )
}
