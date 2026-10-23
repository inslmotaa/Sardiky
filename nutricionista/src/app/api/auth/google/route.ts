import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { GOOGLE_COOKIE, googleConfigured, startFlow } from '@/lib/auth/google'

/** Início do "Entrar com Google". ?consentimento=1 vem do cadastro (Política de privacidade aceita). */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const base = process.env.APP_URL ?? url.origin
  if (!googleConfigured()) return NextResponse.redirect(new URL('/login?erro=google', base))
  const plano = url.searchParams.get('plano')
  const next = url.searchParams.get('next')
  const { url: target, flow } = startFlow({
    consent: url.searchParams.get('consentimento') === '1',
    plano: plano && /^[0-9a-f-]{36}$/.test(plano) ? plano : null,
    next: next && next.startsWith('/') && !next.startsWith('//') ? next.slice(0, 200) : null,
  })
  const jar = await cookies()
  jar.set(GOOGLE_COOKIE, JSON.stringify(flow), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 })
  return NextResponse.redirect(target)
}
