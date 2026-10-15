import type { Metadata } from 'next'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { logout } from '@/actions/auth'
import { Brand } from '@/components/Brand'
import { CloseOnNavigate, NavLinks } from '@/components/NavLinks'
import { IconBook, IconChart, IconChat, IconHome, IconPlate } from '@/components/icons'

export const metadata: Metadata = { title: 'Área do paciente', robots: { index: false } }

const MAIN = [
  { href: '/paciente', label: 'Início', exact: true },
  { href: '/paciente/plano', label: 'Plano' },
  { href: '/paciente/diario', label: 'Diário' },
  { href: '/paciente/evolucao', label: 'Evolução' },
  { href: '/paciente/mensagens', label: 'Mensagens' },
  { href: '/paciente/formularios', label: 'Formulários' },
  { href: '/paciente/consultas', label: 'Consultas' },
  { href: '/paciente/meus-dados', label: 'Meus dados' },
]

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatient()
  const s = await getSettings()
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="patient-header">
        <div className="container patient-header__inner" style={{ position: 'relative' }}>
          <Brand name={s.professionalName} sub="Área do paciente" logoFileId={s.logoFileId} href="/paciente" />
          <nav className="patient-nav" aria-label="Área do paciente">
            <NavLinks items={MAIN} />
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <span className="muted small nowrap" style={{ display: 'none' }}>
              {user.name}
            </span>
            <form action={logout} className="no-print">
              <button className="btn btn--sm" type="submit">
                Sair
              </button>
            </form>
            <div className="no-print" style={{ display: 'contents' }}>
              <CloseOnNavigate>
                <summary aria-label="Mais opções">Menu</summary>
                <div className="mobile-menu__panel">
                  <NavLinks items={MAIN} />
                </div>
              </CloseOnNavigate>
            </div>
          </div>
        </div>
      </header>
      <main id="conteudo" className="patient-main">
        <div className="container">{children}</div>
      </main>
      <nav className="tabbar" aria-label="Atalhos">
        <NavLinks
          items={[
            { href: '/paciente', label: 'Início', icon: <IconHome />, exact: true },
            { href: '/paciente/plano', label: 'Plano', icon: <IconPlate /> },
            { href: '/paciente/diario', label: 'Diário', icon: <IconBook /> },
            { href: '/paciente/evolucao', label: 'Evolução', icon: <IconChart /> },
            { href: '/paciente/mensagens', label: 'Mensagens', icon: <IconChat /> },
          ]}
        />
      </nav>
    </>
  )
}
