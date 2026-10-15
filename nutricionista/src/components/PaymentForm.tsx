import { createPayment } from '@/actions/admin/finance'
import { ActionForm, Field, SubmitButton } from './form'

export function PaymentForm({
  patients,
  packages,
  patientId,
}: {
  patients?: { id: string; name: string }[]
  packages: { id: string; name: string; priceCents: number }[]
  patientId?: string
}) {
  return (
    <ActionForm action={createPayment} className="stack" resetOnSuccess>
      {patientId ? (
        <input type="hidden" name="patientId" value={patientId} />
      ) : (
        <Field label="Paciente" name="patientId">
          <select name="patientId" defaultValue="">
            <option value="">— Sem vínculo —</option>
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Descrição" name="description" required>
        <input name="description" maxLength={200} placeholder="Ex.: Consulta de retorno" />
      </Field>
      {packages.length > 0 && (
        <Field label="Pacote (opcional)" name="packageId">
          <select name="packageId" defaultValue="">
            <option value="">—</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({(p.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="form-grid">
        <Field label="Valor (R$)" name="amount" required>
          <input name="amount" inputMode="decimal" placeholder="150,00" />
        </Field>
        <Field label="Desconto autorizado (R$)" name="discount">
          <input name="discount" inputMode="decimal" placeholder="0,00" />
        </Field>
      </div>
      <Field label="Motivo do desconto" name="discountReason">
        <input name="discountReason" maxLength={200} />
      </Field>
      <div className="form-grid">
        <Field label="Situação" name="status">
          <select name="status" defaultValue="pendente">
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </Field>
        <Field label="Forma de pagamento" name="method">
          <select name="method" defaultValue="">
            <option value="">—</option>
            <option value="pix">Pix</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="cartao">Cartão</option>
            <option value="transferencia">Transferência</option>
          </select>
        </Field>
        <Field label="Vencimento" name="dueDate">
          <input type="date" name="dueDate" />
        </Field>
        <Field label="Data do pagamento" name="paidAt" hint="Se pago; padrão: hoje.">
          <input type="date" name="paidAt" />
        </Field>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Lançamentos feitos aqui são <strong>registros internos</strong>. Pagamentos confirmados por um provedor integrado aparecerão identificados separadamente.
      </p>
      <div>
        <SubmitButton>Registrar lançamento</SubmitButton>
      </div>
    </ActionForm>
  )
}
