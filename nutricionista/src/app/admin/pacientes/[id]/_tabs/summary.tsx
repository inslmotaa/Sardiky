import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { can } from '@/lib/auth/permissions'
import type { CurrentUser } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { invitePatient, revokePatientAccess, updatePatient } from '@/actions/admin/patients'
import { setPatientFeatures, setRestrictions } from '@/actions/admin/nutrition'
import { DEFAULT_FEATURES, type AppFeatures } from '@/db/schema'
import { BMR_FORMULAS, fmt } from '@/lib/nutricao'
import { RESTRICTIONS } from '@/lib/restricoes'
import { nutritionistOptions } from '@/lib/team-access'
import { ActionForm, SubmitButton } from '@/components/form'
import { PatientFormFields } from '@/components/PatientFormFields'

type P = typeof schema.patients.$inferSelect

const FEATURE_LABEL: Record<keyof AppFeatures, string> = {
  diario: 'Diário alimentar',
  peso: 'Registro de peso e medidas',
  chat: 'Mensagens',
  calorias: 'Calorias visíveis',
  macros: 'Macros visíveis',
  calculadoras: 'Calculadoras',
  agua: 'Contador de água',
}

export async function SummaryTab({ patient: p, user }: { patient: P; user: CurrentUser }) {
  const s = await getSettings()
  const [account] = p.userId ? await db.select().from(schema.users).where(eq(schema.users.id, p.userId)) : []
  const [pendingInvite] = p.userId
    ? await db
        .select()
        .from(schema.authTokens)
        .where(and(eq(schema.authTokens.userId, p.userId), eq(schema.authTokens.type, 'convite'), isNull(schema.authTokens.usedAt), gt(schema.authTokens.expiresAt, new Date())))
        .orderBy(desc(schema.authTokens.createdAt))
        .limit(1)
    : []
  const editable = can(user, 'cadastro')
  return (
    <div className="grid-2" style={{ alignItems: 'start', gridTemplateColumns: undefined }}>
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Dados cadastrais</h2>
        {editable ? (
          <ActionForm action={updatePatient.bind(null, p.id)} className="stack">
            <PatientFormFields p={p} nutritionists={await nutritionistOptions()} />
            <div>
              <SubmitButton>Salvar alterações</SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <dl className="kv">
            <dt>E-mail</dt>
            <dd>{p.email ?? '—'}</dd>
            <dt>Telefone</dt>
            <dd>{p.phone ?? '—'}</dd>
            <dt>Nascimento</dt>
            <dd>{fmtDay(p.birthDate)}</dd>
          </dl>
        )}
        <p className="muted small" style={{ margin: '12px 0 0' }}>
          Alterações cadastrais ficam registradas na trilha de auditoria. Cadastrado em {fmtDateTime(p.createdAt, s.timezone)}.
        </p>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Acesso à área do paciente</h2>
        {account ? (
          <dl className="kv">
            <dt>Login</dt>
            <dd>{account.email}</dd>
            <dt>Situação</dt>
            <dd>{!account.isActive ? 'Bloqueado' : account.passwordHash ? 'Ativo' : 'Aguardando primeiro acesso'}</dd>
            <dt>Último acesso</dt>
            <dd>{account.lastLoginAt ? fmtDateTime(account.lastLoginAt, s.timezone) : 'Nunca'}</dd>
            {pendingInvite && (
              <>
                <dt>Convite</dt>
                <dd>válido até {fmtDateTime(pendingInvite.expiresAt, s.timezone)}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="muted">O paciente ainda não tem acesso. Ao liberar, é gerado um link de primeiro acesso para ele criar a própria senha — a equipe nunca define nem vê senhas.</p>
        )}
        {editable && (
          <div className="stack" style={{ marginTop: 12 }}>
            <ActionForm action={invitePatient.bind(null, p.id)}>
              <SubmitButton className="btn btn--primary" pendingText="Gerando…">
                {account ? 'Gerar novo link de acesso' : 'Liberar acesso'}
              </SubmitButton>
            </ActionForm>
            {account?.isActive && (
              <form action={revokePatientAccess.bind(null, p.id)}>
                <button className="btn btn--danger btn--sm" type="submit">
                  Bloquear acesso
                </button>
              </form>
            )}
          </div>
        )}
      </section>
      {can(user, 'clinico') && (
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Restrições alimentares</h2>
          <p className="small muted">Preenchidas automaticamente pela anamnese (perguntas marcadas para “levar à ficha”) e ajustáveis aqui. O editor de planos alerta os alimentos que conflitam.</p>
          <ActionForm action={setRestrictions.bind(null, p.id)} className="stack">
            <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
              {Object.entries(RESTRICTIONS).map(([k, r]) => (
                <label key={k} className="check">
                  <input type="checkbox" name="restriction" value={k} defaultChecked={(p.restrictions ?? []).includes(k)} /> {r.label}
                </label>
              ))}
            </div>
            <div>
              <SubmitButton className="btn btn--sm">Salvar restrições</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}
      {can(user, 'clinico') && (
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Recursos do app do paciente</h2>
          <p className="small muted">Ligue ou desligue por paciente. Ocultar calorias e macros ajuda quem tem relação difícil com números.</p>
          <ActionForm action={setPatientFeatures.bind(null, p.id)} className="stack">
            <div className="choice-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {(Object.keys(DEFAULT_FEATURES) as (keyof AppFeatures)[]).map((k) => (
                <label key={k} className="check">
                  <input type="checkbox" name={k} defaultChecked={({ ...DEFAULT_FEATURES, ...p.features } as AppFeatures)[k]} /> {FEATURE_LABEL[k]}
                </label>
              ))}
            </div>
            <div>
              <SubmitButton className="btn btn--sm btn--primary">Salvar recursos</SubmitButton>
            </div>
          </ActionForm>
        </section>
      )}
      {can(user, 'clinico') && (
        <section className="card">
          <h2 style={{ fontSize: '1.1rem' }}>Gasto energético</h2>
          {p.energy ? (
            <dl className="kv">
              <dt>Fórmula</dt>
              <dd>{BMR_FORMULAS[p.energy.formula as keyof typeof BMR_FORMULAS] ?? p.energy.formula}</dd>
              <dt>TMB</dt>
              <dd>{fmt(p.energy.bmr, 0)} kcal</dd>
              <dt>GET</dt>
              <dd>
                {fmt(p.energy.tdee, 0)} kcal (fator {fmt(p.energy.factor, 3)})
              </dd>
              <dt>Meta</dt>
              <dd>
                <strong>{fmt(p.energy.targetKcal, 0)} kcal/dia</strong> (ajuste {p.energy.adjust > 0 ? '+' : ''}
                {fmt(p.energy.adjust, 0)} {p.energy.adjustUnit === 'pct' ? '%' : 'kcal'})
              </dd>
              <dt>Calculado em</dt>
              <dd>{fmtDay(p.energy.date)}</dd>
            </dl>
          ) : (
            <p className="muted small">Ainda não calculado.</p>
          )}
          <a href="/admin/calculadoras" className="btn btn--sm" style={{ marginTop: 10 }}>
            Abrir calculadoras
          </a>
        </section>
      )}
    </div>
  )
}
