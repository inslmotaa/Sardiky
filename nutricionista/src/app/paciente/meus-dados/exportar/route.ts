import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/audit'
import { buildPatientExport, buildPatientExportZip } from '@/lib/lgpd-export'

/**
 * Portabilidade (LGPD art. 18): exporta os dados do próprio paciente em JSON, ou em ZIP com o JSON e
 * todas as fotos (corpo, pratos, check-ins) e arquivos dele (?formato=zip).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'patient' || !user.patientId) return new Response('Não autorizado', { status: 401 })
  const pid = user.patientId
  const day = new Date().toISOString().slice(0, 10)
  if (new URL(req.url).searchParams.get('formato') === 'zip') {
    const bytes = await buildPatientExportZip(pid, user.id)
    await audit(user, 'lgpd_exportacao', 'paciente', { entityId: pid, patientId: pid, details: { formato: 'zip' } })
    return new Response(new Uint8Array(bytes), {
      headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="meus-dados-${day}.zip"`, 'Cache-Control': 'no-store' },
    })
  }
  const data = await buildPatientExport(pid, user.id)
  await audit(user, 'lgpd_exportacao', 'paciente', { entityId: pid, patientId: pid })
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="meus-dados-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
