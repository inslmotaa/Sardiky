import Link from 'next/link'
import type { ReactNode } from 'react'
import { STATUS_LABEL } from '@/lib/format'

const TONE: Record<string, string> = {
  pendente: 'warn',
  confirmada: 'ok',
  realizada: 'brand',
  cancelada: 'plain',
  faltou: 'danger',
  ativo: 'ok',
  pausado: 'warn',
  inativo: 'plain',
  alta: 'info',
  rascunho: 'warn',
  publicado: 'ok',
  arquivado: 'plain',
  pago: 'ok',
  estornado: 'danger',
  cancelado: 'plain',
  novo: 'info',
  contatado: 'warn',
  convertido: 'ok',
  descartado: 'plain',
  aberta: 'warn',
  em_andamento: 'info',
  concluida: 'ok',
  negada: 'plain',
  ativa: 'brand',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE[status] ?? 'plain'
  return <span className={`badge badge--${tone}`}>{label ?? STATUS_LABEL[status] ?? status}</span>
}

export function PageHead({
  title,
  subtitle,
  actions,
  crumbs,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  crumbs?: { href: string; label: string }[]
}) {
  return (
    <div className="page-head">
      <div>
        {crumbs && (
          <nav className="breadcrumb" aria-label="Você está em">
            {crumbs.map((c, i) => (
              <span key={c.href}>
                {i > 0 && ' / '}
                <Link href={c.href}>{c.label}</Link>
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row no-print">{actions}</div>}
    </div>
  )
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <p style={{ margin: action ? '0 0 12px' : 0 }}>{children}</p>
      {action}
    </div>
  )
}

export function NoAccess() {
  return (
    <div className="card">
      <h1>Acesso restrito</h1>
      <p className="muted">
        Seu usuário não tem permissão para ver esta área. Se precisar dela, peça ao coach responsável para
        ajustar suas permissões em Configurações → Equipe.
      </p>
      <Link className="btn" href="/admin">
        Voltar ao início
      </Link>
    </div>
  )
}

export function Tabs({ items, current }: { items: { href: string; label: string; key: string }[]; current: string }) {
  return (
    <nav className="tabs" aria-label="Seções">
      {items.map((t) => (
        <Link key={t.key} href={t.href} aria-current={t.key === current ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}

export function Stat({ value, label, href }: { value: ReactNode; label: string; href?: string }) {
  const body = (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
  return href ? (
    <Link href={href} className="card stat-card">
      {body}
    </Link>
  ) : (
    <div className="card">{body}</div>
  )
}

export function SourceBadge({ source }: { source: 'profissional' | 'paciente' }) {
  return source === 'profissional' ? (
    <span className="badge badge--brand">Medição profissional</span>
  ) : (
    <span className="badge badge--plain" title="Valor informado pelo próprio paciente, não aferido pelo profissional">
      Informado pelo paciente
    </span>
  )
}

export function DemoTag({ children = 'Demonstrativo' }: { children?: ReactNode }) {
  return <span className="demo-tag">{children}</span>
}
