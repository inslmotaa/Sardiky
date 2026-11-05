/**
 * Links de redes e contato só com valores reais: um campo vazio, "PREENCHER…" ou só "https://instagram.com/"
 * não vira ícone nem link no site.
 */
const HANDLE = /^[A-Za-z0-9._]{1,30}$/

/** Aceita "@usuario", "usuario" ou o endereço do perfil; devolve o link certo e o @, ou null. */
export function instagramLink(raw: string | null | undefined): { url: string; handle: string } | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  const handle = v
    .replace(/^https?:\/\/(www\.)?instagram\.com\/?/i, '')
    .replace(/^instagram\.com\/?/i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
  if (!HANDLE.test(handle) || /^\.|\.$/.test(handle)) return null
  return { url: `https://www.instagram.com/${handle}/`, handle }
}

/** E-mail com formato válido vira link mailto; qualquer outra coisa, null. */
export function emailLink(raw: string | null | undefined): { url: string; email: string } | null {
  const v = (raw ?? '').trim()
  if (!/^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(v)) return null
  return { url: `mailto:${v}`, email: v }
}
