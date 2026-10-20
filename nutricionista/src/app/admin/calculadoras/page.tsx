import { asc, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { loadFoods } from '@/lib/foods'
import { getSettings } from '@/lib/settings'
import { ageFrom, todayIn } from '@/lib/time'
import { saveEnergy } from '@/actions/admin/nutrition'
import { Calculators } from '@/components/nutri/Calculators'
import { NoAccess, PageHead } from '@/components/ui'

export default async function AdminCalculators() {
  const user = await requireTeam()
  if (!can(user, 'clinico')) return <NoAccess />
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const [foods, patients, weights] = await Promise.all([
    loadFoods(),
    db.select().from(schema.patients).where(isNull(schema.patients.anonymizedAt)).orderBy(asc(schema.patients.fullName)),
    db.select({ patientId: schema.measurements.patientId, date: schema.measurements.date, weightKg: schema.measurements.weightKg }).from(schema.measurements).orderBy(asc(schema.measurements.date)),
  ])
  const lastWeight = new Map<string, number>()
  for (const w of weights) if (w.weightKg != null) lastWeight.set(w.patientId, w.weightKg)
  return (
    <div className="stack" style={{ maxWidth: 980 }}>
      <PageHead title="Calculadoras" subtitle="Porções, composição corporal, gasto energético, macros e hidratação. Resultados de gasto energético podem ser salvos na ficha." />
      <Calculators
        foods={foods}
        mode="pro"
        waterMlPerKg={s.waterMlPerKg}
        patients={patients.map((p) => ({
          id: p.id,
          name: p.fullName,
          sex: (p.sex as 'F' | 'M' | null) ?? null,
          age: ageFrom(p.birthDate, today),
          weightKg: lastWeight.get(p.id) ?? null,
          heightCm: p.heightCm,
        }))}
        onSaveEnergy={saveEnergy}
      />
    </div>
  )
}
