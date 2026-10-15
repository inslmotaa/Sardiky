'use client'

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/lib/action'

type Action = (state: ActionState, data: FormData) => Promise<ActionState>

const FormContext = createContext<{ errors?: Record<string, string>; pending: boolean }>({ pending: false })

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
  encType,
}: {
  action: Action
  children: ReactNode
  className?: string
  resetOnSuccess?: boolean
  confirm?: string
  id?: string
  encType?: 'multipart/form-data'
}) {
  const [state, formAction, pending] = useActionState(action, {})
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <form
      ref={ref}
      id={id}
      action={formAction}
      encType={encType}
      className={className}
      aria-busy={pending}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (confirm && !window.confirm(confirm)) return
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
        startTransition(() => formAction(fd))
      }}
    >
      <FormContext.Provider value={{ errors: state.fieldErrors, pending }}>
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
      <p className="alert alert--ok" role="status" style={{ marginTop: 12 }}>
        {state.message}
      </p>
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
  const id = `f-${name}`
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
