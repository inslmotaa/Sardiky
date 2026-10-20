import type { Metadata } from 'next'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { getPatient } from '@/lib/patient-context'
import { logout } from '@/actions/auth'
import { completeOnboarding } from '@/actions/patient'
import { Brand } from '@/components/Brand'
import { CloseOnNavigate, NavLinks } from '@/components/NavLinks'
import { Onboarding } from '@/components/nutri/Onboarding'
import { IconBook, IconChart, IconHome, IconPlate, IconSettings } from '@/components/icons'

export const metadata: Metadata = { title: 'Área do paciente', robots: { index: false } }

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatient()
  const s = await getSettings()
  const patient = await getPatient(user.patientId)
  const f = patient.features

  const main = [
    { href: '/paciente', label: 'Hoje', exact: true },
    { href: '/paciente/plano', label: 'Plano' },
    ...(f.diario ? [{ href: '/paciente/diario', label: 'Diário' }] : []),
    { href: '/paciente/evolucao', label: 'Progresso' },
    ...(f.chat ? [{ href: '/paciente/mensagens', label: 'Mensagens' }] : []),
    { href: '/paciente/mais', label: 'Mais' },
  ]
  const tabs = [
    { href: '/paciente', label: 'Hoje', icon: <IconHome />, exact: true },
    { href: '/paciente/plano', label: 'Plano', icon: <IconPlate /> },
    ...(f.diario ? [{ href: '/paciente/diario', label: 'Diário', icon: <IconBook /> }] : []),
    { href: '/paciente/evolucao', label: 'Progresso', icon: <IconChart /> },
    { href: '/paciente/mais', label: 'Mais', icon: <IconSettings /> },
  ]

  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="patient-header">
        <div className="container patient-header__inner" style={{ position: 'relative' }}>
          <Brand name={s.professionalName} sub="Área do paciente" logoFileId={s.logoFileId} href="/paciente" />
          <nav className="patient-nav" aria-label="Área do paciente">
            <NavLinks items={main} />
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <form action={logout} className="no-print">
              <button className="btn btn--sm" type="submit">
                Sair
              </button>
            </form>
            <div className="no-print" style={{ display: 'contents' }}>
              <CloseOnNavigate>
                <summary aria-label="Mais opções">Menu</summary>
                <div className="mobile-menu__panel">
                  <NavLinks items={main} />
                </div>
              </CloseOnNavigate>
            </div>
          </div>
        </div>
      </header>
      <main id="conteudo" className="patient-main">
        <div className="container">{children}</div>
      </main>
      <nav className="tabbar no-print" aria-label="Atalhos" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        <NavLinks items={tabs} />
      </nav>
      <p className="container small muted no-print" style={{ paddingBottom: 90, marginTop: -60 }}>
        Este app não substitui atendimento médico. Em caso de urgência, procure um serviço de saúde.
      </p>
      {!user.onboarded && (
        <Onboarding
          firstName={user.name.split(' ')[0]}
          professional={s.professionalName}
          anamneseUrl={s.anamneseUrl}
          anamnesisDone={Boolean(patient.anamnesisReceivedAt)}
          onFinish={completeOnboarding}
        />
      )}
    </>
  )
}
