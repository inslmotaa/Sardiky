/** Versão vigente da Política de Privacidade; registrada junto a cada consentimento. */
export const PRIVACY_VERSION = '2026-10'

export const MATERIAL_KINDS: Record<string, string> = { ebook: 'E-book / PDF', video: 'Vídeo', guia: 'Guia', link: 'Link' }
export const PRESCRIPTION_TYPES = {
  livre: 'Prescrição escrita',
  suplemento: 'Suplemento',
  manipulado: 'Manipulado',
  ergogenico: 'Ergogênico',
  fitoterapico: 'Fitoterápico',
  alimentacao: 'Alimentação',
  exame: 'Exame solicitado',
  outro: 'Outro',
} as Record<string, string>
export const PRESCRIPTION_TYPE_KEYS = ['livre', 'suplemento', 'manipulado', 'ergogenico', 'fitoterapico', 'alimentacao', 'exame', 'outro'] as const

/** Páginas do site público (menu do cabeçalho e rodapé). */
export const SITE_NAV = [
  { href: '/sobre', label: 'Sobre' },
  { href: '/como-funciona', label: 'Como funciona' },
  { href: '/planos', label: 'Planos' },
  { href: '/duvidas', label: 'Dúvidas' },
]
