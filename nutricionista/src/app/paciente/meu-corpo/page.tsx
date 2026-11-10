import Link from 'next/link'
import { requireActivePatient } from '@/lib/auth/patient-gate'
import { getSettings } from '@/lib/settings'
import { featuresOf } from '@/lib/patient-context'
import { bodyProfile } from '@/lib/corpo-server'
import { todayIn } from '@/lib/time'
import { quickWeight } from '@/actions/patient'
import { saveBodyData, updateOwnHeight } from '@/actions/corpo'
import { BodyCard } from '@/components/BodyCard'
import { ActionForm, Field, SubmitButton } from '@/components/form'
import { PageHead } from '@/components/ui'

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const num = (v: number, d = 1) => v.toFixed(d).replace('.', ',')

/** "Meu corpo": peso, altura, idade, IMC e fotos do corpo, sempre atualizados. */
export default async function MyBodyPage() {
  const user = await requireActivePatient()
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const [profile, f] = await Promise.all([bodyProfile(user.patientId, today), featuresOf(user.patientId)])
  const recent = [...profile.weights].reverse().slice(0, 8)
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <PageHead title="Meu corpo" subtitle="Peso, altura e fotos do corpo. Só você e o seu coach veem." crumbs={[{ href: '/paciente', label: 'Início' }]} />
      <BodyCard
        data={profile}
        completeHref="#dados"
        actions={
          <>
            {f.fotosCorpo && (
              <Link href="/paciente/meu-corpo/fotos" className="btn btn--primary btn--sm">
                Enviar fotos do corpo
              </Link>
            )}
            <Link href="/paciente/evolucao" className="btn btn--sm">
              Ver minha evolução
            </Link>
          </>
        }
      />

      {f.peso && (
        <section className="card" id="peso" aria-labelledby="peso-titulo">
          <h2 id="peso-titulo" style={{ fontSize: '1.15rem' }}>
            Registrar peso
          </h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            De preferência pela manhã, em jejum e na mesma balança. Cada registro entra no histórico como “informado por você”.
          </p>
          <ActionForm action={quickWeight} className="row" resetOnSuccess>
            <Field label="Peso de hoje (kg)" name="weightKg">
              <input name="weightKg" inputMode="decimal" placeholder="Ex.: 70,5" style={{ maxWidth: 160 }} autoFocus />
            </Field>
            <div style={{ alignSelf: 'flex-end' }}>
              <SubmitButton>Salvar peso</SubmitButton>
            </div>
          </ActionForm>
          {recent.length > 0 && (
            <ul className="list" aria-label="Últimos pesos" style={{ marginTop: 12 }}>
              {recent.map((w, i) => (
                <li key={`${w.date}-${i}`} className="row row--between">
                  <span>{dm(w.date)}</span>
                  <span>
                    <strong>{num(w.value)} kg</strong> <span className="small muted">· {w.source === 'profissional' ? 'medido pelo coach' : 'informado por você'}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card" id="altura" aria-labelledby="altura-titulo">
        <h2 id="altura-titulo" style={{ fontSize: '1.15rem' }}>
          Altura
        </h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Mudou? Atualize aqui. O IMC de cada data usa a altura daquela época.
        </p>
        <ActionForm action={updateOwnHeight} className="row" resetOnSuccess>
          <Field label="Altura (cm)" name="heightCm">
            <input name="heightCm" inputMode="decimal" placeholder={profile.heightCm ? String(profile.heightCm) : 'Ex.: 168'} style={{ maxWidth: 160 }} />
          </Field>
          <div style={{ alignSelf: 'flex-end' }}>
            <SubmitButton>Atualizar altura</SubmitButton>
          </div>
        </ActionForm>
        {profile.heights.length > 0 && (
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            Histórico: {profile.heights.map((h) => `${dm(h.date)} ${num(h.heightCm, 0)} cm`).join(' · ')}
          </p>
        )}
      </section>

      <section className="card" id="dados" aria-labelledby="dados-titulo">
        <h2 id="dados-titulo" style={{ fontSize: '1.15rem' }}>
          {profile.missing.length ? 'Complete seus dados' : 'Seus dados'}
        </h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          A idade é calculada pela data de nascimento e muda sozinha no seu aniversário. A anamnese também preenche estes campos.
        </p>
        <ActionForm action={saveBodyData} className="stack">
          <div className="form-grid form-grid--3">
            <Field label="Data de nascimento" name="birthDate" required>
              <input type="date" name="birthDate" defaultValue={profile.birthDate ?? ''} max={today} />
            </Field>
            <Field label="Sexo" name="sex" required>
              <select name="sex" defaultValue={profile.sex ?? ''}>
                <option value="">Escolha</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </Field>
            <Field label="Altura (cm)" name="heightCm" required>
              <input name="heightCm" inputMode="decimal" defaultValue={profile.heightCm ?? ''} placeholder="Ex.: 168" />
            </Field>
          </div>
          <div>
            <SubmitButton>Salvar dados</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  )
}
