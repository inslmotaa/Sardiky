import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { requirePatient } from '@/lib/auth/session'
import { buscarPagamento, buscarPorReferencia, mpConfigured } from '@/lib/mercadopago'
import { processarPagamentoMP, sincronizarAssinatura } from '@/lib/pagamentos'
import { money } from '@/lib/format'
import { AutoRefresh } from '@/components/AutoRefresh'
import { PageHead } from '@/components/ui'

export const metadata: Metadata = { title: 'Pagamento' }

const isUuid = (v: string | undefined): v is string => Boolean(v && /^[0-9a-f-]{36}$/.test(v))

/**
 * Volta do Checkout Pro. Confere o pagamento direto na API do Mercado Pago (pagamentos de teste
 * não disparam webhook e notificações podem se perder) e aplica a mesma regra do webhook.
 * Só mostra e só aplica cobranças do próprio cliente.
 */
export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const user = await requirePatient()
  if (!mpConfigured()) redirect('/paciente/pagamento')

  // Volta da assinatura mensal: confere a situação na API (só a assinatura deste cliente).
  if (sp.assinatura === '1') {
    const [p] = await db.select({ pre: schema.patients.mpPreapprovalId }).from(schema.patients).where(eq(schema.patients.id, user.patientId))
    const id = sp.preapproval_id && sp.preapproval_id === p?.pre ? sp.preapproval_id : p?.pre
    let status: string | null = null
    if (id) status = await sincronizarAssinatura(id, 'retorno').catch(() => null)
    const [paid] = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(and(eq(schema.payments.patientId, user.patientId), eq(schema.payments.status, 'pago'), eq(schema.payments.method, 'Cartão (assinatura)')))
      .limit(1)
    return (
      <div className="stack" style={{ ['--gap' as string]: '16px', maxWidth: 640 }}>
        <PageHead title="Assinatura mensal" />
        {status === 'authorized' ? (
          <p className="alert alert--ok" role="status">
            Assinatura autorizada. A cobrança é feita todo mês no seu cartão e o acesso renova sozinho.{' '}
            {paid ? 'O primeiro pagamento já foi confirmado.' : 'O primeiro pagamento aparece em instantes.'}
          </p>
        ) : (
          <p className="alert alert--info" role="status">
            Ainda não recebemos a autorização da assinatura. Se você concluiu no Mercado Pago, aguarde alguns instantes.
          </p>
        )}
        {!paid && <AutoRefresh seconds={4} />}
        <Link href="/paciente" className="btn btn--primary">
          Ir para a área do cliente
        </Link>
      </div>
    )
  }

  const paymentId = sp.payment_id ?? sp.collection_id
  if (paymentId && /^\d+$/.test(paymentId)) {
    try {
      await processarPagamentoMP(await buscarPagamento(paymentId), 'retorno', user.patientId)
    } catch {
      // Sem resposta da API agora: a tela de espera tenta de novo, e o webhook/cron confirmam depois.
    }
  }
  // A cobrança mostrada é sempre do próprio cliente (pela referência, se for dele; senão a mais recente).
  const ref = isUuid(sp.external_reference) ? sp.external_reference : null
  const mine = (id?: string) =>
    db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.patientId, user.patientId), eq(schema.payments.provider, 'mercadopago'), ...(id ? [eq(schema.payments.id, id)] : [])))
      .orderBy(desc(schema.payments.createdAt))
      .limit(1)
  let [row] = ref ? await mine(ref) : []
  if (!row) [row] = await mine()
  if (!row) redirect('/paciente/pagamento')

  // Ainda pendente: consulta pela referência (Pix pago depois, por exemplo).
  if (row.status === 'pendente') {
    try {
      const found = await buscarPorReferencia(row.id)
      const best = found.find((p) => p.status === 'approved') ?? found[0]
      if (best) await processarPagamentoMP({ ...best, external_reference: row.id }, 'retorno', user.patientId)
      ;[row] = await mine(row.id)
    } catch {
      /* tenta de novo na próxima atualização */
    }
  }

  if (row.status === 'pago') {
    const [p] = await db.select({ at: schema.patients.anamnesisReceivedAt }).from(schema.patients).where(eq(schema.patients.id, user.patientId))
    redirect(p?.at ? '/paciente?pago=1' : '/paciente/anamnese?pago=1')
  }

  const [pkg] = row.packageId ? await db.select().from(schema.packages).where(eq(schema.packages.id, row.packageId)) : []
  const again = `/paciente/pagamento${pkg ? `?plano=${pkg.id}` : ''}`

  if (row.status === 'pendente') {
    return (
      <div className="card anam-thanks" role="status">
        <AutoRefresh seconds={8} />
        <div className="anam-thanks__icon" aria-hidden>
          ⏳
        </div>
        <h1>Aguardando pagamento</h1>
        <p className="muted">
          {row.description} · {money(row.amountCents)}. Se você pagou com Pix, a confirmação costuma levar poucos segundos; boleto pode levar até 3 dias
          úteis. Esta tela se atualiza sozinha.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link href={again} className="btn">
            Escolher outra forma de pagamento
          </Link>
          <Link href="/paciente/mensagens" className="btn btn--ghost">
            Falar com o coach
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="stack" style={{ ['--gap' as string]: '16px', maxWidth: 640 }}>
      <PageHead title="Pagamento não aprovado" subtitle="Nada foi cobrado. Você pode tentar de novo com outra forma de pagamento." />
      <section className="card stack">
        <p style={{ margin: 0 }}>
          {row.description} · {money(row.amountCents)}
          {row.status === 'estornado' ? ' · estornado' : ''}
        </p>
        <Link href={again} className="btn btn--primary" style={{ justifySelf: 'start' }}>
          Tentar de novo
        </Link>
      </section>
    </div>
  )
}
