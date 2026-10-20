import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requirePatient } from '@/lib/auth/session'
import { featuresOf } from '@/lib/patient-context'
import { getSettings } from '@/lib/settings'
import { loadDiaryDay } from '@/lib/diary'
import { loadFoods } from '@/lib/foods'
import { addDays, capitalize, fmtDay, fmtDayLong, isValidDay, todayIn, zonedParts } from '@/lib/time'
import { fmt } from '@/lib/nutricao'
import { deleteDiaryEntry, saveDiaryMeal } from '@/actions/patient'
import { DiaryDay } from '@/components/nutri/DiaryDay'
import { KcalRing, MacroBars } from '@/components/nutri/MacroBars'
import { PageHead } from '@/components/ui'

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const user = await requirePatient()
  const f = await featuresOf(user.patientId)
  if (!f.diario) redirect('/paciente')
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const sp = await searchParams
  const date = sp.data && isValidDay(sp.data) && sp.data <= today && sp.data >= addDays(today, -30) ? sp.data : today
  const [d, foods] = await Promise.all([loadDiaryDay(user.patientId, date), loadFoods()])
  const show = { kcal: f.calorias, macros: f.macros }
  const isToday = date === today

  return (
    <div className="stack" style={{ ['--gap' as string]: '18px' }}>
      <PageHead title="Diário alimentar" subtitle="Conte como foi cada refeição. Não existe registro “certo” — o importante é ser sincero." />

      <nav className="day-nav card" aria-label="Escolher o dia">
        <Link className="btn btn--sm" href={`/paciente/diario?data=${addDays(date, -1)}`} aria-label="Dia anterior">
          ‹
        </Link>
        <strong>{isToday ? 'Hoje' : capitalize(fmtDayLong(date))}</strong>
        {isToday ? (
          <span className="btn btn--sm" aria-hidden style={{ visibility: 'hidden' }}>
            ›
          </span>
        ) : (
          <Link className="btn btn--sm" href={`/paciente/diario?data=${addDays(date, 1)}`} aria-label="Próximo dia">
            ›
          </Link>
        )}
      </nav>

      {(show.kcal || show.macros) && d.planned && (
        <section className="card today-totals" aria-label="Consumido no dia">
          <div className="row" style={{ alignItems: 'center', gap: 20 }}>
            {show.kcal && <KcalRing value={d.consumed.kcal} target={d.targets?.kcal ?? d.planned.kcal} label="kcal registradas" />}
            {show.macros && (
              <div style={{ flex: '1 1 220px' }}>
                <MacroBars value={d.consumed} target={{ protein: d.targets?.protein ?? d.planned.protein, carbs: d.targets?.carbs ?? d.planned.carbs, fat: d.targets?.fat ?? d.planned.fat }} />
              </div>
            )}
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            Soma das refeições do plano marcadas (parcial conta metade) e dos alimentos registrados fora do plano.
          </p>
        </section>
      )}

      {!d.day && (
        <p className="empty">Seu nutricionista ainda está montando seu plano. Enquanto isso, você já pode registrar o que comeu em “Fora do plano”.</p>
      )}

      <DiaryDay
        date={date}
        nowTime={isToday ? zonedParts(new Date(), s.timezone).time : '12:00'}
        meals={d.meals}
        extras={d.extras}
        foods={foods.map((x) => ({ id: x.id, name: x.name, group: x.group, per100: x.per100, measures: x.measures }))}
        action={saveDiaryMeal}
        onDelete={deleteDiaryEntry}
        show={show}
        photoNote="A foto fica visível só para você e para o seu nutricionista."
      />

      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>Últimos dias</h2>
        <ul className="day-history">
          {d.history.map((h) => (
            <li key={h.date}>
              <Link href={`/paciente/diario?data=${h.date}`} aria-current={h.date === date ? 'page' : undefined}>
                <span>{h.date === today ? 'Hoje' : fmtDay(h.date)}</span>
                <span className="muted small">
                  {h.records === 0 ? 'sem registros' : `${h.records} ${h.records === 1 ? 'registro' : 'registros'}`}
                  {show.kcal && h.kcal > 0 && ` · ${fmt(h.kcal, 0)} kcal`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
