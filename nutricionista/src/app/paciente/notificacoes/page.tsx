import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { DEFAULT_NOTIFICATION_PREFS } from '@/db/schema'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { vapidKeys } from '@/lib/push'
import { removePushSubscription, saveNotificationPrefs, savePushSubscription } from '@/actions/push'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PushToggle } from '@/components/pwa'
import { PageHead } from '@/components/ui'
import { CalendarLinkTool } from '@/components/CalendarLinkTool'
import { calendarOutdated, channelsOf, reminderSlotsFor } from '@/lib/lembretes'
import { createCalendarLink, revokeCalendarLink } from '@/actions/lembretes'
import { integrationStatus } from '@/lib/integrations'

const TYPES = [
  ['refeicoes', 'Horário de cada refeição do plano'],
  ['agua', 'Lembrete de água (no intervalo escolhido abaixo)'],
  ['plano', 'Plano novo ou alterado'],
  ['mensagens', 'Mensagens e comentários do coach'],
  ['consultas', 'Consultas (24 h e 2 h antes)'],
  ['lembretes', 'Lembrete gentil se ficar 3 dias sem registrar'],
  ['pesagem', 'Lembrete de pesagem semanal'],
] as const

export default async function NotificationsPage() {
  const user = await requireActivePatient()
  const [u] = await db.select({ prefs: schema.users.notificationPrefs }).from(schema.users).where(eq(schema.users.id, user.id))
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS, ...u?.prefs }
  const [ch, outdated, slots] = await Promise.all([channelsOf(user.id), calendarOutdated(user.id, user.patientId), reminderSlotsFor(user.id, user.patientId)])
  const emailOn = integrationStatus().email
  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead crumbs={[{ href: '/paciente/mais', label: 'Mais' }]} title="Notificações" subtitle="Escolha o que você quer receber e quando prefere silêncio." />
      <section className="card">
        <h2 style={{ fontSize: '1.05rem' }}>Neste aparelho</h2>
        <PushToggle publicKey={vapidKeys()?.publicKey ?? null} subscribe={savePushSubscription} unsubscribe={removePushSubscription} />
      </section>
      <section className="card stack" aria-labelledby="calendario-titulo" style={{ ['--gap' as string]: '10px' }}>
        <h2 id="calendario-titulo" style={{ fontSize: '1.05rem', margin: 0 }}>
          Lembretes no calendário do celular
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          Alarmes no horário de cada refeição do plano e da água, no calendário do iPhone ou do Android. Tocam mesmo com o app fechado e sem
          internet. Só vão o nome da refeição e o horário.
        </p>
        {outdated && (
          <p className="alert alert--warn small" role="status" style={{ margin: 0 }}>
            Seus horários mudaram: atualize os lembretes do calendário (baixe de novo; os eventos são substituídos, sem duplicar).
          </p>
        )}
        {slots.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>
            Ainda não há horários para lembrar: o plano não tem horários ou os lembretes de refeição e água estão desligados abaixo.
          </p>
        ) : (
          <>
            <a className="btn btn--primary" href="/paciente/lembretes.ics" download style={{ justifySelf: 'start' }}>
              Adicionar lembretes ao meu calendário
            </a>
            <p className="small muted" style={{ margin: 0 }}>
              {slots.filter((x) => x.kind === 'refeicao').length} refeição(ões) e {slots.filter((x) => x.kind === 'agua').length} lembrete(s) de água por dia.
            </p>
          </>
        )}
        <details className="disclosure">
          <summary>Assinar por link (atualiza sozinho)</summary>
          <div className="stack" style={{ ['--gap' as string]: '8px', marginTop: 8 }}>
            <p className="small muted" style={{ margin: 0 }}>
              O calendário consulta o link de tempos em tempos e acompanha as mudanças do plano. O link é secreto: não compartilhe. Dá para cancelar
              quando quiser.
            </p>
            <CalendarLinkTool action={createCalendarLink} hasLink={Boolean(ch.calendarTokenHash)} />
            {ch.calendarTokenHash && (
              <form action={revokeCalendarLink}>
                <button type="submit" className="btn btn--sm btn--ghost">
                  Cancelar o link de assinatura
                </button>
              </form>
            )}
          </div>
        </details>
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
            <legend>Por e-mail</legend>
            <label className="check">
              <input type="checkbox" name="emailResumo" defaultChecked={prefs.emailResumo} /> Resumo do dia às 7h (refeições, horários e meta de água)
            </label>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              Um e-mail por dia, no máximo. Ao ligar, você autoriza o envio (dá para descadastrar com um clique em qualquer e-mail).
              {!emailOn && ' O envio de e-mails ainda não foi configurado pelo coach.'}
            </p>
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
