'use client'

import { useState, useTransition, type ReactNode } from 'react'

/**
 * Primeiro acesso em 3 telas: boas-vindas, notificações e anamnese.
 * `onFinish` marca o onboarding como concluído (Server Action no sistema).
 */
export function Onboarding({
  firstName,
  professional,
  anamneseUrl,
  anamnesisDone,
  onFinish,
  pushToggle,
}: {
  firstName: string
  professional: string
  anamneseUrl: string | null
  anamnesisDone: boolean
  onFinish: () => Promise<void>
  /** Botão que ativa o push neste aparelho (no sistema); sem ele, só pede a permissão. */
  pushToggle?: ReactNode
}) {
  const [step, setStep] = useState(0)
  const [notif, setNotif] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [closed, setClosed] = useState(false)
  if (closed) return null
  const finish = () =>
    start(async () => {
      await onFinish()
      setClosed(true)
    })

  const steps = [
    <>
      <h2>Boas-vindas, {firstName}!</h2>
      <p>Aqui você encontra o seu plano alimentar do dia, registra refeições, água e peso e fala com {professional}.</p>
      <p className="small muted">Em até dois toques você sabe o que comer agora.</p>
    </>,
    <>
      <h2>Lembretes</h2>
      <p>Você pode receber lembretes dos horários das refeições e da água, e um aviso quando o plano ou uma mensagem chegar. Você escolhe o que receber em Mais → Notificações.</p>
      {pushToggle}
      {notif && <p className="small">{notif}</p>}
      {!pushToggle && (
      <button
        type="button"
        className="btn"
        onClick={async () => {
          if (!('Notification' in window)) return setNotif('Este navegador não oferece notificações.')
          const r = await Notification.requestPermission()
          setNotif(r === 'granted' ? 'Notificações permitidas. Os lembretes automáticos chegam na próxima atualização do app.' : 'Tudo bem, você pode ativar depois.')
        }}
      >
        Permitir notificações
      </button>
      )}
    </>,
    <>
      <h2>Sua anamnese</h2>
      {anamnesisDone ? (
        <p>Sua anamnese já foi recebida. Obrigado!</p>
      ) : (
        <>
          <p>A anamnese ajuda {professional} a montar um plano que combine com a sua rotina e a sua saúde.</p>
          {anamneseUrl && (
            <a href={anamneseUrl} target="_blank" rel="noopener noreferrer" className="btn btn--primary">
              Preencher anamnese
            </a>
          )}
        </>
      )}
    </>,
  ]

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Primeiro acesso">
      <div className="onboarding__card">
        <div className="onboarding__dots" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} aria-current={i === step ? 'step' : undefined} />
          ))}
        </div>
        <div className="stack">{steps[step]}</div>
        <div className="row" style={{ justifyContent: 'center', marginTop: 20 }}>
          {step > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
          {step < steps.length - 1 ? (
            <button type="button" className="btn btn--primary" onClick={() => setStep(step + 1)} autoFocus>
              Continuar
            </button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={finish} disabled={pending}>
              {pending ? 'Abrindo…' : 'Começar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
