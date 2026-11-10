'use client'

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react'
import { useFormStatus } from 'react-dom'
import { compressImage } from '@/lib/image-compress'
import type { ActionState } from '@/lib/action'

type Action = (state: ActionState, data: FormData) => Promise<ActionState>

// uid: prefixo único por formulário, para que vários formulários na mesma página (ex.: editar cada item de uma lista) não repitam ids.
const FormContext = createContext<{ errors?: Record<string, string>; pending: boolean; uid?: string }>({ pending: false })

/**
 * Formulário ligado a uma Server Action, com mensagens de sucesso/erro.
 * Funciona sem JavaScript (envio tradicional) e, com JavaScript, não apaga
 * o que foi digitado quando há erro de validação.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  confirm,
  id,
  compressImages,
}: {
  action: Action
  children: ReactNode
  className?: string
  resetOnSuccess?: boolean
  confirm?: string
  id?: string
  /** Campos de foto comprimidos no celular antes do envio (1600 px, JPEG 0,8, sem EXIF). */
  compressImages?: string[]
  /** Mantido por clareza nos formulários com arquivo; o React já envia como multipart. */
  encType?: 'multipart/form-data'
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <form
      ref={ref}
      id={id}
      action={formAction}
      className={className}
      aria-busy={pending}
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (confirm && !window.confirm(confirm)) return
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
        if (compressImages?.length) {
          for (const name of compressImages) {
            const files = fd.getAll(name).filter((f): f is File => f instanceof File && f.size > 0)
            if (!files.length) continue
            fd.delete(name)
            for (const f of files) fd.append(name, await compressImage(f))
          }
        }
        startTransition(() => formAction(fd))
      }}
    >
      <FormContext.Provider value={{ errors: state.fieldErrors, pending, uid }}>
        {children}
        <FormMessage state={state} />
      </FormContext.Provider>
    </form>
  )
}

function FormMessage({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p className="alert alert--error" role="alert" style={{ marginTop: 12 }}>
        {state.error}
      </p>
    )
  if (state.ok && state.message)
    return (
      <div className="alert alert--ok" role="status" style={{ marginTop: 12, overflowWrap: 'anywhere' }}>
        {state.message}
        {state.links?.map((l) => (
          <div key={l.href} style={{ marginTop: 8 }}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="btn btn--whatsapp btn--sm">
              {l.label}
            </a>
          </div>
        ))}
      </div>
    )
  return null
}

export function useFieldError(name: string) {
  return useContext(FormContext).errors?.[name]
}

/** Rótulo + controle + dica + erro, com ligações de acessibilidade. */
export function Field({
  label,
  name,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode
  name: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
  className?: string
}) {
  const error = useFieldError(name)
  const uid = useContext(FormContext).uid
  const id = uid ? `f-${uid}-${name}` : `f-${name}`
  return (
    <div className={`field ${className ?? ''}`} data-invalid={error ? 'true' : undefined}>
      <label htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden>
            *
          </span>
        )}
      </label>
      <FieldControl id={id} error={error} hintId={hint ? `${id}-hint` : undefined}>
        {children}
      </FieldControl>
      {hint && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  )
}

function FieldControl({ id, error, hintId, children }: { id: string; error?: string; hintId?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  // Liga rótulo, dica e erro ao controle (input/select/textarea) depois da renderização.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('input, select, textarea')
    if (!el) return
    if (!el.id) el.id = id
    const describedBy = [hintId, error ? `${id}-err` : undefined].filter(Boolean).join(' ')
    if (describedBy) el.setAttribute('aria-describedby', describedBy)
    else el.removeAttribute('aria-describedby')
    if (error) el.setAttribute('aria-invalid', 'true')
    else el.removeAttribute('aria-invalid')
  }, [id, error, hintId])
  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {children}
    </div>
  )
}

export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name)
  return error ? <span className="field__error">{error}</span> : null
}

export function SubmitButton({
  children,
  className = 'btn btn--primary',
  pendingText = 'Salvando…',
  name,
  value,
}: {
  children: ReactNode
  className?: string
  pendingText?: string
  name?: string
  value?: string
}) {
  const status = useFormStatus()
  const pending = useContext(FormContext).pending || status.pending
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending ? pendingText : children}
    </button>
  )
}

export function PrintButton({ label = 'Imprimir / salvar PDF' }: { label?: string }) {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      {label}
    </button>
  )
}

/** Formulário simples (ação do servidor sem retorno) que pede confirmação antes de enviar. */
export function ConfirmForm({ action, confirm, children }: { action: (fd: FormData) => void | Promise<void>; confirm: string; children: ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirm)) e.preventDefault()
      }}
    >
      {children}
    </form>
  )
}
