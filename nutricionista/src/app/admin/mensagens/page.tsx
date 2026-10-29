import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { isRestricted } from '@/lib/team-access'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { NoAccess, PageHead, Empty } from '@/components/ui'
import { LiveUpdates, PushToggle } from '@/components/pwa'
import { removePushSubscription, savePushSubscription } from '@/actions/push'
import { vapidKeys } from '@/lib/push'

export default async function InboxPage() {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const s = await getSettings()
  const threads = await db
    .select({
      patientId: schema.patients.id,
      name: schema.patients.fullName,
      last: sql<Date>`max(${schema.messages.createdAt})`.mapWith((v) => new Date(v)),
      unread: sql<number>`count(*) filter (where ${schema.messages.fromPatient} and ${schema.messages.readAt} is null)`.mapWith(Number),
      lastBody: sql<string>`(array_agg(${schema.messages.body} order by ${schema.messages.createdAt} desc))[1]`,
      lastFromPatient: sql<boolean>`(array_agg(${schema.messages.fromPatient} order by ${schema.messages.createdAt} desc))[1]`,
    })
    .from(schema.messages)
    .innerJoin(schema.patients, eq(schema.patients.id, schema.messages.patientId))
    .where(isRestricted(user) ? eq(schema.patients.nutritionistId, user.id) : undefined)
    .groupBy(schema.patients.id, schema.patients.fullName)
    .orderBy(desc(sql`max(${schema.messages.createdAt})`))
  return (
    <div className="stack">
      <PageHead title="Mensagens" subtitle="Conversas com clientes. Responda pela ficha de cada um." />
      <LiveUpdates scope="" intervalMs={8000} />
      <section className="card row row--between" style={{ alignItems: 'center' }}>
        <strong className="small">Avisos de novas mensagens neste aparelho</strong>
        <PushToggle compact publicKey={vapidKeys()?.publicKey ?? null} subscribe={savePushSubscription} unsubscribe={removePushSubscription} />
      </section>
      {threads.length === 0 ? (
        <Empty>Nenhuma conversa ainda.</Empty>
      ) : (
        <ul className="card list">
          {threads.map((t) => (
            <li key={t.patientId} className="row row--between" style={{ flexWrap: 'nowrap' }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/admin/pacientes/${t.patientId}?aba=mensagens`}>
                  <strong>{t.name}</strong>
                </Link>
                <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.lastFromPatient ? '' : 'Você: '}
                  {t.lastBody}
                </div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div className="small muted">{fmtDateTime(t.last, s.timezone)}</div>
                {t.unread > 0 && <span className="badge badge--warn">{t.unread} não lida(s)</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
