import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { audit } from '@/lib/audit'
import { getSettings } from '@/lib/settings'
import { appointmentsInRange, paymentsInRange, toCsv, weightEvolution } from '@/lib/reports'
import { addDays, isValidDay, startOfMonth, todayIn, zonedParts } from '@/lib/time'
import { STATUS_LABEL } from '@/lib/format'
import { db, schema } from '@/db'
import { isNull } from 'drizzle-orm'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role === 'patient' || !can(user, 'relatorios')) return new Response('Não autorizado', { status: 403 })
  const s = await getSettings()
  const url = new URL(req.url)
  const tipo = url.searchParams.get('tipo')
  const today = todayIn(s.timezone)
  const de = url.searchParams.get('de')
  const ate = url.searchParams.get('ate')
  const from = isValidDay(de) ? de : startOfMonth(today)
  const to = addDays(isValidDay(ate) ? ate : today, 1)
  const range = { from, to, tz: s.timezone }
  let csv: string

  if (tipo === 'atendimentos') {
    const rows = await appointmentsInRange(range)
    csv = toCsv(
      ['data', 'hora', 'paciente', 'servico', 'modalidade', 'situacao', 'valor'],
      rows.map((a) => {
        const p = zonedParts(a.startAt, s.timezone)
        return [p.date, p.time, a.contactName, a.serviceName, a.modality, STATUS_LABEL[a.status], (a.priceCents / 100).toFixed(2).replace('.', ',')]
      }),
    )
  } else if (tipo === 'pacientes') {
    if (!can(user, 'cadastro')) return new Response('Não autorizado', { status: 403 })
    const rows = await db.select().from(schema.patients).where(isNull(schema.patients.anonymizedAt))
    csv = toCsv(['nome', 'situacao', 'etapa', 'proximo_retorno', 'cadastro'], rows.map((p) => [p.fullName, STATUS_LABEL[p.status], p.stage, p.nextFollowUp ?? '', p.createdAt.toISOString().slice(0, 10)]))
  } else if (tipo === 'evolucao') {
    if (!can(user, 'clinico')) return new Response('Não autorizado', { status: 403 })
    const rows = await weightEvolution()
    csv = toCsv(
      ['paciente', 'primeira_data', 'primeiro_peso', 'ultima_data', 'ultimo_peso', 'variacao_kg', 'avaliacoes'],
      rows.map((e) => [e.name, String(e.first_date).slice(0, 10), e.first_w, String(e.last_date).slice(0, 10), e.last_w, (e.last_w - e.first_w).toFixed(1), e.n]),
    )
  } else if (tipo === 'receitas') {
    if (!s.financeEnabled || !can(user, 'financeiro')) return new Response('Não autorizado', { status: 403 })
    const rows = await paymentsInRange(range)
    csv = toCsv(
      ['data_pagamento', 'paciente', 'descricao', 'valor_bruto', 'desconto', 'valor_liquido', 'forma', 'origem'],
      rows.map(({ pay, name }) => [
        pay.paidAt,
        name ?? '',
        pay.description,
        (pay.amountCents / 100).toFixed(2).replace('.', ','),
        (pay.discountCents / 100).toFixed(2).replace('.', ','),
        ((pay.amountCents - pay.discountCents) / 100).toFixed(2).replace('.', ','),
        pay.method ?? '',
        pay.source === 'provedor' ? `provedor (${pay.provider})` : 'registro interno',
      ]),
    )
  } else {
    return new Response('Tipo de relatório inválido', { status: 400 })
  }
  await audit(user, 'relatorio_exportado', 'relatorio', { details: { tipo, from, to } })
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="relatorio-${tipo}-${from}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
