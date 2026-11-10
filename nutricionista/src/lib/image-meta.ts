/**
 * Remove metadados das imagens (EXIF com localização, XMP, IPTC, textos) sem recomprimir.
 * O celular já envia a foto redesenhada no canvas (que não leva EXIF), mas o servidor confere de
 * novo: fotos da galeria enviadas sem JavaScript, ou por outro caminho, também chegam limpas.
 * Regras puras, testadas em tests/unit/parte7.test.ts.
 */

/** JPEG: tira os segmentos APP1 (EXIF/XMP), APP13 (IPTC) e comentários; mantém APP0 (JFIF) e APP2 (perfil de cor). */
export function stripJpeg(buf: Buffer): Buffer {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf
  const out: Buffer[] = [buf.subarray(0, 2)]
  let i = 2
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return buf // estrutura inesperada: devolve como veio (o tipo já foi conferido)
    const marker = buf[i + 1]
    if (marker === 0xda) {
      out.push(buf.subarray(i)) // início da imagem: o resto vai inteiro
      return Buffer.concat(out)
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      out.push(buf.subarray(i, i + 2))
      i += 2
      continue
    }
    const len = buf.readUInt16BE(i + 2)
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe || (marker >= 0xe3 && marker <= 0xef)
    if (!drop) out.push(buf.subarray(i, i + 2 + len))
    i += 2 + len
  }
  return buf
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])

/** PNG: tira os blocos de texto, data e EXIF. */
export function stripPng(buf: Buffer): Buffer {
  const out: Buffer[] = [buf.subarray(0, 8)]
  let i = 8
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i)
    const type = buf.subarray(i + 4, i + 8).toString('latin1')
    const end = i + 12 + len
    if (end > buf.length) return buf
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end))
    i = end
    if (type === 'IEND') break
  }
  return Buffer.concat(out)
}

/** WebP: tira os blocos EXIF e XMP e desliga os avisos deles no cabeçalho VP8X. */
export function stripWebp(buf: Buffer): Buffer {
  if (buf.subarray(0, 4).toString() !== 'RIFF' || buf.subarray(8, 12).toString() !== 'WEBP') return buf
  const chunks: Buffer[] = []
  let i = 12
  while (i + 8 <= buf.length) {
    const type = buf.subarray(i, i + 4).toString('latin1')
    const len = buf.readUInt32LE(i + 4)
    const end = i + 8 + len + (len % 2)
    if (end > buf.length) return buf
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = Buffer.from(buf.subarray(i, end))
      if (type === 'VP8X') chunk[8] &= ~(0x08 | 0x04)
      chunks.push(chunk)
    }
    i = end
  }
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(12)
  head.write('RIFF', 0, 'latin1')
  head.writeUInt32LE(body.length + 4, 4)
  head.write('WEBP', 8, 'latin1')
  return Buffer.concat([head, body])
}

export function stripImageMetadata(buf: Buffer, mime: string): Buffer {
  try {
    if (mime === 'image/jpeg') return stripJpeg(buf)
    if (mime === 'image/png') return stripPng(buf)
    if (mime === 'image/webp') return stripWebp(buf)
  } catch {
    // Arquivo malformado: fica como veio; o tipo real já foi conferido.
  }
  return buf
}

/** Há EXIF ou XMP no arquivo? (usado nos testes) */
export const hasExif = (buf: Buffer) => buf.includes(Buffer.from('Exif\0\0', 'latin1')) || buf.includes(Buffer.from('http://ns.adobe.com/xap/', 'latin1'))
