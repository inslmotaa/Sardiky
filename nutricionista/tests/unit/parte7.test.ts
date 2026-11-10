import { describe, expect, it } from 'vitest'
import { ageOn, bmiBand, bmiOf, bmiSeries, daysSince, heightOn, missingBodyData, weightChange, weightChangeSince } from '@/lib/corpo'
import { hasExif, stripImageMetadata, stripJpeg, stripPng, stripWebp } from '@/lib/image-meta'
import { sniffMime } from '@/lib/storage-sniff'
import { crc32, zip } from '@/lib/zip'
import { zonedParts } from '@/lib/time'

/** Parte 7: perfil físico, fotos do corpo e das refeições. */

const SP = 'America/Sao_Paulo'

describe('Idade sempre calculada da data de nascimento, no fuso do consultório', () => {
  it('muda no dia do aniversário em Brasília, não no de Greenwich', () => {
    const birth = '1990-11-11'
    // 23h30 de 10/11 em Brasília (já 11/11 em UTC): ainda 35 anos.
    expect(ageOn(birth, zonedParts(new Date('2026-11-11T02:30:00Z'), SP).date)).toBe(35)
    // 00h30 de 11/11 em Brasília: 36 anos.
    expect(ageOn(birth, zonedParts(new Date('2026-11-11T03:30:00Z'), SP).date)).toBe(36)
  })
  it('29 de fevereiro e sem data', () => {
    expect(ageOn('2000-02-29', '2025-02-28')).toBe(24)
    expect(ageOn('2000-02-29', '2025-03-01')).toBe(25)
    expect(ageOn(null, '2026-01-01')).toBeNull()
  })
})

describe('Altura com histórico e IMC por data', () => {
  const heights = [
    { date: '2026-01-10', heightCm: 160 },
    { date: '2026-06-01', heightCm: 165 },
  ]
  it('vale a altura vigente na data (antes do primeiro registro, o primeiro; sem nada, o cadastro)', () => {
    expect(heightOn('2026-03-01', heights)).toBe(160)
    expect(heightOn('2026-06-01', heights)).toBe(165)
    expect(heightOn('2026-12-01', heights)).toBe(165)
    expect(heightOn('2025-12-01', heights)).toBe(160)
    expect(heightOn('2026-03-01', [], 170)).toBe(170)
  })
  it('o IMC de cada pesagem usa a altura daquela data', () => {
    const s = bmiSeries(
      [
        { date: '2026-03-01', value: 64 },
        { date: '2026-07-01', value: 64 },
      ],
      heights,
    )
    expect(s.map((p) => p.value)).toEqual([25, 23.5]) // 64/1,60² e 64/1,65²
    expect(bmiOf(70, null)).toBeNull()
  })
  it('faixas do IMC (OMS; a partir de 60 anos, Lipschitz)', () => {
    expect(bmiBand(17)).toBe('Abaixo do peso')
    expect(bmiBand(22)).toBe('Peso adequado')
    expect(bmiBand(27)).toBe('Sobrepeso')
    expect(bmiBand(31)).toBe('Obesidade grau I')
    expect(bmiBand(41)).toBe('Obesidade grau III')
    expect(bmiBand(26, 65)).toBe('Peso adequado')
  })
})

describe('Variação de peso e dados que faltam', () => {
  const w = [
    { date: '2026-08-01', value: 80 },
    { date: '2026-09-01', value: 78.4 },
    { date: '2026-10-10', value: 75.8 },
  ]
  it('"−4,2 kg em 10 semanas"', () => {
    expect(weightChange(w)).toMatchObject({ kg: -4.2, label: '−4,2 kg em 10 semanas' })
    expect(weightChange([w[0]])).toBeNull()
    expect(weightChange([{ date: '2026-08-01', value: 80 }, { date: '2026-08-06', value: 80.5 }])!.label).toBe('+0,5 kg em 5 dias')
  })
  it('últimos 30 dias', () => {
    expect(weightChangeSince(w, '2026-10-10', 30)).toBe(-2.6)
  })
  it('lista o que falta no cadastro e conta os dias sem peso', () => {
    expect(missingBodyData({ birthDate: null, sex: 'X', heightCm: null })).toEqual(['data de nascimento', 'sexo', 'altura'])
    expect(missingBodyData({ birthDate: '1990-01-01', sex: 'F', heightCm: 160 })).toEqual([])
    expect(daysSince('2026-10-27', '2026-11-10')).toBe(14)
  })
})

/** JPEG mínimo com um bloco APP1 (EXIF com "GPS") antes da imagem. */
function jpegWithExif() {
  const soi = Buffer.from([0xff, 0xd8])
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0', 'latin1'), Buffer.alloc(9)])
  const exifBody = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from('MM\0*GPSLatitude -25.43 Curitiba', 'latin1')])
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([0, exifBody.length + 2]), exifBody])
  const com = Buffer.concat([Buffer.from([0xff, 0xfe, 0x00, 0x07]), Buffer.from('nota!', 'latin1')])
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9])
  return Buffer.concat([soi, app0, app1, com, sos])
}

describe('Fotos sem metadados (EXIF, localização) e tipo real conferido', () => {
  it('JPEG: tira EXIF e comentários, mantém o resto', () => {
    const src = jpegWithExif()
    expect(hasExif(src)).toBe(true)
    const out = stripJpeg(src)
    expect(hasExif(out)).toBe(false)
    expect(out.includes(Buffer.from('GPS', 'latin1'))).toBe(false)
    expect(out.includes(Buffer.from('JFIF', 'latin1'))).toBe(true)
    expect(out.subarray(-9).equals(Buffer.from([0xff, 0xda, 0x00, 0x02, 1, 2, 3, 0xff, 0xd9]))).toBe(true)
    expect(sniffMime(out, ['image/jpeg'])?.mime).toBe('image/jpeg')
  })
  it('PNG: tira eXIf e textos', () => {
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4)
      len.writeUInt32BE(data.length)
      return Buffer.concat([len, Buffer.from(type, 'latin1'), data, Buffer.alloc(4)])
    }
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', Buffer.alloc(13)),
      chunk('eXIf', Buffer.from('Exif\0\0GPS', 'latin1')),
      chunk('tEXt', Buffer.from('Author\0Fulano', 'latin1')),
      chunk('IDAT', Buffer.from([1, 2, 3])),
      chunk('IEND', Buffer.alloc(0)),
    ])
    const out = stripPng(png)
    expect(out.includes(Buffer.from('eXIf'))).toBe(false)
    expect(out.includes(Buffer.from('Fulano'))).toBe(false)
    expect(out.includes(Buffer.from('IDAT'))).toBe(true)
    expect(stripImageMetadata(png, 'image/png').length).toBe(out.length)
  })
  it('WebP: tira EXIF e XMP e corrige o cabeçalho', () => {
    const c = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4)
      len.writeUInt32LE(data.length)
      return Buffer.concat([Buffer.from(type, 'latin1'), len, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)])
    }
    const vp8x = Buffer.alloc(10)
    vp8x[0] = 0x08 | 0x04
    const body = Buffer.concat([c('VP8X', vp8x), c('VP8 ', Buffer.from([1, 2, 3, 4])), c('EXIF', Buffer.from('Exif\0\0GPS', 'latin1')), c('XMP ', Buffer.from('<x/>'))])
    const head = Buffer.alloc(12)
    head.write('RIFF', 0, 'latin1')
    head.writeUInt32LE(body.length + 4, 4)
    head.write('WEBP', 8, 'latin1')
    const out = stripWebp(Buffer.concat([head, body]))
    expect(out.includes(Buffer.from('EXIF'))).toBe(false)
    expect(out.includes(Buffer.from('XMP '))).toBe(false)
    expect(out.readUInt32LE(4)).toBe(out.length - 8)
    expect(out[20] & 0x0c).toBe(0)
    expect(sniffMime(out, ['image/webp'])?.mime).toBe('image/webp')
  })
  it('arquivo que não é imagem é recusado pelo tipo real', () => {
    expect(sniffMime(Buffer.from('não sou uma foto'), ['image/jpeg', 'image/png', 'image/webp'])).toBeNull()
    expect(sniffMime(Buffer.from('%PDF-1.7'), ['image/jpeg', 'image/png', 'image/webp'])).toBeNull()
  })
})

describe('ZIP da exportação (LGPD)', () => {
  it('CRC-32 e estrutura', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
    const z = zip([
      { name: 'meus-dados.json', data: '{"a":1}' },
      { name: 'fotos-do-corpo/2026-11-10-frente.jpg', data: Buffer.from([0xff, 0xd8, 0xff]) },
    ])
    expect(z.readUInt32LE(0)).toBe(0x04034b50)
    const end = z.length - 22
    expect(z.readUInt32LE(end)).toBe(0x06054b50)
    expect(z.readUInt16LE(end + 10)).toBe(2)
    expect(z.includes(Buffer.from('fotos-do-corpo/2026-11-10-frente.jpg'))).toBe(true)
  })
})
