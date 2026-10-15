import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { can } from '@/lib/auth/permissions'
import type { CurrentUser } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { fmtDateTime, fmtDay } from '@/lib/time'
import { invitePatient, revokePatientAccess, updatePatient } from '@/actions/admin/patients'
import { ActionForm, SubmitButton } from '@/components/form'
import { PatientFormFields } from '@/components/PatientFormFields'

type P = typeof schema.patients.$inferSelect

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
            <PatientFormFields p={p} />
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
    </div>
  )
}
