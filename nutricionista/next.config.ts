import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

// Next.js injeta scripts inline; sem nonce, 'unsafe-inline' é necessário.
// 'unsafe-eval' só é liberado em desenvolvimento (recarregamento a quente).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },
  // Endereços curtos equivalentes (documento de requisitos): /entrar, /app, /painel.
  async redirects() {
    return [
      { source: '/entrar', destination: '/login', permanent: false },
      { source: '/app', destination: '/paciente', permanent: false },
      { source: '/app/:path*', destination: '/paciente/:path*', permanent: false },
      { source: '/painel', destination: '/admin', permanent: false },
      { source: '/painel/:path*', destination: '/admin/:path*', permanent: false },
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
