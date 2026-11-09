import type { Metadata } from 'next'
import { noIndex } from '@/lib/seo'
import Link from 'next/link'
import { requirePatient } from '@/lib/auth/session'
import { getSettings } from '@/lib/settings'
import { getPatient } from '@/lib/patient-context'
import { logout } from '@/actions/auth'
import { completeOnboarding } from '@/actions/patient'
import { Brand } from '@/components/Brand'
import { NavLinks } from '@/components/NavLinks'
import { Onboarding } from '@/components/nutri/Onboarding'
import { BackToTop } from '@/components/BackToTop'
import { needsPayment } from '@/lib/pagamentos'
import { LiveUpdates, LogoutForm, PushToggle, PwaClient } from '@/components/pwa'
import { removePushSubscription, savePushSubscription } from '@/actions/push'
import { vapidKeys } from '@/lib/push'
import { IconBook, IconChart, IconChat, IconHome, IconMoney, IconPlate, IconSettings, IconUser } from '@/components/icons'

export const metadata: Metadata = { title: 'Área do cliente', robots: noIndex }

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatient()
  const s = await getSettings()
  const patient = await getPatient(user.patientId)
  const f = patient.features
  // Cadastro pelo site sem pagamento aprovado: só Pagamento, Mensagens e Meus dados ficam abertos.
  const blocked = await needsPayment(user.patientId)

  const lockedNav = [
    { href: '/paciente/pagamento', label: 'Pagamento' },
    ...(f.chat ? [{ href: '/paciente/mensagens', label: 'Mensagens' }] : []),
    { href: '/paciente/meus-dados', label: 'Meus dados' },
  ]
  const lockedTabs = [
    { href: '/paciente/pagamento', label: 'Pagamento', icon: <IconMoney /> },
    ...(f.chat ? [{ href: '/paciente/mensagens', label: 'Mensagens', icon: <IconChat /> }] : []),
    { href: '/paciente/meus-dados', label: 'Meus dados', icon: <IconUser /> },
  ]

  const main = blocked ? lockedNav : [
    { href: '/paciente', label: 'Hoje', exact: true },
    { href: '/paciente/plano', label: 'Plano' },
    ...(f.diario ? [{ href: '/paciente/diario', label: 'Diário' }] : []),
    { href: '/paciente/evolucao', label: 'Progresso' },
    ...(f.chat ? [{ href: '/paciente/mensagens', label: 'Mensagens' }] : []),
    { href: '/paciente/mais', label: 'Mais' },
  ]
  const tabs = blocked ? lockedTabs : [
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
          <Brand name={s.siteName} sub="Área do cliente" logoFileId={s.logoFileId} />
          <nav className="patient-nav" aria-label="Área do cliente">
            <NavLinks items={main} />
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/paciente/meus-dados" className="patient-me" aria-label={`Meu perfil (${user.name})`}>
              <span className="avatar" aria-hidden>
                {user.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase())
                  .join('')}
              </span>
            </Link>
            <LogoutForm action={logout}>
              <button className="btn btn--sm" type="submit">
                Sair
              </button>
            </LogoutForm>
          </div>
        </div>
      </header>
      {blocked && (
        <div className="pay-banner no-print" role="status">
          <div className="container pay-banner__inner">
            <span>
              <strong>Conclua o pagamento para começar.</strong> Depois dele você responde a anamnese e recebe o seu plano.
            </span>
            <Link href="/paciente/pagamento" className="btn btn--sm btn--primary">
              Ir para o pagamento
            </Link>
          </div>
        </div>
      )}
      <PwaClient offlineText="Você está sem internet. Mostrando a última versão salva neste aparelho." />
      <LiveUpdates scope="paciente" planToast="Seu plano alimentar foi atualizado." />
      <main id="conteudo" className="patient-main">
        <div className="container">{children}</div>
      </main>
      <BackToTop place="app" />
      <nav className="tabbar no-print" aria-label="Atalhos" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        <NavLinks items={tabs} />
      </nav>
      <div className="container back-home no-print" style={{ marginTop: -60 }}>
        <Link href="/" className="btn">
          <span aria-hidden>←</span> Voltar para a página principal
        </Link>
      </div>
      <p className="container small muted no-print" style={{ paddingBottom: 90 }}>
        Este app não substitui atendimento médico. Em caso de urgência, procure um serviço de saúde.
      </p>
      {/* Boas-vindas depois da anamnese (o formulário em etapas vem antes, sem nada por cima). */}
      {!user.onboarded && patient.anamnesisReceivedAt && (
        <Onboarding
          firstName={user.name.split(' ')[0]}
          professional={s.professionalName}
          anamnesisDone={Boolean(patient.anamnesisReceivedAt)}
          onFinish={completeOnboarding}
          pushToggle={<PushToggle publicKey={vapidKeys()?.publicKey ?? null} subscribe={savePushSubscription} unsubscribe={removePushSubscription} />}
        />
      )}
    </>
  )
}
