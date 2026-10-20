import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import { requirePatient } from '@/lib/auth/session'
import { vapidKeys } from '@/lib/push'
import { removePushSubscription, saveNotificationPrefs, savePushSubscription } from '@/actions/push'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PushToggle } from '@/components/pwa'
import { PageHead } from '@/components/ui'

const TYPES = [
  ['refeicoes', 'Horário de cada refeição do plano'],
  ['agua', 'Lembrete de água'],
  ['plano', 'Plano novo ou alterado'],
  ['mensagens', 'Mensagens e comentários do nutricionista'],
  ['consultas', 'Consultas (24 h e 2 h antes)'],
  ['lembretes', 'Lembrete gentil se ficar 3 dias sem registrar'],
  ['pesagem', 'Lembrete de pesagem semanal'],
] as const

export default async function NotificationsPage() {
  const user = await requirePatient()
  const [u] = await db.select({ prefs: schema.users.notificationPrefs }).from(schema.users).where(eq(schema.users.id, user.id))
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...u?.prefs }
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead crumbs={[{ href: '/paciente/mais', label: 'Mais' }]} title="Notificações" subtitle="Escolha o que você quer receber e quando prefere silêncio." />
      <section className="card">
        <h2 style={{ fontSize: '1.05rem' }}>Neste aparelho</h2>
        <PushToggle publicKey={vapidKeys()?.publicKey ?? null} subscribe={savePushSubscription} unsubscribe={removePushSubscription} />
      </section>
      <section className="card">
        <ActionForm action={saveNotificationPrefs} className="stack">
          <fieldset>
            <legend>O que receber</legend>
            <div className="stack" style={{ ['--gap' as string]: '10px' }}>
              {TYPES.map(([k, label]) => (
                <label key={k} className="check">
                  <input type="checkbox" name={k} defaultChecked={prefs[k]} /> {label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Horário de silêncio</legend>
            <div className="form-grid">
              <Field label="Das" name="quietStart">
                <input type="time" name="quietStart" defaultValue={prefs.quietStart} />
              </Field>
              <Field label="Até" name="quietEnd">
                <input type="time" name="quietEnd" defaultValue={prefs.quietEnd} />
              </Field>
            </div>
          </fieldset>
          <fieldset>
            <legend>Lembrete de água</legend>
            <div className="form-grid form-grid--3">
              <Field label="A cada (horas)" name="waterEveryH">
                <select name="waterEveryH" defaultValue={String(prefs.waterEveryH)}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'hora' : 'horas'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Começa às" name="waterStart">
                <input type="time" name="waterStart" defaultValue={prefs.waterStart} />
              </Field>
              <Field label="Termina às" name="waterEnd">
                <input type="time" name="waterEnd" defaultValue={prefs.waterEnd} />
              </Field>
            </div>
          </fieldset>
          <div>
            <SubmitButton>Salvar preferências</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
