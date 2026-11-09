import 'server-only'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { pdfSafe } from './plan-pdf'
import { money } from './format'
import { valorPorExtenso } from './extenso'

/**
 * Recibo em PDF de um pagamento confirmado, gerado pelo próprio sistema (pdf-lib).
 * Não é nota fiscal: não há integração com emissor de NFS-e.
 */
export type ReciboData = {
  number: number
  issuedOn: string // "09/11/2026"
  paidOn: string | null
  payerName: string
  payerEmail: string | null
  description: string
  amountCents: number
  method: string | null
  providerRef: string | null
  period: string | null
  issuer: { name: string; title: string; document: string | null; siteName: string; contact: string | null; brandColor: string }
}

export const reciboNumero = (n: number) => String(n).padStart(5, '0')

export async function reciboPdf(r: ReciboData) {
  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`Recibo ${reciboNumero(r.number)} — ${r.issuer.siteName}`))
  doc.setAuthor(pdfSafe(r.issuer.name))
  doc.setCreator(pdfSafe(r.issuer.siteName))
  const page = doc.addPage([595.28, 841.89])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const m = /^#([0-9a-f]{6})$/i.exec(r.issuer.brandColor)
  const n = m ? parseInt(m[1], 16) : 0x1f5e3b
  const brand = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  const ink = rgb(0.09, 0.15, 0.12)
  const muted = rgb(0.37, 0.43, 0.39)
  const W = 595.28
  const M = 56
  let y = 780

  const text = (t: string, x: number, size: number, f = font, color = ink) => page.drawText(pdfSafe(t), { x, y, size, font: f, color })
  const wrap = (t: string, size: number, f = font, maxW = W - 2 * M) => {
    const words = pdfSafe(t).split(/\s+/)
    let line = ''
    const lines: string[] = []
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (f.widthOfTextAtSize(next, size) > maxW && line) {
        lines.push(line)
        line = w
      } else line = next
    }
    if (line) lines.push(line)
    for (const l of lines) {
      page.drawText(l, { x: M, y, size, font: f, color: ink })
      y -= size * 1.5
    }
  }

  page.drawRectangle({ x: 0, y: 812, width: W, height: 30, color: brand })
  text(r.issuer.siteName.toUpperCase(), M, 11, bold, rgb(1, 1, 1))
  y = 760
  text('RECIBO', M, 24, bold, brand)
  const no = `Nº ${reciboNumero(r.number)}`
  page.drawText(no, { x: W - M - bold.widthOfTextAtSize(no, 14), y: y + 4, size: 14, font: bold, color: ink })
  y -= 22
  text(`Emitido em ${r.issuedOn}`, M, 10, font, muted)
  y -= 36

  const valor = money(r.amountCents)
  page.drawRectangle({ x: M, y: y - 14, width: W - 2 * M, height: 40, color: rgb(0.95, 0.97, 0.95) })
  text('Valor', M + 14, 10, font, muted)
  page.drawText(pdfSafe(valor), { x: W - M - 14 - bold.widthOfTextAtSize(pdfSafe(valor), 18), y: y - 4, size: 18, font: bold, color: ink })
  y -= 54

  wrap(
    `Recebi de ${r.payerName} a importância de ${valor} (${valorPorExtenso(r.amountCents)}), referente a ${r.description}${r.period ? `, período de ${r.period}` : ''}.`,
    12,
  )
  y -= 14
  const rows: [string, string | null][] = [
    ['Pagamento em', r.paidOn],
    ['Forma de pagamento', r.method],
    ['Código da operação', r.providerRef],
    ['E-mail do cliente', r.payerEmail],
  ]
  for (const [k, v] of rows) {
    if (!v) continue
    text(k, M, 10, font, muted)
    page.drawText(pdfSafe(v), { x: M + 150, y, size: 10, font, color: ink })
    y -= 18
  }

  y -= 40
  page.drawLine({ start: { x: M, y }, end: { x: M + 240, y }, thickness: 0.8, color: muted })
  y -= 16
  text(r.issuer.name, M, 11, bold)
  y -= 15
  text([r.issuer.title, r.issuer.document ? `CPF/CNPJ ${r.issuer.document}` : null].filter(Boolean).join(' · '), M, 10, font, muted)
  if (r.issuer.contact) {
    y -= 14
    text(r.issuer.contact, M, 10, font, muted)
  }

  y = 70
  text('Recibo gerado pelo sistema a partir do pagamento confirmado. Não substitui nota fiscal.', M, 8.5, font, muted)
  return doc.save()
}
