import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

/**
 * "Entrar com Google" (OpenID Connect, fluxo de código com PKCE).
 * Fica disponível quando GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão definidos.
 * No Google Cloud, cadastre o endereço de retorno: {APP_URL}/api/auth/google/callback
 */
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

export const GOOGLE_COOKIE = 'nutri_google'
const redirectUri = () => `${process.env.APP_URL ?? 'http://localhost:3000'}/api/auth/google/callback`

export type GoogleFlow = { state: string; verifier: string; consent: boolean; plano: string | null; next: string | null }

export function startFlow(opts: { consent: boolean; plano: string | null; next: string | null }) {
  const flow: GoogleFlow = { state: randomBytes(16).toString('base64url'), verifier: randomBytes(32).toString('base64url'), ...opts }
  const challenge = createHash('sha256').update(flow.verifier).digest('base64url')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: flow.state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString()
  return { url: url.toString(), flow }
}

export type GoogleProfile = { sub: string; email: string; name: string }

/** Troca o código pelo id_token direto com o Google (HTTPS + segredo do cliente) e confere os campos. */
export async function finishFlow(code: string, verifier: string): Promise<GoogleProfile | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    console.error('[google] troca do código recusada', res.status)
    return null
  }
  const { id_token } = (await res.json()) as { id_token?: string }
  const part = id_token?.split('.')[1]
  if (!part) return null
  const c = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>
  const okIssuer = c.iss === 'https://accounts.google.com' || c.iss === 'accounts.google.com'
  if (!okIssuer || c.aud !== process.env.GOOGLE_CLIENT_ID || typeof c.exp !== 'number' || c.exp * 1000 < Date.now()) return null
  if (c.email_verified !== true || typeof c.email !== 'string' || typeof c.sub !== 'string') return null
  return { sub: c.sub, email: c.email.trim().toLowerCase(), name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 120) : c.email.split('@')[0] }
}
