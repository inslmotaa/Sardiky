import Link from 'next/link'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { currentPlan, goalProgress, goalsOf, measurementsOf, nextAppointment, pendingFormsOf, series } from '@/lib/patient-data'
import { fmtDateTime, fmtDay, zonedParts } from '@/lib/time'
import { num } from '@/lib/format'
import { markNotificationsRead } from '@/actions/patient'
import { LineChart } from '@/components/LineChart'
import { StatusBadge } from '@/components/ui'
import { IconBook, IconChart, IconChat, IconForm } from '@/components/icons'

export default async function PatientHome() {
  const user = await requirePatient()
  const s = await getSettings()
  const [next, plan, rows, goals, forms, guidance, notes] = await Promise.all([
    nextAppointment(user.patientId),
    currentPlan(user.patientId),
    measurementsOf(user.patientId),
    goalsOf(user.patientId),
    pendingFormsOf(user.patientId),
    db
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.patientId, user.patientId), eq(schema.messages.fromPatient, false)))
      .orderBy(desc(schema.messages.createdAt))
      .limit(3),
    db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(5),
  ])
  const weight = series(rows, 'weightKg')
  const first = weight[0]
  const last = weight[weight.length - 1]
  const activeGoals = goals.filter((g) => g.status === 'ativa')
  const firstName = user.name.split(' ')[0]
  const hour = zonedParts(new Date(), s.timezone).hour
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <div>
        <h1 style={{ marginBottom: 4 }}>
          {hello}, {firstName}!
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Cada registro ajuda no seu acompanhamento. Pequenos passos contam.
        </p>
      </div>

      {notes.length > 0 && (
        <div className="card card--soft">
          <div className="card__head">
            <h2 style={{ fontSize: '1.05rem' }}>Avisos</h2>
            <form action={markNotificationsRead}>
              <button className="link-btn small" type="submit">
                Marcar como lidos
              </button>
            </form>
          </div>
          <ul className="list">
            {notes.map((n) => (
              <li key={n.id}>
                {n.link ? <Link href={n.link}>{n.title}</Link> : <strong>{n.title}</strong>}
                {n.body && <span className="muted"> — {n.body}</span>}
                <span className="muted small"> · {fmtDateTime(n.createdAt, s.timezone)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2>Próxima consulta</h2>
            <Link href="/paciente/consultas" className="small">
              Ver todas
            </Link>
          </div>
          {next ? (
            <div className="stack" style={{ ['--gap' as string]: '8px' }}>
              <p className="stat__value" style={{ margin: 0, fontSize: '1.4rem' }}>
                {fmtDateTime(next.startAt, s.timezone)}
              </p>
              <p style={{ margin: 0 }}>
                {next.serviceName} · {next.modality === 'online' ? 'On-line' : 'Presencial'} <StatusBadge status={next.status} />
              </p>
              {next.modality === 'online' && next.meetingUrl && next.status === 'confirmada' && (
                <a href={next.meetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm" style={{ justifySelf: 'start' }}>
                  Entrar na videochamada
                </a>
              )}
            </div>
          ) : (
            <div>
              <p className="muted">Nenhuma consulta agendada.</p>
              <Link href="/agendar" className="btn btn--primary btn--sm">
                Agendar retorno
              </Link>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Plano alimentar</h2>
            {plan && (
              <Link href="/paciente/plano" className="small">
                Abrir plano
              </Link>
            )}
          </div>
          {plan ? (
            <div className="stack" style={{ ['--gap' as string]: '6px' }}>
              <strong style={{ display: 'block' }}>{plan.title}</strong>
              <span className="muted small" style={{ display: 'block' }}>
                Versão {plan.version} · atualizado em {plan.publishedAt ? fmtDay(plan.publishedAt.toISOString().slice(0, 10)) : '—'}
                {plan.validUntil && ` · válido até ${fmtDay(plan.validUntil)}`}
              </span>
              <ul className="list" style={{ marginTop: 8 }}>
                {[...plan.content.meals]
                  .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))
                  .slice(0, 4)
                  .map((m) => (
                    <li key={m.id} className="row row--between" style={{ padding: '6px 0' }}>
                      <span>{m.name}</span>
                      <span className="muted nowrap">{m.time}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <p className="muted">Seu plano ainda está sendo preparado. Você será avisado(a) quando for publicado.</p>
          )}
        </section>
      </div>

      <section className="card">
        <h2 className="sr-only">Atalhos</h2>
        <div className="grid-4">
          <Link href="/paciente/diario" className="btn btn--block">
            <IconBook /> Registrar refeição
          </Link>
          <Link href="/paciente/evolucao#registrar" className="btn btn--block">
            <IconChart /> Registrar medida
          </Link>
          <Link href="/paciente/mensagens" className="btn btn--block">
            <IconChat /> Enviar mensagem
          </Link>
          <Link href="/paciente/formularios" className="btn btn--block">
            <IconForm /> Formulários
          </Link>
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2>Evolução do peso</h2>
            <Link href="/paciente/evolucao" className="small">
              Detalhes
            </Link>
          </div>
          {first && last && weight.length > 1 && (
            <p className="small" style={{ marginTop: 0 }}>
              De <strong>{num(first.value)} kg</strong> ({fmtDay(first.date)}) para <strong>{num(last.value)} kg</strong> (
              {fmtDay(last.date)}).
            </p>
          )}
          <LineChart title="Peso" points={weight} unit="kg" height={190} />
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Metas</h2>
            <Link href="/paciente/evolucao#metas" className="small">
              Todas
            </Link>
          </div>
          {activeGoals.length === 0 ? (
            <p className="muted">Nenhuma meta ativa no momento.</p>
          ) : (
            <ul className="list">
              {activeGoals.slice(0, 4).map((g) => {
                const p = goalProgress(g, rows)
                return (
                  <li key={g.id}>
                    <div className="row row--between">
                      <span>{g.title}</span>
                      {p != null && <span className="small muted">{p}%</span>}
                    </div>
                    {p != null && (
                      <div className="progress" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso: ${g.title}`} style={{ marginTop: 6 }}>
                        <span style={{ width: `${p}%` }} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2>Últimas orientações</h2>
            <Link href="/paciente/mensagens" className="small">
              Mensagens
            </Link>
          </div>
          {guidance.length === 0 ? (
            <p className="muted">Nenhuma orientação ainda.</p>
          ) : (
            <ul className="list">
              {guidance.map((m) => (
                <li key={m.id}>
                  {m.isGuidance && <span className="badge badge--brand" style={{ marginRight: 6 }}>Orientação</span>}
                  <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>
                  <div className="muted small">{fmtDateTime(m.createdAt, s.timezone)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card__head">
            <h2>Pendências</h2>
          </div>
          {forms.length === 0 ? (
            <p className="muted">Tudo em dia por aqui.</p>
          ) : (
            <ul className="list">
              {forms.map((f) => (
                <li key={f.id} className="row row--between">
                  <span>
                    {f.title}
                    {f.dueDate && <span className="muted small"> · até {fmtDay(f.dueDate)}</span>}
                  </span>
                  <Link href={`/paciente/formularios/${f.id}`} className="btn btn--sm btn--primary">
                    Preencher
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
