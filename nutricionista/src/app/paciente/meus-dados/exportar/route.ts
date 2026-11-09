import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { buildPatientExport } from '@/lib/lgpd-export'

/** Portabilidade (LGPD art. 18): exporta os dados do próprio paciente em JSON. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'patient' || !user.patientId) return new Response('Não autorizado', { status: 401 })
  const pid = user.patientId
  const data = await buildPatientExport(pid, user.id)
  await audit(user, 'lgpd_exportacao', 'paciente', { entityId: pid, patientId: pid })
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="meus-dados-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
