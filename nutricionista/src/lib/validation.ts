import { z } from 'zod'
import { isValidDay, isValidTime } from './time'
import { onlyDigits } from './format'

export const str = (max: number, msg = 'Campo obrigatório') => z.string().trim().min(1, msg).max(max, 'Texto muito longo')
export const optStr = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'Texto muito longo')
    .optional()
    .transform((v) => (v ? v : null))

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('E-mail inválido').max(200))

export const optEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((v) => v || null)
  .pipe(z.email('E-mail inválido').max(200).nullable())

export const phone = z
  .string()
  .transform(onlyDigits)
  .pipe(z.string().min(10, 'Telefone com DDD').max(13, 'Telefone inválido'))

export const day = z.string().refine(isValidDay, 'Data inválida')
export const optDay = z
  .string()
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || isValidDay(v), 'Data inválida')
export const time = z.string().refine(isValidTime, 'Horário inválido')

export const optNum = (min: number, max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(',', '.')) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), `Use um valor entre ${min} e ${max}`)

export const int = (min: number, max: number) =>
  z.coerce.number().int('Use um número inteiro').min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`)

export const checkbox = z
  .string()
  .optional()
  .transform((v) => v === 'on' || v === 'true')

export const uuid = z.uuid('Identificador inválido')
