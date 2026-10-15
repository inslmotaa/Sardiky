export function money(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Converte "1.234,56" ou "1234.56" em centavos. */
export function parseMoney(input: unknown): number | null {
  if (typeof input !== 'string') return null
  const s = input.trim().replace(/[R$\s]/g, '')
  if (!s) return null
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null
  return Math.round(n * 100)
}

export function num(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

export function onlyDigits(s: string) {
  return s.replace(/\D/g, '')
}

export function whatsappLink(phone: string | null | undefined, text?: string) {
  const digits = onlyDigits(phone ?? '')
  if (!digits) return null
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${digits}${q}`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  realizada: 'Realizada',
  faltou: 'Não compareceu',
  ativo: 'Ativo',
  pausado: 'Pausado',
  inativo: 'Inativo',
  alta: 'Alta',
  rascunho: 'Rascunho',
  publicado: 'Publicado',
  arquivado: 'Versão anterior',
  pago: 'Pago',
  estornado: 'Estornado',
  cancelado: 'Cancelado',
  novo: 'Novo',
  contatado: 'Contatado',
  convertido: 'Convertido',
  descartado: 'Descartado',
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  negada: 'Negada',
  ativa: 'Ativa',
}

export const ADHERENCE_LABEL: Record<string, string> = {
  total: 'Segui o plano',
  parcial: 'Segui em parte',
  nao_seguiu: 'Não segui',
}
