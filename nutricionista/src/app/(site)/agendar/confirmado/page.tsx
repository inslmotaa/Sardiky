import Link from 'next/link'
import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSettings } from '@/lib/settings'
import { fmtDateTime } from '@/lib/time'
import { whatsappLink } from '@/lib/format'
import { integrationStatus } from '@/lib/integrations'
import { StatusBadge } from '@/components/ui'

export const metadata: Metadata = { title: 'Pedido de agendamento', robots: { index: false } }

export default async function ConfirmedPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams
  const s = await getSettings()
  const code = typeof codigo === 'string' && /^[A-Z0-9]{6,12}$/.test(codigo) ? codigo : null
  // Mostra apenas dados não sensíveis: serviço, data e situação.
  const [a] = code
    ? await db
        .select({ serviceName: schema.appointments.serviceName, startAt: schema.appointments.startAt, status: schema.appointments.status, modality: schema.appointments.modality })
        .from(schema.appointments)
        .where(eq(schema.appointments.code, code))
    : []
  const wa = whatsappLink(s.whatsapp, code ? `Olá! Fiz um pedido de agendamento pelo site. Código: ${code}` : undefined)
  const email = integrationStatus().email

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 680 }}>
        {a ? (
          <div className="card stack">
            <span className="eyebrow">Pedido recebido</span>
            <h1>Seu pedido de agendamento foi registrado</h1>
            <dl className="kv">
              <dt>Código</dt>
              <dd>
                <strong style={{ letterSpacing: '0.08em' }}>{code}</strong>
              </dd>
              <dt>Serviço</dt>
              <dd>{a.serviceName}</dd>
              <dt>Quando</dt>
              <dd>{fmtDateTime(a.startAt, s.timezone)}</dd>
              <dt>Modalidade</dt>
              <dd>{a.modality === 'online' ? 'On-line' : 'Presencial'}</dd>
              <dt>Situação</dt>
              <dd>
                <StatusBadge status={a.status} />
              </dd>
            </dl>
            <p>
              O horário fica reservado para você enquanto a equipe confirma o pedido. Guarde o código acima.{' '}
              {email
                ? 'Você receberá a confirmação por e-mail.'
                : 'A confirmação será feita pela equipe por telefone ou WhatsApp.'}
            </p>
            {!email && (
              <p className="alert alert--info small">
                Envio automático de e-mails e lembretes ainda não configurado neste consultório.
              </p>
            )}
            <div className="card card--soft card--flat">
              <strong>Próximo passo: a anamnese</strong>
              <p className="small" style={{ margin: '4px 0 10px' }}>
                Responder antes da consulta deixa o atendimento mais completo: são perguntas sobre sua rotina, saúde e preferências.
              </p>
              <Link href="/paciente/anamnese" className="btn btn--primary">
                Preencher anamnese
              </Link>
            </div>
            <div className="row">
              {wa && (
                <a href={wa} className="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">
                  Enviar código pelo WhatsApp
                </a>
              )}
              <Link href="/" className="btn">
                Voltar ao site
              </Link>
            </div>
          </div>
        ) : (
          <div className="card">
            <h1>Pedido não encontrado</h1>
            <p>Confira o código ou fale conosco.</p>
            <Link href="/agendar" className="btn btn--primary">
              Fazer um agendamento
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
