import { and, asc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { todayIn } from '@/lib/time'
import { createAppointmentAdmin } from '@/actions/admin/appointments'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { NoAccess, PageHead } from '@/components/ui'

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const sp = await searchParams
  const user = await requireTeam()
  if (!can(user, 'agenda')) return <NoAccess />
  const s = await getSettings()
  const [services, patients] = await Promise.all([
    db.select().from(schema.services).where(eq(schema.services.active, true)).orderBy(asc(schema.services.sort)),
    db
      .select({ id: schema.patients.id, name: schema.patients.fullName })
      .from(schema.patients)
      .where(and(isNull(schema.patients.anonymizedAt)))
      .orderBy(asc(schema.patients.fullName)),
  ])
  return (
    <div style={{ maxWidth: 760 }}>
      <PageHead title="Nova consulta" crumbs={[{ href: '/admin/agenda', label: 'Agenda' }]} />
      <div className="card">
        <ActionForm action={createAppointmentAdmin} className="stack">
          <Field label="Paciente" name="patientId" hint="Ou deixe em branco e preencha os dados de contato abaixo.">
            <select name="patientId" defaultValue={sp.paciente ?? ''}>
              <option value="">— Pessoa sem cadastro —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <fieldset>
            <legend>Contato (somente se não houver cadastro)</legend>
            <div className="form-grid form-grid--3">
              <Field label="Nome" name="name">
                <input name="name" />
              </Field>
              <Field label="E-mail" name="email">
                <input name="email" type="email" />
              </Field>
              <Field label="Telefone" name="phone">
                <input name="phone" type="tel" />
              </Field>
            </div>
          </fieldset>
          <div className="form-grid">
            <Field label="Serviço" name="serviceId" required>
              <select name="serviceId">
                {services.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.durationMinutes} min)
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Modalidade" name="modality" required>
              <select name="modality">
                <option value="presencial">Presencial</option>
                <option value="online">On-line</option>
              </select>
            </Field>
            <Field label="Data" name="day" required>
              <input type="date" name="day" defaultValue={todayIn(s.timezone)} />
            </Field>
            <Field label="Horário" name="time" required>
              <input type="time" name="time" step={300} />
            </Field>
            <Field label="Situação" name="status">
              <select name="status" defaultValue="confirmada">
                <option value="confirmada">Confirmada</option>
                <option value="pendente">Pendente</option>
              </select>
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" name="outside" /> Permitir fora do expediente
          </label>
          <Field label="Anotações internas" name="internalNotes">
            <textarea name="internalNotes" rows={2} />
          </Field>
          <div>
            <SubmitButton>Agendar</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  )
}
