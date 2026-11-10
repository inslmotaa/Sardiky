import { getCurrentUser } from '@/lib/auth/session'
import { needsPayment } from '@/lib/pagamentos'
import { audit } from '@/lib/audit'
import { evolutionReportPdf } from '@/lib/evolucao-pdf'

export const dynamic = 'force-dynamic'

/** Relatório de evolução (PDF) do próprio cliente. Fotos só com a autorização dele. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'patient' || !user.patientId) return new Response('Não encontrado', { status: 404 })
  if (await needsPayment(user.patientId)) return new Response('Conclua o pagamento para começar', { status: 403 })
  const bytes = await evolutionReportPdf(user.patientId)
  await audit(user, 'relatorio_evolucao_baixado', 'paciente', { entityId: user.patientId, patientId: user.patientId })
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="relatorio-de-evolucao.pdf"',
      'Cache-Control': 'private, no-store',
    },
  })
}
