/**
 * O que ainda impede o site de ir ao ar: textos de exemplo e dados que faltam.
 * Regra única, usada pelo aviso no Início do painel e por `node scripts/aplicar-perfil.mjs --pendencias`.
 * Recebe as configurações (nomes do banco em camelCase) e devolve a lista do que falta.
 */
const EXEMPLO = /\(Texto de exemplo\s*[—–-]/i

/** @param {{ bio?: string|null, method?: string|null, specialties?: string[]|null, differentials?: string[]|null, contactEmail?: string|null, privacyContact?: string|null, instagram?: string|null, photoFileId?: string|null }} s */
export function pendenciasDoSite(s) {
  const out = []
  const bio = s.bio ?? ''
  if (/PREENCHER/i.test(bio) || !bio.trim()) out.push({ campo: 'bio', texto: 'Biografia ainda com “PREENCHER” (ou vazia)', onde: 'perfil' })
  const emails = [s.contactEmail, s.privacyContact].filter(Boolean)
  if (emails.some((e) => /@example\.(com|org|net)\b|example\.com/i.test(e))) out.push({ campo: 'email', texto: 'E-mail de exemplo (example.com) no contato ou na privacidade', onde: 'perfil' })
  if (!(s.instagram ?? '').trim()) out.push({ campo: 'instagram', texto: 'Instagram vazio', onde: 'perfil' })
  if (!s.photoFileId) out.push({ campo: 'foto', texto: 'Foto profissional não enviada', onde: 'perfil' })
  const sobre = [bio, s.method ?? '', ...(s.specialties ?? []), ...(s.differentials ?? [])]
  if (sobre.some((t) => EXEMPLO.test(t))) out.push({ campo: 'sobre', texto: 'Texto “(Texto de exemplo — …)” na página Sobre', onde: 'perfil' })
  return out
}
