import { z } from 'zod'
import { ForbiddenError } from './auth/session'

export type ActionState = {
  ok?: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
  links?: { href: string; label: string }[]
}

export const initialState: ActionState = {}

/** Converte erros do Zod em mensagens por campo. */
export function zodErrors(err: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_'
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { error: 'Revise os campos destacados.', fieldErrors }
}

/** Lê FormData como objeto simples (último valor de cada chave). */
export function formObject(fd: FormData) {
  const o: Record<string, string> = {}
  for (const [k, v] of fd.entries()) if (typeof v === 'string') o[k] = v
  return o
}

/** Traduz erros esperados em mensagens; os inesperados vão para o log sem detalhes ao usuário. */
export function failure(err: unknown): ActionState {
  if (err instanceof ForbiddenError) return { error: 'Você não tem permissão para esta ação.' }
  if (err instanceof UserError) return { error: err.message }
  // redirect()/notFound() lançam erros de controle que precisam subir.
  if (err && typeof err === 'object' && 'digest' in err && String((err as { digest: unknown }).digest).startsWith('NEXT_')) throw err
  console.error(err)
  return { error: 'Não foi possível concluir. Tente novamente em instantes.' }
}

export class UserError extends Error {}
