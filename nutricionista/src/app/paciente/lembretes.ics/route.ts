import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { remindersFile } from '@/lib/lembretes'

export const dynamic = 'force-dynamic'

/** "Adicionar lembretes ao meu calendário": .ics com refeições e água (iPhone, Android, Google, Outlook). */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'patient' || !user.patientId) return new Response('Não autorizado', { status: 401 })
  const body = await remindersFile(user.id, user.patientId, { download: true })
  await audit(user, 'lembretes_calendario_baixados', 'usuario', { entityId: user.id })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lembretes.ics"',
      'Cache-Control': 'private, no-store',
    },
  })
}
