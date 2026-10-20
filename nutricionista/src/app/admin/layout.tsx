import type { Metadata } from 'next'
import { and, count, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requireTeam } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettings } from '@/lib/settings'
import { logout } from '@/actions/auth'
import { Brand } from '@/components/Brand'
import { CloseOnNavigate, NavLinks, type NavItem } from '@/components/NavLinks'
import {
  IconBook,
  IconCalendar,
  IconChart,
  IconChat,
  IconForm,
  IconHome,
  IconInbox,
  IconMoney,
  IconPlate,
  IconReport,
  IconSettings,
  IconShield,
  IconUsers,
} from '@/components/icons'

export const metadata: Metadata = { title: 'Painel', robots: { index: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeam()
  const s = await getSettings()
  const [[pendingAppts], [unread], [newLeads]] = await Promise.all([
    db.select({ n: count() }).from(schema.appointments).where(eq(schema.appointments.status, 'pendente')),
    can(user, 'clinico')
      ? db
          .select({ n: count() })
          .from(schema.messages)
          .where(and(eq(schema.messages.fromPatient, true), isNull(schema.messages.readAt)))
      : Promise.resolve([{ n: 0 }]),
    db.select({ n: count() }).from(schema.leads).where(eq(schema.leads.status, 'novo')),
  ])

  const groups: { title: string; items: (NavItem & { show: boolean })[] }[] = [
    {
      title: 'Atendimento',
      items: [
        { href: '/admin', label: 'Início', icon: <IconHome />, exact: true, show: true },
        { href: '/admin/agenda', label: 'Agenda', icon: <IconCalendar />, count: pendingAppts.n, show: can(user, 'agenda') },
        { href: '/admin/pacientes', label: 'Pacientes', icon: <IconUsers />, show: can(user, 'cadastro') || can(user, 'clinico') },
        { href: '/admin/mensagens', label: 'Mensagens', icon: <IconChat />, count: unread.n, show: can(user, 'clinico') },
        { href: '/admin/planos', label: 'Planos alimentares', icon: <IconPlate />, show: can(user, 'clinico') },
        { href: '/admin/alimentos', label: 'Alimentos', icon: <IconBook />, show: can(user, 'clinico') },
        { href: '/admin/calculadoras', label: 'Calculadoras', icon: <IconChart />, show: can(user, 'clinico') },
        { href: '/admin/formularios', label: 'Formulários', icon: <IconForm />, show: can(user, 'clinico') },
      ],
    },
    {
      title: 'Gestão',
      items: [
        { href: '/admin/financeiro', label: 'Financeiro', icon: <IconMoney />, show: s.financeEnabled && can(user, 'financeiro') },
        { href: '/admin/relatorios', label: 'Relatórios', icon: <IconReport />, show: can(user, 'relatorios') },
        { href: '/admin/interessados', label: 'Interessados', icon: <IconInbox />, count: newLeads.n, show: can(user, 'site') },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { href: '/admin/configuracoes', label: 'Configurações', icon: <IconSettings />, show: can(user, 'config') || can(user, 'site') },
        { href: '/admin/privacidade', label: 'Privacidade e auditoria', icon: <IconShield />, show: can(user, 'config') },
      ],
    },
  ]
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.show) })).filter((g) => g.items.length)

  const nav = visible.map((g) => (
    <div key={g.title}>
      <div className="sidebar__group">{g.title}</div>
      <NavLinks items={g.items} className="nav-link" />
    </div>
  ))

  return (
    <div className="app">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Brand name={s.professionalName} sub="Painel do consultório" logoFileId={s.logoFileId} href="/admin" />
        <nav aria-label="Painel">{nav}</nav>
        <div className="sidebar__foot">
          <div style={{ marginBottom: 6 }}>
            <strong style={{ color: '#fff' }}>{user.name}</strong>
            <div style={{ color: '#9fb0a9' }}>{user.role === 'admin' ? 'Nutricionista (administrador)' : 'Equipe'}</div>
          </div>
          <div className="row" style={{ gap: 14 }}>
            <a href="/" target="_blank" style={{ color: '#fff' }}>
              Ver site
            </a>
            <form action={logout}>
              <button className="link-btn" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <header className="topbar topbar--mobile-only" style={{ position: 'sticky' }}>
          <Brand name={s.professionalName} sub="Painel" logoFileId={s.logoFileId} href="/admin" />
          <div style={{ position: 'static' }}>
            <CloseOnNavigate>
              <summary>Menu</summary>
              <div className="mobile-menu__panel">
                {nav}
                <form action={logout} style={{ padding: '10px' }}>
                  <button className="btn btn--sm" type="submit">
                    Sair
                  </button>
                </form>
              </div>
            </CloseOnNavigate>
          </div>
        </header>
        <main id="conteudo" className="main">
          <div className="main__inner">{children}</div>
        </main>
      </div>
    </div>
  )
}
