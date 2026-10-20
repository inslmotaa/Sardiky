/** Situação real das integrações, derivada da configuração do servidor. */
export function integrationStatus() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    cron: Boolean(process.env.CRON_SECRET),
    // Em produção exige as chaves VAPID; em desenvolvimento um par local é criado automaticamente.
    push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) || process.env.NODE_ENV !== 'production' || process.env.ALLOW_PGLITE === '1',
    // As integrações abaixo ainda não foram implementadas: aparecem como demonstrativas.
    whatsappApi: false,
    payments: false,
    video: false,
  }
}
