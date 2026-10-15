import { z } from 'zod'

export const FIELD_TYPES = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  date: 'Data',
  select: 'Lista de opções',
  radio: 'Escolha única',
  checkbox: 'Múltipla escolha',
  consent: 'Aceite (termo)',
} as const

export type FieldType = keyof typeof FIELD_TYPES

export const formFieldSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{1,40}$/),
  label: z.string().trim().min(1, 'Informe o texto da pergunta').max(300),
  type: z.enum(Object.keys(FIELD_TYPES) as [FieldType, ...FieldType[]]),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  help: z.string().trim().max(500).default(''),
})

export const formFieldsSchema = z.array(formFieldSchema).min(1, 'Inclua ao menos uma pergunta').max(80)

export type FormField = z.infer<typeof formFieldSchema>
export type FormAnswers = Record<string, string | string[] | boolean>

export const FORM_KINDS: Record<string, string> = {
  anamnese: 'Anamnese nutricional',
  historico: 'Histórico alimentar',
  rotina: 'Rotina e atividade física',
  preferencias: 'Preferências e restrições',
  acompanhamento: 'Questionário de acompanhamento',
  consentimento: 'Termo de consentimento',
  pre_consulta: 'Questionário pré-consulta',
  questionario: 'Outro questionário',
}

/**
 * Valida as respostas de um formulário contra os campos definidos pelo
 * profissional. Campos desconhecidos são descartados.
 */
export function parseAnswers(fields: FormField[], data: FormData) {
  const answers: FormAnswers = {}
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const key = `f_${f.id}`
    if (f.type === 'checkbox') {
      const values = data
        .getAll(key)
        .map(String)
        .filter((v) => f.options.includes(v))
      if (f.required && values.length === 0) errors[f.id] = 'Selecione ao menos uma opção'
      answers[f.id] = values
      continue
    }
    if (f.type === 'consent') {
      const ok = data.get(key) === 'on'
      if (f.required && !ok) errors[f.id] = 'É necessário aceitar para enviar'
      answers[f.id] = ok
      continue
    }
    const raw = String(data.get(key) ?? '').trim()
    if (!raw) {
      if (f.required) errors[f.id] = 'Campo obrigatório'
      answers[f.id] = ''
      continue
    }
    if (raw.length > 5000) errors[f.id] = 'Resposta muito longa'
    if (f.type === 'number' && Number.isNaN(Number(raw.replace(',', '.')))) errors[f.id] = 'Informe um número'
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) errors[f.id] = 'Data inválida'
    if ((f.type === 'select' || f.type === 'radio') && !f.options.includes(raw)) errors[f.id] = 'Opção inválida'
    answers[f.id] = raw
  }
  return { answers, errors }
}

export function formatAnswer(field: FormField, value: FormAnswers[string] | undefined) {
  if (value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Aceito' : 'Não aceito'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (field.type === 'date') {
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  }
  return value
}
