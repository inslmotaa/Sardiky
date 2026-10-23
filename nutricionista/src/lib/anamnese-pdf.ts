import 'server-only'
import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib'
import { pdfSafe } from './plan-pdf'
import { ANAMNESIS_STEPS, answerText } from './anamnese-form'
import type { AnamnesisAnswers } from '@/db/schema'

const A4 = { w: 595.28, h: 841.89 }
const M = 48

/** PDF da anamnese (uma versão), organizado por etapa, com a identidade do consultório. */
export async function anamnesisPdf(answers: AnamnesisAnswers, o: { professional: string; registry: string | null; brandColor: string; patient: string; version: number; sentAt: string; generatedAt: string }) {
  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`Anamnese — ${o.patient}`))
  doc.setAuthor(pdfSafe(o.professional))
  doc.setLanguage('pt-BR')
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const n = parseInt(/^#([0-9a-f]{6})$/i.exec(o.brandColor)?.[1] ?? '2f8f57', 16)
  const brand = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  const ink = rgb(0.11, 0.15, 0.14)
  const muted = rgb(0.38, 0.42, 0.4)
  const pages: PDFPage[] = []
  let page!: PDFPage
  let y = 0
  const newPage = () => {
    page = doc.addPage([A4.w, A4.h])
    pages.push(page)
    page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: brand })
    y = A4.h - M
  }
  const wrap = (t: string, size: number, width: number, font = regular) => {
    const out: string[] = []
    for (const para of pdfSafe(t).split('\n')) {
      let cur = ''
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const nx = cur ? `${cur} ${w}` : w
        if (font.widthOfTextAtSize(nx, size) <= width) cur = nx
        else {
          if (cur) out.push(cur)
          cur = w
        }
      }
      out.push(cur)
    }
    return out
  }
  const text = (t: string, { size = 10, font = regular, color = ink, x = M, gap = 3 } = {}) => {
    for (const l of wrap(t, size, A4.w - M - x, font)) {
      if (y - size < M + 30) newPage()
      page.drawText(l, { x, y: y - size, size, font, color })
      y -= size + gap
    }
  }
  newPage()
  text(o.professional, { size: 15, font: bold, color: brand })
  if (o.registry) text(o.registry, { size: 9.5, color: muted })
  y -= 8
  text('Anamnese', { size: 20, font: bold })
  text(`Paciente: ${o.patient}   ·   Versão ${o.version}   ·   Enviada em ${o.sentAt}`, { size: 9.5, color: muted })
  y -= 6
  for (const st of ANAMNESIS_STEPS) {
    if (y < M + 90) newPage()
    y -= 10
    text(st.title, { size: 13, font: bold, color: brand })
    for (const f of st.fields) {
      const v = answerText(f, answers[st.key]?.[f.id])
      text(f.label, { size: 9, font: bold, color: muted, gap: 2 })
      text(v || '—', { size: 10.5, x: M + 8, gap: 3 })
      y -= 3
    }
  }
  pages.forEach((p, i) => {
    p.drawText(pdfSafe(`${o.professional}${o.registry ? ` · ${o.registry}` : ''} · Documento confidencial (dados de saúde)`), { x: M, y: 26, size: 7.5, font: regular, color: muted })
    const pg = `${i + 1}/${pages.length} · gerado em ${o.generatedAt}`
    p.drawText(pdfSafe(pg), { x: A4.w - M - regular.widthOfTextAtSize(pdfSafe(pg), 7.5), y: 26, size: 7.5, font: regular, color: muted })
  })
  return doc.save()
}
