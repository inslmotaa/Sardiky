import 'server-only'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

/**
 * Armazenamento de arquivos em pasta privada (fora de /public).
 * Os arquivos só são entregues pela rota /arquivos/[id], que confere permissões.
 * Para hospedagens sem disco persistente, substitua por um driver S3/R2
 * mantendo estas três funções.
 */
const root = () => path.resolve(process.env.UPLOAD_DIR ?? '.data/uploads')

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString() === '%PDF-' },
]

/** Identifica o tipo pelo conteúdo (não confia na extensão nem no navegador). */
export function sniffMime(buf: Buffer, allowed: string[]) {
  const sig = SIGNATURES.find((s) => allowed.includes(s.mime) && s.test(buf))
  return sig ?? null
}

export async function saveUpload(file: File, allowed: string[]) {
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado.' } as const
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'Arquivo maior que 5 MB.' } as const
  const buf = Buffer.from(await file.arrayBuffer())
  const sig = sniffMime(buf, allowed)
  if (!sig) return { error: 'Formato não permitido.' } as const
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${sig.ext}`
  const full = path.join(root(), key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, buf, { mode: 0o600 })
  return { key, mime: sig.mime, size: buf.length } as const
}

export async function readUpload(key: string) {
  const full = path.join(root(), key)
  if (!full.startsWith(root() + path.sep)) throw new Error('Caminho inválido')
  return readFile(full)
}

export async function deleteUpload(key: string) {
  const full = path.join(root(), key)
  if (!full.startsWith(root() + path.sep)) return
  await unlink(full).catch(() => undefined)
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const DOC_TYPES = [...IMAGE_TYPES, 'application/pdf']
