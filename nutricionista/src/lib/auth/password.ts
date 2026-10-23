import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto'

// Parâmetros recomendados pela OWASP para scrypt (N=2^17, r=8, p=1).
const N = 2 ** 17
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 256 * 1024 * 1024

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )
}

/** Gera o hash no formato scrypt$N$r$p$salt$hash (nunca guardamos a senha). */
export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) {
    // Mantém o tempo de resposta parecido quando o usuário não existe.
    await derive(password, randomBytes(16), N, R, P)
    return false
  }
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt') return false
  const expected = Buffer.from(hash, 'base64')
  const key = await derive(password, Buffer.from(salt, 'base64'), Number(n), Number(r), Number(p))
  return key.length === expected.length && timingSafeEqual(key, expected)
}

/** Regras mínimas de senha: 10+ caracteres, letras e números. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (pw.length > 200) return 'A senha é longa demais.'
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Use letras e números na senha.'
  return null
}
