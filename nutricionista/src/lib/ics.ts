/**
 * Gerador de iCalendar (.ics, RFC 5545) sem dependências: texto escapado, linhas dobradas em 75 octetos
 * sem partir acentos e datas em UTC. Usado pelos lembretes no calendário (src/lib/lembretes-ics.ts).
 */

/** Texto de propriedade do iCalendar: escapa \\ ; , e quebras de linha. */
export const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`)

/** Instante em UTC no formato do iCalendar: 20261110T150000Z. */
export const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Dobra linhas em 75 octetos (RFC 5545), sem partir caracteres acentuados. */
export function foldLine(line: string) {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = Buffer.byteLength(ch, 'utf8')
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

/** Junta as linhas de um calendário com CRLF, dobrando as longas, e termina com CRLF. */
export const icsJoin = (lines: string[]) => lines.map(foldLine).join('\r\n') + '\r\n'
