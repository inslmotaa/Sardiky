import Link from 'next/link'
import type { Metadata } from 'next'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getPatient } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, todayIn } from '@/lib/time'
import { deleteOwnExam, uploadOwnExam } from '@/actions/patient'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Fotos e exames' }

/**
 * Tudo o que o cliente pode enviar ao coach, num lugar só. Cada envio é opcional:
 * foto da refeição (pelo diário), foto do corpo (evolução) e exames.
 */
export default async function SendPage() {
  const user = await requirePatient()
  const s = await getSettings()
  const p = await getPatient(user.patientId)
  const f = p.features
  const exams = f.exames
    ? await db
        .select()
        .from(schema.files)
        .where(and(eq(schema.files.patientId, user.patientId), eq(schema.files.kind, 'exame'), eq(schema.files.visibleToPatient, true)))
        .orderBy(desc(schema.files.createdAt))
    : []
  const nothing = !f.diario && !f.fotosCorpo && !f.exames

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px', maxWidth: 760 }}>
      <PageHead title="Fotos e exames" subtitle="Tudo aqui é opcional. Envie só o que quiser compartilhar com o seu coach." />
      {nothing && <p className="card">O envio de fotos e exames não está liberado no seu acompanhamento. Fale com o coach se quiser usar.</p>}

      <div className="send-grid">
        {f.diario && (
          <section className="card send-card" aria-labelledby="enviar-refeicao">
            <span className="send-card__tag">Opcional</span>
            <h2 id="enviar-refeicao">Foto da refeição</h2>
            <p className="muted small">Mostre o prato: o coach vê no seu diário e pode comentar.</p>
            <Link href="/paciente/diario" className="btn btn--primary btn--sm">
              Registrar refeição com foto
            </Link>
          </section>
        )}
        {f.fotosCorpo && (
          <section className="card send-card" aria-labelledby="enviar-corpo">
            <span className="send-card__tag">Opcional</span>
            <h2 id="enviar-corpo">Foto do corpo</h2>
            <p className="muted small">Frente, lado e costas, para comparar a evolução. Só você e o coach veem.</p>
            <Link href="/paciente/evolucao#fotos" className="btn btn--primary btn--sm">
              Enviar fotos de evolução
            </Link>
          </section>
        )}
      </div>

      {f.exames && (
        <section className="card stack" style={{ ['--gap' as string]: '12px' }} aria-labelledby="enviar-exames">
          <div className="row row--between">
            <h2 id="enviar-exames" style={{ fontSize: '1.1rem', margin: 0 }}>
              Exames
            </h2>
            <span className="send-card__tag">Opcional</span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Exames de sangue, laudos ou bioimpedância, em PDF ou foto (até 5 MB). Ficam em área privada: só você e o coach acessam.
          </p>
          <ActionForm action={uploadOwnExam} className="stack" resetOnSuccess encType="multipart/form-data">
            <div className="form-grid">
              <Field label="Nome do exame" name="title" required>
                <input name="title" maxLength={120} placeholder="Ex.: Hemograma e glicemia" />
              </Field>
              <Field label="Data do exame (opcional)" name="date">
                <input type="date" name="date" max={todayIn(s.timezone)} />
              </Field>
              <Field label="Arquivo" name="file" required className="span-2">
                <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,image/webp" />
              </Field>
            </div>
            <div>
              <SubmitButton pendingText="Enviando…">Enviar exame</SubmitButton>
            </div>
          </ActionForm>
          {exams.length > 0 && (
            <ul className="list" aria-label="Exames enviados">
              {exams.map((e) => (
                <li key={e.id} className="row row--between">
                  <span>
                    <a href={`/arquivos/${e.id}`} target="_blank" rel="noopener noreferrer">
                      {e.title}
                    </a>
                    <span className="small muted"> · {fmtDateTime(e.createdAt, s.timezone)}</span>
                  </span>
                  {e.uploadedBy === user.id && (
                    <form action={deleteOwnExam.bind(null, e.id)}>
                      <button type="submit" className="link-btn small">
                        Excluir
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
