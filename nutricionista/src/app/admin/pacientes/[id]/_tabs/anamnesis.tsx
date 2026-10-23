import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { anamnesisVersions } from '@/lib/anamnese-store'
import { ANAMNESIS_STEPS, answerText, type AnamFile } from '@/lib/anamnese-form'
import { fmtDateTime } from '@/lib/time'
import { requestReassessment } from '@/actions/anamnese'
import { Empty } from '@/components/ui'
import type { schema } from '@/db'

/** Aba Anamnese: respostas por etapa, histórico de versões, PDF e pedido de reavaliação. */
export async function AnamnesisTab({ patient, version }: { patient: typeof schema.patients.$inferSelect; version?: string }) {
  const s = await getSettings()
  const versions = await anamnesisVersions(patient.id)
  if (versions.length === 0)
    return (
      <Empty>
        {patient.userId
          ? 'O paciente ainda não começou a anamnese. Ela aparece no primeiro acesso dele ao app.'
          : 'A anamnese fica disponível quando o paciente tiver acesso ao app (botão “Liberar acesso” no Resumo).'}
      </Empty>
    )
  const current = versions.find((v) => String(v.version) === version) ?? versions.find((v) => v.status === 'enviada') ?? versions[0]
  const latest = versions[0]
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <section className="card">
        <div className="card__head">
          <h2>
            Anamnese · versão {current.version}{' '}
            <span className={`badge ${current.status === 'enviada' ? 'badge--ok' : 'badge--warn'}`}>{current.status === 'enviada' ? 'Enviada' : 'Rascunho'}</span>
          </h2>
          <div className="row">
            {current.status === 'enviada' && (
              <a className="btn btn--sm" href={`/admin/pacientes/${patient.id}/anamnese/pdf?versao=${current.version}`} target="_blank" rel="noopener noreferrer">
                Exportar PDF
              </a>
            )}
            {latest.status === 'enviada' && (
              <form action={requestReassessment.bind(null, patient.id)}>
                <button type="submit" className="btn btn--sm btn--primary">
                  Pedir reavaliação
                </button>
              </form>
            )}
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {current.submittedAt
            ? `Enviada em ${fmtDateTime(current.submittedAt, s.timezone)}.`
            : `Em preenchimento pelo paciente (etapa ${Math.min(current.step + 1, ANAMNESIS_STEPS.length + 1)} de ${ANAMNESIS_STEPS.length + 1}), atualizado em ${fmtDateTime(current.updatedAt, s.timezone)}.`}
        </p>
        {latest.status === 'rascunho' && latest.id !== current.id && (
          <p className="alert alert--info small" style={{ margin: '10px 0 0' }}>
            Reavaliação pedida: a versão {latest.version} está com o paciente, que já recebeu as respostas anteriores para atualizar.
          </p>
        )}
        {versions.length > 1 && (
          <nav className="row small" aria-label="Versões" style={{ marginTop: 10 }}>
            <span className="muted">Histórico:</span>
            {versions.map((v) => (
              <Link key={v.id} href={`/admin/pacientes/${patient.id}?aba=anamnese&versao=${v.version}`} aria-current={v.id === current.id ? 'true' : undefined} className="chip-link">
                v{v.version} · {v.submittedAt ? fmtDateTime(v.submittedAt, s.timezone).split(' ')[0] : 'rascunho'}
              </Link>
            ))}
          </nav>
        )}
      </section>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        {ANAMNESIS_STEPS.map((st) => (
          <section key={st.key} className="card anam__review">
            <h3>{st.title}</h3>
            <dl>
              {st.fields.map((f) => {
                const v = current.answers[st.key]?.[f.id]
                return (
                  <div key={f.id}>
                    <dt>{f.label}</dt>
                    <dd>
                      {f.type === 'files' && Array.isArray(v) && v.length ? (
                        (v as AnamFile[]).map((x) => (
                          <a key={x.id} href={`/arquivos/${x.id}`} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                            {x.title}
                          </a>
                        ))
                      ) : (
                        answerText(f, v) || <span className="muted">—</span>
                      )}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
