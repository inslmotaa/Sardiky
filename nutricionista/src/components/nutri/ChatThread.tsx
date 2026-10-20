'use client'

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from 'react'
import type { ActionState } from '@/lib/action'

export type ChatMessage = {
  id: string
  mine: boolean
  author: string
  body: string
  at: string
  attachment: { url: string; mime: string; title: string } | null
  /** Registro do diário citado na resposta. */
  diary: { meal: string; date: string; photoUrl: string | null; foods: string } | null
  guidance: boolean
  automatic: boolean
  /** Para mensagens minhas: a outra pessoa já leu? */
  read: boolean
}

const MAX_AUDIO_S = 60

/**
 * Conversa paciente ↔ nutricionista: texto, foto, PDF e áudio curto, com indicador de lida.
 * A lista é atualizada ao vivo pela página (LiveUpdates); aqui fica o envio.
 */
export function ChatThread({
  messages,
  action,
  quickReplies = [],
  allowGuidance = false,
  placeholder = 'Escreva sua mensagem',
  emptyText,
}: {
  messages: ChatMessage[]
  action: (state: ActionState, fd: FormData) => Promise<ActionState>
  quickReplies?: string[]
  allowGuidance?: boolean
  placeholder?: string
  emptyText: string
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const [audio, setAudio] = useState<Blob | null>(null)
  const [recording, setRecording] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const text = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const audioUrl = useMemo(() => (audio ? URL.createObjectURL(audio) : null), [audio])
  // Só depois de montar: o servidor não sabe se o navegador grava áudio (evita diferença na hidratação).
  const [canRecord, setCanRecord] = useState(false)
  useEffect(() => setCanRecord('MediaRecorder' in window && !!navigator.mediaDevices), [])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])
  useEffect(() => {
    if (state.ok) {
      form.current?.reset()
      setAudio(null)
      setFileName(null)
    }
  }, [state])
  useEffect(() => {
    if (!recording) return
    const t = setTimeout(() => (recording >= MAX_AUDIO_S ? stopRec() : setRecording((n) => n + 1)), 1000)
    return () => clearTimeout(t)
  })

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m))
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setAudio(new Blob(chunks, { type: r.mimeType || 'audio/webm' }))
        setRecording(0)
      }
      r.start()
      rec.current = r
      setRecording(1)
    } catch {
      alert('Não foi possível usar o microfone. Verifique a permissão do navegador.')
    }
  }
  const stopRec = () => {
    rec.current?.stop()
    rec.current = null
  }

  return (
    <div className="chat">
      <div className="thread" aria-live="polite" aria-label="Conversa">
        {messages.length === 0 && <p className="muted">{emptyText}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.mine ? 'bubble--mine' : ''} ${m.guidance ? 'bubble--guidance' : ''} ${m.automatic ? 'bubble--auto' : ''}`}>
            {m.guidance && <strong className="small">Orientação · </strong>}
            {m.diary && (
              <div className="bubble__quote">
                {m.diary.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.diary.photoUrl} alt="" />
                )}
                <span>
                  Diário · {m.diary.meal} ({m.diary.date})
                  <br />
                  <span className="muted">{m.diary.foods.length > 80 ? `${m.diary.foods.slice(0, 78)}…` : m.diary.foods}</span>
                </span>
              </div>
            )}
            {m.body && <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>}
            {m.attachment && <Attachment a={m.attachment} />}
            <span className="bubble__meta">
              {m.automatic ? 'Resposta automática' : m.author} · {m.at}
              {m.mine && !m.automatic && <span aria-label={m.read ? 'lida' : 'enviada'}> · {m.read ? '✓✓ lida' : '✓ enviada'}</span>}
            </span>
          </div>
        ))}
        <div ref={end} />
      </div>

      <form
        ref={form}
        className="chat__composer"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          if (audio) {
            const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'
            fd.set('attachment', new File([audio], `audio.${ext}`, { type: audio.type }))
          }
          startTransition(() => formAction(fd))
        }}
      >
        {quickReplies.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            {quickReplies.map((r) => (
              <button
                key={r}
                type="button"
                className="chip"
                onClick={() => {
                  if (text.current) text.current.value = r
                  text.current?.focus()
                }}
              >
                {r.length > 36 ? `${r.slice(0, 34)}…` : r}
              </button>
            ))}
          </div>
        )}
        <label className="sr-only" htmlFor="chat-body">
          Mensagem
        </label>
        <textarea
          id="chat-body"
          ref={text}
          name="body"
          rows={2}
          maxLength={5000}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.current?.requestSubmit()
          }}
        />
        {(fileName || audio) && (
          <div className="small row" style={{ gap: 8 }}>
            {fileName && <span>📎 {fileName}</span>}
            {audio && (
              <>
                <audio controls src={audioUrl ?? undefined} style={{ height: 32, maxWidth: '100%' }} />
                <button type="button" className="link-btn small" onClick={() => setAudio(null)}>
                  descartar áudio
                </button>
              </>
            )}
          </div>
        )}
        <div className="row row--between" style={{ alignItems: 'center' }}>
          <div className="row" style={{ gap: 6 }}>
            <label className="btn btn--sm btn--ghost chat__attach">
              📎 Anexar
              <input type="file" name="attachment" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)} />
            </label>
            {canRecord &&
              (recording ? (
                <button type="button" className="btn btn--sm btn--danger" onClick={stopRec}>
                  ■ Parar ({recording}s)
                </button>
              ) : (
                <button type="button" className="btn btn--sm btn--ghost" onClick={startRec} disabled={!!audio}>
                  🎙 Áudio
                </button>
              ))}
            {allowGuidance && (
              <label className="check small">
                <input type="checkbox" name="guidance" /> Destacar como orientação
              </label>
            )}
          </div>
          <button type="submit" className="btn btn--primary" disabled={pending || recording > 0}>
            {pending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        {state.error && (
          <p className="alert alert--error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </form>
    </div>
  )
}

function Attachment({ a }: { a: { url: string; mime: string; title: string } }) {
  if (a.mime.startsWith('image/'))
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="bubble__img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.title} loading="lazy" />
      </a>
    )
  if (a.mime.startsWith('audio/')) return <audio controls preload="none" src={a.url} className="bubble__audio" aria-label="Mensagem de áudio" />
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className="bubble__file">
      📄 {a.title}
    </a>
  )
}
