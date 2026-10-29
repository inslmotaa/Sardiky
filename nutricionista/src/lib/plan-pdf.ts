import 'server-only'
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { dayTotals, optionTotals, quantityLabel, sortedMeals, type PlanContent } from './plan'
import { fmt, formatMeasure, scale } from './nutricao'
import { PRESCRIPTION_TYPES } from './constants'

/**
 * PDF do plano alimentar com a identidade do consultório (nome, registro profissional e cor).
 * Fontes padrão do PDF (Helvetica): cobrem acentos do português; símbolos fora da tabela são trocados.
 */

const A4 = { w: 595.28, h: 841.89 }
const M = 48 // margem

const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
/** Mantém só caracteres que a fonte padrão do PDF consegue desenhar. */
export function pdfSafe(s: string) {
  return s
    .replace(/↔/g, '<->')
    .replace(/→/g, '->')
    .replace(/≈/g, '~')
    .replace(/[✓✔]/g, 'v')
    .replace(/\t/g, ' ')
    .split('')
    .filter((c) => {
      const n = c.charCodeAt(0)
      return c === '\n' || (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || CP1252_EXTRA.includes(c)
    })
    .join('')
}

function hexToRgb(hex: string): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  const n = m ? parseInt(m[1], 16) : 0x2f5d50
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

type Opts = {
  professionalName: string
  professionalTitle: string
  registry: string | null
  brandColor: string
  patientName: string | null
  title: string
  validity: string | null
  generatedAt: string
  showKcal: boolean
  showMacros: boolean
  contact: string | null
  prescriptions?: { type: string; name: string; dose: string | null; schedule: string | null; duration: string | null; notes: string | null }[]
  /** Assinatura no fim do plano: texto e imagem (PNG/JPG) opcionais. */
  signature?: { text: string | null; image: { bytes: Uint8Array; mime: string } | null }
  /** Logo do consultório no cabeçalho (PNG/JPG). */
  logo?: { bytes: Uint8Array; mime: string } | null
}

export async function planPdf(plan: PlanContent, o: Opts) {
  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`${o.title}${o.patientName ? ` — ${o.patientName}` : ''}`))
  doc.setAuthor(pdfSafe(o.professionalName))
  doc.setCreator('Área do cliente')
  doc.setLanguage('pt-BR')
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)
  const brand = hexToRgb(o.brandColor)
  const ink = rgb(0.11, 0.15, 0.14)
  const muted = rgb(0.38, 0.42, 0.4)
  const line = rgb(0.87, 0.86, 0.83)

  let page!: PDFPage
  let y = 0
  const pages: PDFPage[] = []

  const newPage = () => {
    page = doc.addPage([A4.w, A4.h])
    pages.push(page)
    // Faixa da marca no topo.
    page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: brand })
    y = A4.h - M
  }
  const ensure = (h: number) => {
    if (y - h < M + 30) newPage()
  }
  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const out: string[] = []
    for (const para of pdfSafe(text).split('\n')) {
      let cur = ''
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word
        if (font.widthOfTextAtSize(next, size) <= width) cur = next
        else {
          if (cur) out.push(cur)
          cur = word
        }
      }
      out.push(cur)
    }
    return out
  }
  const text = (s: string, { font = regular, size = 10, color = ink, x = M, width = A4.w - 2 * M, gap = 3 } = {}) => {
    for (const l of wrap(s, font, size, width)) {
      ensure(size + gap)
      page.drawText(l, { x, y: y - size, size, font, color })
      y -= size + gap
    }
  }
  const rule = (color = line) => {
    ensure(8)
    page.drawLine({ start: { x: M, y: y - 3 }, end: { x: A4.w - M, y: y - 3 }, thickness: 0.7, color })
    y -= 10
  }

  newPage()
  if (o.logo) {
    try {
      const img = o.logo.mime === 'image/png' ? await doc.embedPng(o.logo.bytes) : await doc.embedJpg(o.logo.bytes)
      const k = Math.min(56 / img.width, 56 / img.height)
      page.drawImage(img, { x: A4.w - M - img.width * k, y: A4.h - M - img.height * k + 6, width: img.width * k, height: img.height * k })
    } catch {
      // Formato de imagem não suportado: segue sem logo.
    }
  }
  // Cabeçalho: profissional e registro.
  text(o.professionalName, { font: bold, size: 16, color: brand })
  text([o.professionalTitle, o.registry].filter(Boolean).join(' · '), { size: 10, color: muted })
  y -= 8
  text(o.title, { font: bold, size: 20 })
  const meta = [o.patientName ? `Paciente: ${o.patientName}` : 'Modelo de plano', o.validity, `Gerado em ${o.generatedAt}`].filter(Boolean).join('   ·   ')
  text(meta, { size: 9.5, color: muted })
  y -= 4
  rule(brand)

  const calc = plan.mode === 'calculado'
  const nutriLine = (n: { kcal: number; protein: number; carbs: number; fat: number }) =>
    [o.showKcal ? `${fmt(n.kcal, 0)} kcal` : null, o.showMacros ? `P ${fmt(n.protein)} g · C ${fmt(n.carbs)} g · G ${fmt(n.fat)} g` : null].filter(Boolean).join(' · ')

  for (const day of plan.days) {
    if (plan.days.length > 1) {
      ensure(40)
      y -= 6
      text(day.label, { font: bold, size: 14, color: brand })
      if (day.weekdays.length) text(`Dias: ${day.weekdays.map((d) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d]).join(', ')}`, { size: 9, color: muted })
    }
    for (const meal of sortedMeals(day)) {
      ensure(48)
      y -= 6
      const head = `${meal.name}${meal.time ? `  ·  ${meal.time.replace(':', 'h')}` : ''}`
      text(head, { font: bold, size: 12 })
      if (meal.notes) text(meal.notes, { font: italic, size: 9.5, color: muted })
      meal.options.forEach((opt, oi) => {
        if (meal.options.length > 1) text(opt.label || `Opção ${oi + 1}`, { font: bold, size: 10, color: brand, x: M + 6 })
        for (const it of opt.items) {
          const q = quantityLabel(it)
          const n = calc && it.per100 && it.grams ? scale(it.per100, it.grams) : null
          const right = n && (o.showKcal || o.showMacros) ? `  (${nutriLine(n)})` : ''
          text(`•  ${it.name}${q ? ` — ${q}` : ''}${right}`, { size: 10, x: M + 12, width: A4.w - 2 * M - 12 })
          if (it.notes) text(it.notes, { font: italic, size: 9, color: muted, x: M + 24, width: A4.w - 2 * M - 24 })
          if (it.locked) text('Sem substituição', { font: italic, size: 9, color: muted, x: M + 24 })
          else if (it.subs.length)
            text(
              `Pode trocar por: ${it.subs
                .map((sb) => `${sb.name}${sb.measure && sb.measure.qty > 0 ? ` — ${formatMeasure(sb.measure.qty, sb.measure.name)}` : ''}${sb.grams ? ` (${Math.round(sb.grams)} g)` : sb.text ? ` (${sb.text})` : ''}`)
                .join('; ')}`,
              { size: 9, color: muted, x: M + 24, width: A4.w - 2 * M - 24 },
            )
        }
        if (calc && opt.items.length && (o.showKcal || o.showMacros)) text(`Subtotal: ${nutriLine(optionTotals(opt))}`, { size: 9, color: muted, x: M + 12 })
      })
    }
    if (calc && (o.showKcal || o.showMacros)) {
      y -= 2
      rule()
      text(`Total do dia${plan.days.length > 1 ? ` (${day.label})` : ''}: ${nutriLine(dayTotals(day))}`, { font: bold, size: 10 })
    }
  }

  if (plan.guidance?.trim()) {
    ensure(50)
    y -= 10
    text('Orientações gerais', { font: bold, size: 13, color: brand })
    text(plan.guidance, { size: 10 })
  }

  if (o.prescriptions?.length) {
    ensure(50)
    y -= 10
    text('Prescrições', { font: bold, size: 13, color: brand })
    for (const p of o.prescriptions) {
      text(`•  ${p.name} (${PRESCRIPTION_TYPES[p.type] ?? p.type})`, { font: bold, size: 10, x: M + 6 })
      const det = [p.dose, p.schedule, p.duration].filter(Boolean).join(' · ')
      if (det) text(det, { size: 9, color: muted, x: M + 18 })
      if (p.notes) text(p.notes, { size: 9.5, x: M + 18, width: A4.w - 2 * M - 18 })
      y -= 4
    }
  }

  if (o.signature) {
    ensure(110)
    y -= 26
    if (o.signature.image) {
      try {
        const img = o.signature.image.mime === 'image/png' ? await doc.embedPng(o.signature.image.bytes) : await doc.embedJpg(o.signature.image.bytes)
        const scaleK = Math.min(160 / img.width, 56 / img.height, 1)
        page.drawImage(img, { x: M, y: y - img.height * scaleK, width: img.width * scaleK, height: img.height * scaleK })
        y -= img.height * scaleK + 4
      } catch {
        // Imagem em formato não suportado: segue só com o texto.
      }
    }
    page.drawLine({ start: { x: M, y: y - 2 }, end: { x: M + 200, y: y - 2 }, thickness: 0.6, color: ink })
    y -= 8
    text(o.professionalName, { font: bold, size: 10 })
    text([o.professionalTitle, o.registry].filter(Boolean).join(' · '), { size: 9, color: muted })
    if (o.signature.text) text(o.signature.text, { size: 9, color: muted })
  }

  // Rodapé em todas as páginas.
  pages.forEach((p, i) => {
    const foot = pdfSafe(`${o.professionalName}${o.registry ? ` · ${o.registry}` : ''}${o.contact ? ` · ${o.contact}` : ''}`)
    p.drawLine({ start: { x: M, y: 40 }, end: { x: A4.w - M, y: 40 }, thickness: 0.5, color: line })
    p.drawText(foot, { x: M, y: 28, size: 8, font: regular, color: muted })
    p.drawText(pdfSafe('Plano individual. Não substitui atendimento médico de urgência.'), { x: M, y: 18, size: 7.5, font: italic, color: muted })
    const pg = `${i + 1}/${pages.length}`
    p.drawText(pg, { x: A4.w - M - regular.widthOfTextAtSize(pg, 8), y: 28, size: 8, font: regular, color: muted })
  })
  return doc.save()
}
