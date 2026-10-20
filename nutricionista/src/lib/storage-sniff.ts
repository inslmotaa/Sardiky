const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString() === '%PDF-' },
  // Áudio curto do chat (gravado no navegador: WebM/Opus no Android e computador, MP4/AAC no iPhone).
  { mime: 'audio/webm', ext: 'webm', test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  { mime: 'audio/ogg', ext: 'ogg', test: (b) => b.subarray(0, 4).toString() === 'OggS' },
  { mime: 'audio/mp4', ext: 'm4a', test: (b) => b.subarray(4, 8).toString() === 'ftyp' },
  { mime: 'audio/mpeg', ext: 'mp3', test: (b) => b.subarray(0, 3).toString() === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
]

/** Identifica o tipo pelo conteúdo (não confia na extensão nem no navegador). */
export function sniffMime(buf: Buffer, allowed: string[]) {
  const sig = SIGNATURES.find((s) => allowed.includes(s.mime) && s.test(buf))
  return sig ?? null
}
