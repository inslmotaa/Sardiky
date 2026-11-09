/**
 * Regras dos depoimentos (puras, testadas em tests/unit/depoimentos.test.ts).
 * - Só vai ao site com autorização registrada (data e forma) E aprovação do coach.
 * - Fotos de antes e depois: só com autorização específica (data e forma), separada da do texto.
 */
export type TestimonialRules = {
  text: string
  published: boolean
  authorizedAt: Date | null
  authorizationMethod: string | null
  beforeFileId: string | null
  afterFileId: string | null
  photosAuthorizedAt: Date | null
  photosAuthorizationMethod: string | null
}

export const AUTH_METHODS = { app: 'Pelo app (o cliente marcou "autorizo publicar")', escrita: 'Por escrito (termo assinado)', email: 'Por e-mail', whatsapp: 'Por WhatsApp' } as const
export const PHOTO_AUTH_METHODS = { escrita: 'Por escrito (termo assinado)', email: 'Por e-mail', whatsapp: 'Por WhatsApp' } as const

/** Pode ser aprovado (publicado)? Exige texto e autorização com data e forma. */
export const podePublicar = (t: Pick<TestimonialRules, 'text' | 'authorizedAt' | 'authorizationMethod'>) =>
  Boolean(t.text.trim() && t.authorizedAt && t.authorizationMethod)

/** As fotos aparecem no site? Só se o depoimento está publicado e há autorização específica para as fotos. */
export const fotosPublicas = (t: TestimonialRules) =>
  Boolean(t.published && podePublicar(t) && t.beforeFileId && t.afterFileId && t.photosAuthorizedAt && t.photosAuthorizationMethod)

/** Iniciais para assinar o depoimento: "Beatriz de Souza Exemplo" → "B. S. E." (sem preposições). */
export function iniciais(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => w && !/^(d[aeo]s?|e)$/i.test(w))
    .map((w) => `${w[0]!.toUpperCase()}.`)
    .join(' ')
}

/** Como o cliente quer assinar: só as iniciais (padrão) ou o primeiro nome com a inicial do sobrenome. */
export function assinatura(name: string, modo: 'iniciais' | 'nome') {
  if (modo === 'iniciais') return iniciais(name)
  const parts = name.split(/\s+/).filter((w) => w && !/^(d[aeo]s?|e)$/i.test(w))
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.` : (parts[0] ?? '')
}
