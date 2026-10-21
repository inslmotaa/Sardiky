import Link from 'next/link'
import type { BookingTarget } from '@/lib/format'

/** Botão de agendamento: abre o WhatsApp em outra aba ou segue para a agenda on-line. */
export function BookingLink({ to, className, children }: { to: BookingTarget; className?: string; children: React.ReactNode }) {
  if (to.external)
    return (
      <a href={to.href} className={className} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  return (
    <Link href={to.href} className={className}>
      {children}
    </Link>
  )
}
