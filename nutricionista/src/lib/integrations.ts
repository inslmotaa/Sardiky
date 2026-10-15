/** Situação real das integrações, derivada da configuração do servidor. */
export function integrationStatus() {
  return {
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    cron: Boolean(process.env.CRON_SECRET),
    // As integrações abaixo ainda não foram implementadas: aparecem como demonstrativas.
    whatsappApi: false,
    payments: false,
    video: false,
  }
}
