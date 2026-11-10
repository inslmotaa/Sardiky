import { timingSafeEqual } from 'node:crypto'
import { and, desc, eq, lt, ne, or } from 'drizzle-orm'
import { runReminders } from '@/lib/reminders'
import { conciliarPendentes, lembretesDeRenovacao } from '@/lib/pagamentos'
import { checkinReminders } from '@/lib/checkins'
import { resumosDoDia } from '@/lib/resumo-email'
import { EXPORT_RETENTION_DAYS } from '@/lib/lgpd-export'
import { deleteUpload } from '@/lib/storage'
import { db, schema } from '@/db'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'

/**
 * Tarefas periódicas — agende uma chamada a cada 5 minutos:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://seusite/api/cron
 * 1. Lembretes por push: refeições, água, pesagem semanal e pacientes parados há 3 dias.
 * 2b. Mercado Pago: conciliação das cobranças pendentes e lembretes de renovação (7 e 2 dias antes do término).
 * 2c. Check-ins periódicos: push quando abre, no prazo e no dia seguinte, se atrasou.
 * 2d. Resumo do dia por e-mail às 7h, para quem ligou (cota gratuita; até 2 tentativas).
 * 3. Limpeza (no máximo uma vez por hora): sessões e links expirados; interessados não convertidos além do prazo de retenção.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '')
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return new Response('Não autorizado', { status: 401 })
  }
  const s = await getSettings()
  // Só nos testes automáticos (CRON_TEST_CLOCK=1): o cabeçalho x-cron-now simula o horário da execução.
  const fake = process.env.CRON_TEST_CLOCK === '1' ? req.headers.get('x-cron-now') : null
  const now = fake && !Number.isNaN(Date.parse(fake)) ? new Date(fake) : new Date()
  // Lembretes de consulta (24 h e 2 h) saíram com o agendamento: o acompanhamento é por planos.
  const reminders = 0
  const push = await runReminders(now)
  // Mercado Pago: confere cobranças pendentes (Pix/boleto, testes sem webhook) e avisa renovações.
  const pagamentos = await conciliarPendentes(now)
  const renovacoes = await lembretesDeRenovacao()
  // Check-ins: aviso quando abre, no dia do prazo e no dia seguinte, se atrasou.
  const checkins = await checkinReminders(now)
  // Resumo do dia por e-mail às 7h (opcional, dentro da cota gratuita). Falha aqui não derruba os outros canais.
  const resumos = await resumosDoDia(now).catch((err) => {
    console.error('[cron] resumo por e-mail', err)
    return { enviados: 0, falhas: 1 }
  })

  // A limpeza roda no máximo uma vez por hora.
  const [lastRun] = await db
    .select({ at: schema.auditLogs.createdAt })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.action, 'tarefas_periodicas'))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1)
  if (lastRun && now.getTime() - lastRun.at.getTime() < 55 * 60_000) {
    return Response.json({ lembretesEmail: reminders, push, pagamentos, renovacoes, checkins, resumos })
  }

  const sessions = await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).returning({ id: schema.sessions.id })
  const tokens = await db
    .delete(schema.authTokens)
    .where(or(lt(schema.authTokens.expiresAt, now), lt(schema.authTokens.createdAt, new Date(now.getTime() - 30 * 86_400_000))))
    .returning({ id: schema.authTokens.id })
  const leads = await db
    .delete(schema.leads)
    .where(and(ne(schema.leads.status, 'convertido'), lt(schema.leads.createdAt, new Date(now.getTime() - s.leadRetentionDays * 86_400_000))))
    .returning({ id: schema.leads.id })
  // Exportações LGPD automáticas: guardadas só pelo prazo de entrega ao titular (30 dias).
  const oldExports = await db
    .delete(schema.files)
    .where(and(eq(schema.files.kind, 'lgpd_exportacao'), lt(schema.files.createdAt, new Date(now.getTime() - EXPORT_RETENTION_DAYS * 86_400_000))))
    .returning({ key: schema.files.storageKey })
  for (const f of oldExports) await deleteUpload(f.key)
  const result = { lembretesEmail: reminders, push, pagamentos, renovacoes, checkins, resumos, sessoesRemovidas: sessions.length, linksRemovidos: tokens.length, interessadosEliminados: leads.length, exportacoesApagadas: oldExports.length }
  await audit(null, 'tarefas_periodicas', 'sistema', { details: result })
  return Response.json(result)
}
