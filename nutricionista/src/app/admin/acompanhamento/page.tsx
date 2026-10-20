import Link from 'next/link'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { trackingBoard } from '@/lib/tracking'
import { ADHERENCE_LABEL, type AdherenceClass } from '@/lib/acompanhamento'
import { fmtDay, todayIn } from '@/lib/time'
import { num, whatsappLink } from '@/lib/format'
import { saveTrackingSettings } from '@/actions/admin/settings'
import { sendTeamMessage } from '@/actions/admin/patients'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { QuickMessage } from '@/components/nutri/QuickMessage'
import { Empty, NoAccess, PageHead, Tabs } from '@/components/ui'

const TONE: Record<AdherenceClass, string> = { em_dia: 'badge--ok', dificuldade: 'badge--warn', sem_progresso: 'badge--danger' }
const ORDER: AdherenceClass[] = ['dificuldade', 'sem_progresso', 'em_dia']

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ grupo?: string }> }) {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const sp = await searchParams
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const rows = await trackingBoard(today, s.timezone, { good: s.adherenceGood, low: s.adherenceLow })
  const group = (ORDER as string[]).includes(sp.grupo ?? '') ? (sp.grupo as AdherenceClass) : null
  const counts = Object.fromEntries(ORDER.map((k) => [k, rows.filter((r) => r.klass === k).length])) as Record<AdherenceClass, number>
  const shown = rows
    .filter((r) => !group || r.klass === group)
    .sort((a, b) => ORDER.indexOf(a.klass) - ORDER.indexOf(b.klass) || (a.pct ?? -1) - (b.pct ?? -1))

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead
        title="Acompanhamento"
        subtitle={`Pacientes ativos pela adesão nos últimos 7 dias completos (até ontem): em dia (≥ ${s.adherenceGood}% das refeições feitas), com dificuldade (${s.adherenceLow}–${s.adherenceGood - 1}%) e sem progresso (< ${s.adherenceLow}% ou sem registro).`}
      />
      <div className="stat-row">
        {ORDER.map((k) => (
          <Link key={k} href={group === k ? '/admin/acompanhamento' : `/admin/acompanhamento?grupo=${k}`} className="stat" style={{ textDecoration: 'none', color: 'inherit' }} aria-current={group === k ? 'page' : undefined}>
            <strong>{counts[k]}</strong>
            <span>
              <span className={`badge ${TONE[k]}`}>{ADHERENCE_LABEL[k]}</span>
            </span>
          </Link>
        ))}
      </div>
      <Tabs
        current={group ?? 'todos'}
        items={[{ key: 'todos', label: `Todos (${rows.length})`, href: '/admin/acompanhamento' }, ...ORDER.map((k) => ({ key: k, label: `${ADHERENCE_LABEL[k]} (${counts[k]})`, href: `/admin/acompanhamento?grupo=${k}` }))]}
      />

      {shown.length === 0 ? (
        <Empty>Nenhum paciente neste grupo.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Situação</th>
                <th className="num">Adesão (7 dias)</th>
                <th>Último registro</th>
                <th className="num">Peso</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const wa = r.phone ? whatsappLink(r.phone.length <= 11 ? `55${r.phone}` : r.phone, `Olá, ${r.name.split(' ')[0]}! Tudo bem? Passando para saber como está indo com o plano.`) : null
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/admin/pacientes/${r.id}?aba=diario`}>
                        <strong>{r.name}</strong>
                      </Link>
                      {r.objective && <div className="small muted">{r.objective}</div>}
                      {!r.hasPlan && <div className="small muted">Sem plano ativo</div>}
                      {!r.hasAccess && <div className="small muted">Sem acesso ao app</div>}
                    </td>
                    <td>
                      <span className={`badge ${TONE[r.klass]}`}>{ADHERENCE_LABEL[r.klass]}</span>
                    </td>
                    <td className="num">
                      {r.pct != null ? (
                        <span className="adh-cell">
                          <span className="adh-cell__track" aria-hidden>
                            <span style={{ width: `${r.pct}%` }} />
                          </span>
                          {r.pct}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {r.lastRecord ? (
                        <>
                          {fmtDay(r.lastRecord)}
                          <div className={`small ${r.daysWithout != null && r.daysWithout >= 3 ? 'text-warn' : 'muted'}`}>
                            {r.daysWithout === 0 ? 'hoje' : r.daysWithout === 1 ? 'ontem' : `há ${r.daysWithout} dias`}
                          </div>
                        </>
                      ) : (
                        <span className="muted">nunca</span>
                      )}
                    </td>
                    <td className="num">
                      {r.weightChange ? (
                        <>
                          {r.weightChange.kg > 0 ? '+' : ''}
                          {num(r.weightChange.kg)} kg
                          <div className="small muted">em {r.weightChange.days} dias</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <QuickMessage name={r.name} action={sendTeamMessage.bind(null, r.id)} replies={s.quickReplies} whatsapp={wa} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <details className="disclosure">
        <summary>Ajustar limites de adesão</summary>
        <div>
          <ActionForm action={saveTrackingSettings} className="row" >
            <Field label="Em dia a partir de (%)" name="adherenceGood">
              <input name="adherenceGood" type="number" min={10} max={100} defaultValue={s.adherenceGood} style={{ width: 120 }} />
            </Field>
            <Field label="Com dificuldade a partir de (%)" name="adherenceLow">
              <input name="adherenceLow" type="number" min={0} max={99} defaultValue={s.adherenceLow} style={{ width: 120 }} />
            </Field>
            <div style={{ alignSelf: 'flex-end' }}>
              <SubmitButton>Salvar limites</SubmitButton>
            </div>
          </ActionForm>
          <p className="small muted">Refeição feita conta 1, parcial conta ½. Só entram os dias desde o primeiro plano ativado do paciente.</p>
        </div>
      </details>
    </div>
  )
}
