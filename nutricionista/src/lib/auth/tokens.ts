import { createHash, randomBytes } from 'node:crypto'

export function newToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

/** Código curto e legível para confirmação de agendamento. */
export function newCode(len = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(len)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
