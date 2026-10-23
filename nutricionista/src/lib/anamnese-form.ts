import { z } from 'zod'

/**
 * Anamnese preenchida no site, em etapas. A mesma definição monta o formulário do paciente,
 * valida cada etapa (zod), organiza as respostas no painel e gera o PDF.
 */

export type AnamField = {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'time' | 'number' | 'files'
  required?: boolean
  options?: string[]
  hint?: string
  placeholder?: string
  /** Números: limites e unidade. */
  min?: number
  max?: number
  unit?: string
}
export type AnamStep = { key: string; title: string; intro?: string; fields: AnamField[] }

const ta = (id: string, label: string, extra: Partial<AnamField> = {}): AnamField => ({ id, label, type: 'textarea', ...extra })

export const ANAMNESIS_STEPS: AnamStep[] = [
  {
    key: 'pessoais',
    title: 'Dados pessoais',
    fields: [
      { id: 'nascimento', label: 'Data de nascimento', type: 'date', required: true },
      { id: 'sexo', label: 'Sexo', type: 'select', required: true, options: ['Feminino', 'Masculino', 'Prefiro não informar'] },
      { id: 'profissao', label: 'Profissão', type: 'text' },
      { id: 'cidade', label: 'Cidade', type: 'text', required: true, placeholder: 'Ex.: Curitiba/PR' },
    ],
  },
  {
    key: 'objetivo',
    title: 'Objetivo',
    fields: [
      {
        id: 'principal',
        label: 'Objetivo principal',
        type: 'select',
        required: true,
        options: ['Emagrecimento', 'Ganho de massa muscular', 'Performance esportiva', 'Saúde e qualidade de vida', 'Reeducação alimentar', 'Outro'],
      },
      { id: 'prazo', label: 'Em quanto tempo você gostaria de chegar lá?', type: 'select', options: ['1 a 3 meses', '3 a 6 meses', '6 a 12 meses', 'Mais de 1 ano', 'Sem prazo definido'] },
      ta('motivacao', 'O que motivou você a buscar acompanhamento agora?'),
    ],
  },
  {
    key: 'saude',
    title: 'Saúde',
    intro: 'Se não tiver nada para informar em algum campo, deixe em branco.',
    fields: [
      ta('doencas', 'Doenças ou condições de saúde', { placeholder: 'Ex.: hipertensão, diabetes, hipotireoidismo' }),
      ta('medicamentos', 'Medicamentos em uso'),
      ta('suplementos', 'Suplementos em uso'),
      ta('alergias', 'Alergias e intolerâncias alimentares', { placeholder: 'Ex.: lactose, glúten, frutos do mar' }),
      ta('cirurgias', 'Cirurgias'),
      ta('exames', 'Exames recentes (descreva ou anexe abaixo)'),
      { id: 'arquivos', label: 'Anexar exames (PDF ou foto)', type: 'files', hint: 'Opcional. Os arquivos ficam em área privada: só você e o coach acessam.' },
    ],
  },
  {
    key: 'medidas',
    title: 'Medidas',
    fields: [
      { id: 'peso', label: 'Peso', type: 'number', required: true, min: 25, max: 350, unit: 'kg', placeholder: 'Ex.: 72,5' },
      { id: 'altura', label: 'Altura', type: 'number', required: true, min: 100, max: 230, unit: 'cm', placeholder: 'Ex.: 170' },
      { id: 'cintura', label: 'Circunferência da cintura', type: 'number', min: 40, max: 220, unit: 'cm', hint: 'Opcional. Meça na altura do umbigo.' },
    ],
  },
  {
    key: 'rotina',
    title: 'Rotina',
    fields: [
      { id: 'acorda', label: 'Horário em que acorda', type: 'time', required: true },
      { id: 'dorme', label: 'Horário em que dorme', type: 'time', required: true },
      ta('trabalho', 'Como é seu trabalho?', { placeholder: 'Horários, turnos, se passa o dia sentado ou em pé…' }),
      {
        id: 'atividade',
        label: 'Nível de atividade física',
        type: 'select',
        required: true,
        options: ['Sedentário', 'Levemente ativo', 'Moderadamente ativo', 'Muito ativo', 'Atleta'],
      },
      { id: 'treinos', label: 'Treinos por semana', type: 'number', min: 0, max: 14, placeholder: 'Ex.: 3' },
    ],
  },
  {
    key: 'alimentacao',
    title: 'Alimentação',
    fields: [
      { id: 'refeicoes', label: 'Refeições por dia', type: 'number', required: true, min: 1, max: 12, placeholder: 'Ex.: 4' },
      ta('habitual', 'O que você costuma comer em um dia normal?', { required: true, placeholder: 'Café da manhã, almoço, lanches, jantar…' }),
      ta('preferencias', 'Alimentos de que mais gosta'),
      ta('aversoes', 'Alimentos de que não gosta'),
      { id: 'agua', label: 'Consumo de água por dia', type: 'select', required: true, options: ['Menos de 1 L', '1 a 2 L', '2 a 3 L', 'Mais de 3 L'] },
      { id: 'alcool', label: 'Bebida alcoólica', type: 'select', options: ['Não bebo', 'Raramente', 'Fins de semana', 'Várias vezes por semana', 'Todos os dias'] },
      {
        id: 'intestino',
        label: 'Funcionamento do intestino',
        type: 'select',
        options: ['Todos os dias', 'A cada 2 ou 3 dias', 'Preso (menos de 3 vezes por semana)', 'Solto com frequência', 'Irregular'],
      },
    ],
  },
]

/** Etapa final (revisão e envio) conta na barra de progresso. */
export const ANAMNESIS_TOTAL_STEPS = ANAMNESIS_STEPS.length + 1

export type AnamFile = { id: string; title: string }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

/** Validação de uma etapa a partir da definição dos campos. */
export function stepSchema(step: AnamStep) {
  const shape: Record<string, z.ZodType> = {}
  for (const f of step.fields) {
    if (f.type === 'files') {
      shape[f.id] = z.array(z.object({ id: z.uuid(), title: z.string().max(200) })).max(10).default([])
      continue
    }
    let s: z.ZodType
    const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
    const req = (msg: string) => (f.required ? msg : '')
    switch (f.type) {
      case 'number':
        s = z
          .string()
          .trim()
          .refine((v) => !v || Number.isFinite(num(v)), 'Use só números')
          .transform((v) => (v ? num(v) : null))
          .refine((v) => v === null || ((f.min === undefined || v >= f.min) && (f.max === undefined || v <= f.max)), `Entre ${f.min} e ${f.max}${f.unit ? ` ${f.unit}` : ''}`)
        break
      case 'date':
        s = z
          .string()
          .trim()
          .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01' && v <= new Date().toISOString().slice(0, 10)), 'Data inválida')
        break
      case 'time':
        s = z
          .string()
          .trim()
          .refine((v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Horário inválido')
        break
      case 'select':
        s = z
          .string()
          .trim()
          .refine((v) => !v || f.options!.includes(v), 'Escolha uma opção da lista')
        break
      default:
        s = z.string().trim().max(f.type === 'textarea' ? 3000 : 200)
    }
    shape[f.id] = z.preprocess((v) => (blank(v) ? '' : v), s).refine((v) => !f.required || !blank(v), req(f.type === 'select' ? 'Escolha uma opção' : 'Campo obrigatório'))
  }
  return z.object(shape)
}

/** Etapa completa? (usado no envio para garantir que nenhuma etapa obrigatória ficou para trás) */
export function stepComplete(step: AnamStep, answers: Record<string, unknown> | undefined) {
  const r = stepSchema(step).safeParse(Object.fromEntries(step.fields.map((f) => [f.id, f.type === 'files' ? (answers?.[f.id] ?? []) : String(answers?.[f.id] ?? '')])))
  return r.success
}

/** Texto de uma resposta para exibição (painel, revisão e PDF). */
export function answerText(f: AnamField, v: unknown): string {
  if (v === undefined || v === null || v === '') return ''
  if (f.type === 'files') return (v as AnamFile[]).map((x) => x.title).join(', ')
  if (f.type === 'date' && typeof v === 'string') return v.split('-').reverse().join('/')
  if (f.type === 'number') return `${String(v).replace('.', ',')}${f.unit ? ` ${f.unit}` : ''}`
  return String(v)
}
