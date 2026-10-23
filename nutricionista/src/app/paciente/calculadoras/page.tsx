import { redirect } from 'next/navigation'
import { requirePatient } from '@/lib/auth/session'
import { getPatient } from '@/lib/patient-context'
import { latest, measurementsOf } from '@/lib/patient-data'
import { loadFoods } from '@/lib/foods'
import { getSettings } from '@/lib/settings'
import { ageFrom, todayIn } from '@/lib/time'
import { Calculators } from '@/components/nutri/Calculators'
import { PageHead } from '@/components/ui'

export default async function PatientCalculators() {
  const user = await requirePatient()
  const p = await getPatient(user.patientId)
  if (!p.features.calculadoras) redirect('/paciente/mais')
  const s = await getSettings()
  const [foods, rows] = await Promise.all([loadFoods(), measurementsOf(p.id)])
  const w = latest(rows, 'weightKg')
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <PageHead title="Calculadoras" subtitle="Ferramentas para o dia a dia. Seu plano é definido pelo seu coach." />
      <Calculators
        foods={foods}
        mode="patient"
        allow={{ calorias: p.features.calorias }}
        waterMlPerKg={s.waterMlPerKg}
        defaults={{ sex: (p.sex as 'F' | 'M' | null) ?? null, age: ageFrom(p.birthDate, todayIn(s.timezone)), weightKg: w?.value ?? null, heightCm: p.heightCm }}
      />
    </div>
  )
}
