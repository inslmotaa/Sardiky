import Link from 'next/link'
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay, todayIn, weekdayOf } from '@/lib/time'
import { CONTRACT_STATUS, contractInfo } from '@/lib/contract'
import { dayForWeekday, normalizePlan } from '@/lib/plan'
import { whatsappLink } from '@/lib/format'
import { changePassword } from '@/actions/auth'
import { createDataRequest, deleteMyAccount } from '@/actions/patient'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PageHead, StatusBadge } from '@/components/ui'

const REQUEST_TYPES: Record<string, string> = {
  acesso: 'Acesso / cópia dos meus dados',
  correcao: 'Correção de dados',
  portabilidade: 'Portabilidade',
  exclusao: 'Eliminação dos dados',
  revogacao: 'Revogação de consentimento',
}

export default async function MyDataPage() {
  const user = await requirePatient()
  const s = await getSettings()
  const [[patient], requests, consents, docs] = await Promise.all([
    db.select().from(schema.patients).where(eq(schema.patients.id, user.patientId)),
    db.select().from(schema.dataRequests).where(eq(schema.dataRequests.patientId, user.patientId)).orderBy(desc(schema.dataRequests.createdAt)),
    db.select().from(schema.consents).where(eq(schema.consents.patientId, user.patientId)).orderBy(desc(schema.consents.grantedAt)),
    db.select().from(schema.files).where(eq(schema.files.patientId, user.patientId)).orderBy(desc(schema.files.createdAt)),
  ])
  const sharedDocs = docs.filter((d) => d.visibleToPatient && d.kind === 'documento')
  const today = todayIn(s.timezone)
  const [[pkg], [plan], [next]] = await Promise.all([
    patient.packageId ? db.select().from(schema.packages).where(eq(schema.packages.id, patient.packageId)) : Promise.resolve([]),
    db
      .select()
      .from(schema.mealPlans)
      .where(and(eq(schema.mealPlans.patientId, user.patientId), eq(schema.mealPlans.status, 'publicado')))
      .orderBy(desc(schema.mealPlans.publishedAt))
      .limit(1),
    db
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.patientId, user.patientId),
          inArray(schema.appointments.status, ['pendente', 'confirmada']),
          gt(schema.appointments.startAt, new Date()),
        ),
      )
      .orderBy(asc(schema.appointments.startAt))
      .limit(1),
  ])
  const contract = pkg ? contractInfo(pkg, patient.packageStart, today) : null
  const content = plan ? normalizePlan(plan.content) : null
  const planDay = content ? dayForWeekday(content, weekdayOf(today)) : null
  const showKcal = patient.features.calorias && content?.mode === 'calculado' && content.targets.kcal
  const initials = patient.fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  const wa = whatsappLink(s.whatsapp, 'Olá! Sou cliente e tenho uma dúvida.')

  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Meu perfil" subtitle="Seu acompanhamento, seu plano alimentar e seus dados." />

      <section className="card profile-hero">
        <span className="avatar avatar--lg" aria-hidden>
          {initials}
        </span>
        <div>
          <strong className="profile-hero__name">{patient.fullName}</strong>
          <span className="small muted">
            {patient.email ?? user.email} · cliente desde {fmtDay(patient.createdAt.toISOString().slice(0, 10))}
          </span>
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card stack" style={{ ['--gap' as string]: '12px' }} aria-labelledby="meu-acompanhamento">
          <h2 id="meu-acompanhamento" style={{ fontSize: '1.1rem', margin: 0 }}>
            Meu acompanhamento
          </h2>
          <dl className="kv">
            <dt>Plano</dt>
            <dd>
              {contract ? (
                <>
                  <strong>Plano {contract.name}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {contract.months} {contract.months === 1 ? 'mês' : 'meses'} · {contract.sessions} {contract.sessions === 1 ? 'consulta' : 'consultas'}
                  </span>
                </>
              ) : (
                'Nenhum plano contratado ainda'
              )}
            </dd>
            {contract && (
              <>
                <dt>Vigência</dt>
                <dd>
                  {contract.start && contract.end ? `${fmtDay(contract.start)} a ${fmtDay(contract.end)}` : 'Início a combinar com o coach'}
                  <span className={`badge ${contract.status === 'vigente' ? 'badge--ok' : contract.status === 'sem-inicio' ? 'badge--plain' : 'badge--warn'}`} style={{ marginLeft: 8 }}>
                    {contract.status === 'vigente' && contract.daysLeft != null
                      ? `faltam ${contract.daysLeft} ${contract.daysLeft === 1 ? 'dia' : 'dias'}`
                      : CONTRACT_STATUS[contract.status]}
                  </span>
                </dd>
              </>
            )}
            <dt>Coach</dt>
            <dd>
              {s.professionalName}
              <span className="small muted" style={{ display: 'block' }}>
                {[s.professionalTitle, s.registry].filter(Boolean).join(' · ')}
              </span>
            </dd>
            <dt>Etapa</dt>
            <dd>{patient.stage}</dd>
            {patient.objective && (
              <>
                <dt>Objetivo</dt>
                <dd>{patient.objective}</dd>
              </>
            )}
            <dt>Próxima consulta</dt>
            <dd>{next ? `${fmtDateTime(next.startAt, s.timezone)} · ${next.status === 'confirmada' ? 'confirmada' : 'aguardando confirmação'}` : 'Nenhuma marcada'}</dd>
          </dl>
          <div className="row">
            {!contract && (
              <Link href="/planos" className="btn btn--primary btn--sm">
                Conhecer os planos
              </Link>
            )}
            {(contract?.status === 'vencendo' || contract?.status === 'vencido') && wa && (
              <a href={whatsappLink(s.whatsapp, `Olá! Quero renovar o meu Plano ${contract.name}.`) ?? wa} target="_blank" rel="noopener noreferrer" className="btn btn--primary btn--sm">
                Renovar o plano
              </a>
            )}
            <Link href="/paciente/consultas" className="btn btn--sm">
              Minhas consultas
            </Link>
            {patient.features.chat ? (
              <Link href="/paciente/mensagens" className="btn btn--sm btn--ghost">
                Falar com o coach
              </Link>
            ) : (
              wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--sm btn--ghost">
                  Falar com o coach
                </a>
              )
            )}
          </div>
        </section>

        <section className="card stack" style={{ ['--gap' as string]: '12px' }} aria-labelledby="meu-plano-alimentar">
          <h2 id="meu-plano-alimentar" style={{ fontSize: '1.1rem', margin: 0 }}>
            Meu plano alimentar
          </h2>
          {plan && content ? (
            <>
              <div>
                <strong>{plan.title}</strong>
                <span className="small muted" style={{ display: 'block' }}>
                  Ativo desde {plan.publishedAt ? fmtDay(plan.publishedAt.toISOString().slice(0, 10)) : '—'}
                  {showKcal ? ` · meta de ${Math.round(content.targets.kcal!).toLocaleString('pt-BR')} kcal por dia` : ''}
                </span>
              </div>
              {planDay && planDay.meals.length > 0 && (
                <ul className="profile-meals" aria-label={`Refeições · ${planDay.label}`}>
                  {planDay.meals.map((m) => (
                    <li key={m.id}>
                      <span className="profile-meals__time">{m.time || '—'}</span>
                      <span>{m.name}</span>
                      {m.options.length > 1 && <span className="small muted">{m.options.length} opções</span>}
                    </li>
                  ))}
                </ul>
              )}
              <div className="row">
                <Link href="/paciente/plano" className="btn btn--primary btn--sm">
                  Ver plano completo
                </Link>
                <a href="/paciente/plano/pdf" className="btn btn--sm" target="_blank" rel="noopener noreferrer">
                  Baixar PDF
                </a>
                <Link href="/paciente/compras" className="btn btn--sm btn--ghost">
                  Lista de compras
                </Link>
              </div>
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Seu plano ainda não foi publicado. Assim que o coach concluir, ele aparece aqui e na tela Hoje.
            </p>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Cadastro</h2>
          <dl className="kv">
            <dt>Nome</dt>
            <dd>{patient.fullName}</dd>
            <dt>E-mail</dt>
            <dd>{patient.email ?? '—'}</dd>
            <dt>Telefone</dt>
            <dd>{patient.phone ?? '—'}</dd>
            <dt>Nascimento</dt>
            <dd>{fmtDay(patient.birthDate)}</dd>
          </dl>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Algo errado? Use “Correção de dados” abaixo ou avise o seu coach.
          </p>
        </section>
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Alterar senha</h2>
          <ActionForm action={changePassword} className="stack" resetOnSuccess>
            <input type="email" name="username" value={user.email} autoComplete="username" readOnly hidden />
            <Field label="Senha atual" name="current">
              <input type="password" name="current" autoComplete="current-password" />
            </Field>
            <Field label="Nova senha" name="password" hint="Mínimo de 8 caracteres, com letras e números.">
              <input type="password" name="password" autoComplete="new-password" />
            </Field>
            <Field label="Repita a nova senha" name="confirm">
              <input type="password" name="confirm" autoComplete="new-password" />
            </Field>
            <div>
              <SubmitButton>Alterar senha</SubmitButton>
            </div>
          </ActionForm>
        </section>
      </div>

      {sharedDocs.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Documentos compartilhados</h2>
          <ul className="list">
            {sharedDocs.map((d) => (
              <li key={d.id} className="row row--between">
                <span>{d.title}</span>
                <a href={`/arquivos/${d.id}`} className="btn btn--sm" target="_blank" rel="noopener noreferrer">
                  Abrir
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" id="privacidade">
        <h2 style={{ fontSize: '1.1rem' }}>Privacidade (LGPD)</h2>
        <p className="muted">
          Você pode baixar uma cópia dos seus dados a qualquer momento ou fazer uma solicitação ao encarregado de dados
          {s.privacyContact ? ` (${s.privacyContact})` : ''}.
        </p>
        <div className="row">
          <a href="/paciente/meus-dados/exportar" className="btn btn--primary">
            Baixar meus dados
          </a>
          <a href="#excluir-conta" className="btn btn--danger">
            Excluir minha conta
          </a>
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          O arquivo (JSON) traz cadastro, anamnese, consultas, planos, diário, medidas, mensagens e consentimentos.
        </p>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '20px 0' }} />
        <ActionForm action={createDataRequest} className="stack" resetOnSuccess>
          <Field label="Tipo de solicitação" name="type">
            <select name="type" defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {Object.entries(REQUEST_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Detalhes" name="details">
            <textarea name="details" rows={2} maxLength={2000} />
          </Field>
          <p className="small muted" style={{ margin: 0 }}>
            Alguns dados da ficha precisam ser mantidos pelo prazo exigido pelas normas profissionais, mesmo após um pedido de eliminação.
          </p>
          <div>
            <SubmitButton>Enviar solicitação</SubmitButton>
          </div>
        </ActionForm>
        {requests.length > 0 && (
          <ul className="list" style={{ marginTop: 16 }}>
            {requests.map((r) => (
              <li key={r.id}>
                <div className="row row--between">
                  <span>
                    {REQUEST_TYPES[r.type] ?? r.type} <span className="muted small">· {fmtDateTime(r.createdAt, s.timezone)}</span>
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                {r.response && <p className="small" style={{ margin: '4px 0 0' }}>Resposta: {r.response}</p>}
              </li>
            ))}
          </ul>
        )}
        {consents.length > 0 && (
          <>
            <h3 style={{ marginTop: 20 }}>Consentimentos registrados</h3>
            <ul className="list small">
              {consents.map((c) => (
                <li key={c.id}>
                  {c.kind.replace(/_/g, ' ')} · versão {c.version} · {fmtDateTime(c.grantedAt, s.timezone)}
                  {c.revokedAt && ` · revogado em ${fmtDateTime(c.revokedAt, s.timezone)}`}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card card--danger" id="excluir-conta">
        <h2 style={{ fontSize: '1.1rem' }}>Excluir minha conta</h2>
        <p className="small">
          Seu acesso é encerrado na hora: login, sessões e notificações. A sua ficha (anamnese, consultas e planos) fica guardada apenas
          pelo prazo exigido pelas normas profissionais e depois é anonimizado. Esta ação não pode ser desfeita.
        </p>
        <ActionForm action={deleteMyAccount} className="stack" confirm="Excluir sua conta agora? Você perde o acesso ao app.">
          <div className="form-grid">
            <Field label="Digite EXCLUIR para confirmar" name="confirm">
              <input name="confirm" type="text" autoComplete="off" />
            </Field>
            <Field label="Sua senha" name="password" hint="Contas criadas com o Google não precisam de senha.">
              <input name="password" type="password" autoComplete="current-password" />
            </Field>
          </div>
          <div>
            <SubmitButton className="btn btn--danger" pendingText="Excluindo…">
              Excluir minha conta
            </SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
