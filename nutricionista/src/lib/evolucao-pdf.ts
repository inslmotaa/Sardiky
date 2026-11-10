import 'server-only'
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { eq, inArray } from 'drizzle-orm'
import { db, schema } from '@/db'
import { pdfSafe } from './plan-pdf'
import { readUpload } from './storage'
import { getSettings } from './settings'
import { evolutionData } from './evolucao'
import { ageOn, bmiBand, fmtKgDelta, heightOn } from './corpo'
import { FOTOS_RELATORIO, hasConsent } from './corpo-server'
import { fmtDay, todayIn } from './time'

const W = 595.28
const H = 841.89
const M = 48
const n1 = (v: number) => v.toFixed(1).replace('.', ',')

type Pt = { date: string; value: number; source?: string }

/**
 * Relatório de evolução em PDF (pdf-lib, gerado no servidor): resumo, gráficos de peso e IMC com a
 * meta, medidas, check-ins e, só com a autorização do cliente (consentimento fotos_relatorio), as
 * fotos do corpo da primeira e da última data. O coach pode baixar e mandar pelo WhatsApp.
 */
export async function evolutionReportPdf(patientId: string) {
  const s = await getSettings()
  const today = todayIn(s.timezone)
  const [[p], evo, withPhotos] = await Promise.all([
    db.select().from(schema.patients).where(eq(schema.patients.id, patientId)),
    evolutionData(patientId, today),
    hasConsent(patientId, FOTOS_RELATORIO),
  ])
  const doc = await PDFDocument.create()
  doc.setTitle(pdfSafe(`Relatório de evolução — ${p?.fullName ?? 'Cliente'}`))
  doc.setAuthor(pdfSafe(s.professionalName))
  doc.setCreator(pdfSafe(s.siteName))
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const m = /^#([0-9a-f]{6})$/i.exec(s.brandColor ?? '')
  const c = m ? parseInt(m[1], 16) : 0x1f5e3b
  const brand = rgb(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255)
  const ink = rgb(0.09, 0.15, 0.12)
  const muted = rgb(0.37, 0.43, 0.39)
  const line = rgb(0.85, 0.88, 0.86)

  let page = doc.addPage([W, H])
  let y = H - 60
  const header = (pg: PDFPage) => {
    pg.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color: brand })
    pg.drawText(pdfSafe(s.siteName.toUpperCase()), { x: M, y: H - 20, size: 10, font: bold, color: rgb(1, 1, 1) })
    pg.drawText(pdfSafe('Dados privados: não compartilhe sem autorização do cliente.'), { x: M, y: 24, size: 7.5, font, color: muted })
  }
  header(page)
  const newPage = () => {
    page = doc.addPage([W, H])
    header(page)
    y = H - 60
  }
  const ensure = (h: number) => {
    if (y - h < 50) newPage()
  }
  const text = (t: string, x: number, size: number, f: PDFFont = font, color = ink) => page.drawText(pdfSafe(t), { x, y, size, font: f, color })

  // Cabeçalho
  y = H - 72
  text('Relatório de evolução', M, 22, bold, brand)
  y -= 22
  text(p?.fullName ?? 'Cliente', M, 13, bold)
  y -= 16
  const first = evo.timeline.length ? evo.timeline[evo.timeline.length - 1].date : null
  text(`${first ? `De ${fmtDay(first)} a ${fmtDay(today)}` : `Em ${fmtDay(today)}`} · ${s.professionalName}, ${s.professionalTitle || 'Coach'}`, M, 9.5, font, muted)
  y -= 26

  // Resumo
  const height = heightOn(today, evo.heights, p?.heightCm ?? null)
  const age = ageOn(p?.birthDate, today)
  const sm = evo.summary
  const boxes: [string, string][] = [
    ['Peso atual', sm.lastWeight ? `${n1(sm.lastWeight.value)} kg` : '—'],
    ['Desde o início', sm.sinceStart ? fmtKgDelta(sm.sinceStart.kg) : '—'],
    ['Últimos 30 dias', sm.last30 != null ? fmtKgDelta(sm.last30) : '—'],
    ['IMC', sm.lastBmi ? `${n1(sm.lastBmi.value)} · ${bmiBand(sm.lastBmi.value, age)}` : '—'],
    ['Altura', height ? `${(height / 100).toFixed(2).replace('.', ',')} m` : '—'],
    ['Idade', age != null ? `${age} anos` : '—'],
  ]
  const bw = (W - 2 * M - 10 * 2) / 3
  boxes.forEach(([k, v], i) => {
    const bx = M + (i % 3) * (bw + 10)
    const by = y - Math.floor(i / 3) * 52
    page.drawRectangle({ x: bx, y: by - 40, width: bw, height: 44, borderColor: line, borderWidth: 1 })
    page.drawText(pdfSafe(k), { x: bx + 8, y: by - 8, size: 8, font, color: muted })
    page.drawText(pdfSafe(v), { x: bx + 8, y: by - 28, size: v.length > 22 ? 9.5 : 13, font: bold, color: ink })
  })
  y -= 2 * 52 + 14
  if (sm.sinceStart) {
    text(`Variação: ${sm.sinceStart.label}.`, M, 9.5, font, muted)
    y -= 20
  }

  // Gráficos
  const chart = (title: string, pts: Pt[], unit: string, goal: number | null) => {
    ensure(190)
    text(title, M, 12, bold)
    y -= 8
    const x0 = M + 34
    const x1 = W - M
    const top = y - 6
    const bottom = y - 150
    const data = [...pts].sort((a, b) => a.date.localeCompare(b.date))
    if (data.length === 0) {
      y -= 20
      text('Sem registros ainda.', M, 9.5, font, muted)
      y -= 24
      return
    }
    const vals = [...data.map((d) => d.value), ...(goal != null ? [goal] : [])]
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    if (hi - lo < 1) {
      lo -= 1
      hi += 1
    }
    const pad = (hi - lo) * 0.12
    lo -= pad
    hi += pad
    const t0 = Date.parse(data[0].date)
    const t1 = Date.parse(data[data.length - 1].date)
    const X = (d: string) => (t1 === t0 ? (x0 + x1) / 2 : x0 + ((Date.parse(d) - t0) / (t1 - t0)) * (x1 - x0))
    const Y = (v: number) => bottom + ((v - lo) / (hi - lo)) * (top - bottom)
    page.drawRectangle({ x: x0, y: bottom, width: x1 - x0, height: top - bottom, borderColor: line, borderWidth: 1 })
    for (const v of [lo + pad, (lo + hi) / 2, hi - pad]) {
      page.drawText(n1(v), { x: M, y: Y(v) - 3, size: 7, font, color: muted })
      page.drawLine({ start: { x: x0, y: Y(v) }, end: { x: x1, y: Y(v) }, thickness: 0.4, color: line })
    }
    if (goal != null) {
      page.drawLine({ start: { x: x0, y: Y(goal) }, end: { x: x1, y: Y(goal) }, thickness: 1, color: brand, dashArray: [4, 3] })
      page.drawText(pdfSafe(`meta ${n1(goal)}${unit ? ` ${unit}` : ''}`), { x: x1 - 70, y: Y(goal) + 3, size: 7.5, font, color: brand })
    }
    for (let i = 1; i < data.length; i++) page.drawLine({ start: { x: X(data[i - 1].date), y: Y(data[i - 1].value) }, end: { x: X(data[i].date), y: Y(data[i].value) }, thickness: 1.6, color: brand })
    for (const d of data) {
      if (d.source === 'profissional') page.drawCircle({ x: X(d.date), y: Y(d.value), size: 2.8, color: brand })
      else page.drawCircle({ x: X(d.date), y: Y(d.value), size: 2.8, color: rgb(1, 1, 1), borderColor: brand, borderWidth: 1.2 })
    }
    page.drawText(fmtDay(data[0].date), { x: x0, y: bottom - 12, size: 7.5, font, color: muted })
    const last = fmtDay(data[data.length - 1].date)
    page.drawText(last, { x: x1 - font.widthOfTextAtSize(last, 7.5), y: bottom - 12, size: 7.5, font, color: muted })
    y = bottom - 30
  }
  chart('Peso (kg)', evo.weights, 'kg', evo.weightGoal)
  chart('IMC (com a altura vigente em cada data)', evo.bmis, '', evo.bmiGoal)
  ensure(20)
  text('Pontos cheios: medidos pelo coach. Pontos vazados: informados pelo cliente.', M, 8, font, muted)
  y -= 24

  // Linha do tempo (sem fotos): as 25 datas mais recentes.
  ensure(40)
  text('Linha do tempo', M, 12, bold)
  y -= 18
  const items = evo.timeline.slice(0, 25)
  if (!items.length) {
    text('Nada registrado ainda.', M, 9.5, font, muted)
    y -= 16
  }
  const LABEL = { peso: 'Peso', imc: 'IMC', medidas: 'Medidas', altura: 'Altura', fotos: 'Fotos', checkin: 'Check-in' } as const
  for (const d of items) {
    for (const it of d.items) {
      const t = pdfSafe(`${LABEL[it.kind]}: ${it.text}`)
      const parts: string[] = []
      let cur = ''
      for (const w of t.split(' ')) {
        const nx = cur ? `${cur} ${w}` : w
        if (font.widthOfTextAtSize(nx, 9) > W - 2 * M - 80 && cur) {
          parts.push(cur)
          cur = w
        } else cur = nx
      }
      if (cur) parts.push(cur)
      ensure(parts.length * 12 + 4)
      page.drawText(fmtDay(d.date), { x: M, y, size: 9, font: bold, color: muted })
      for (const part of parts) {
        page.drawText(part, { x: M + 80, y, size: 9, font, color: ink })
        y -= 12
      }
    }
    y -= 3
  }

  // Fotos: só com autorização marcada pelo cliente.
  y -= 10
  ensure(40)
  text('Fotos do corpo', M, 12, bold)
  y -= 16
  const dates = [...new Set(evo.photos.map((x) => x.date))].sort()
  if (!withPhotos) {
    text('Fotos não incluídas: o cliente não autorizou fotos no relatório.', M, 9.5, font, muted)
    y -= 14
  } else if (dates.length === 0) {
    text('Nenhuma foto do corpo enviada.', M, 9.5, font, muted)
    y -= 14
  } else {
    const pick = dates.length > 1 ? [dates[0], dates[dates.length - 1]] : [dates[0]]
    const fileIds = evo.photos.filter((x) => pick.includes(x.date)).map((x) => x.fileId)
    const files = fileIds.length ? await db.select().from(schema.files).where(inArray(schema.files.id, fileIds)) : []
    newPage()
    page.drawText(pdfSafe(`Fotos do corpo: ${pick.map(fmtDay).join(' × ')}`), { x: M, y, size: 12, font: bold, color: ink })
    y -= 20
    const colW = (W - 2 * M - 2 * 10) / 3
    for (const d of pick) {
      const set = evo.sets.find((x) => x.date === d)
      page.drawText(pdfSafe(`${fmtDay(d)}${set?.weightKg != null ? ` · ${n1(set.weightKg)} kg` : ''}`), { x: M, y, size: 10, font: bold, color: muted })
      y -= 8
      const rowH = colW * (4 / 3)
      for (const [i, angle] of (['frente', 'lado', 'costas'] as const).entries()) {
        const ph = evo.photos.find((x) => x.date === d && x.angle === angle)
        const f = ph ? files.find((x) => x.id === ph.fileId) : undefined
        const bx = M + i * (colW + 10)
        page.drawRectangle({ x: bx, y: y - rowH, width: colW, height: rowH, borderColor: line, borderWidth: 1 })
        let img: PDFImage | null = null
        if (f) {
          const bytes = await readUpload(f.storageKey).catch(() => null)
          if (bytes) img = f.mime === 'image/png' ? await doc.embedPng(bytes).catch(() => null) : f.mime === 'image/jpeg' ? await doc.embedJpg(bytes).catch(() => null) : null
        }
        if (img) {
          const scale = Math.min(colW / img.width, rowH / img.height)
          const iw = img.width * scale
          const ih = img.height * scale
          page.drawImage(img, { x: bx + (colW - iw) / 2, y: y - rowH + (rowH - ih) / 2, width: iw, height: ih })
        } else {
          page.drawText(pdfSafe(ph ? 'formato sem prévia' : `sem foto de ${angle}`), { x: bx + 8, y: y - rowH / 2, size: 8, font, color: muted })
        }
        page.drawText(pdfSafe(angle), { x: bx, y: y - rowH - 11, size: 8, font, color: muted })
      }
      y -= rowH + 26
      if (set?.comment) {
        page.drawText(pdfSafe(`Comentário do coach: ${set.comment}`.slice(0, 120)), { x: M, y, size: 8.5, font, color: ink })
        y -= 16
      }
    }
  }
  return doc.save()
}
