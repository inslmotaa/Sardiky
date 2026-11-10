import 'server-only'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { sniffMime } from './storage-sniff'
import { stripImageMetadata } from './image-meta'
import { localDataDir } from './data-dir'

/**
 * Armazenamento de arquivos em pasta privada (fora de /public).
 * Os arquivos só são entregues pela rota /arquivos/[id], que confere permissões.
 * Para hospedagens sem disco persistente, substitua por um driver S3/R2
 * mantendo estas três funções.
 */
const root = () => path.resolve(process.env.UPLOAD_DIR ?? localDataDir('uploads'))
/** Pasta privada dos arquivos enviados (para o painel mostrar o espaço em disco). */
export const uploadRoot = root

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
/** Fotos (corpo, prato, chat): até 8 MB. O app já comprime no celular (1600 px, ~0,8), então quase sempre chegam bem abaixo. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export async function saveUpload(file: File, allowed: string[]) {
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado.' } as const
  if (file.size > MAX_IMAGE_BYTES) return { error: 'Arquivo maior que 8 MB.' } as const
  const raw = Buffer.from(await file.arrayBuffer())
  const sig = sniffMime(raw, allowed)
  if (!sig) return { error: 'Formato não permitido.' } as const
  const isImage = sig.mime.startsWith('image/')
  if (!isImage && raw.length > MAX_UPLOAD_BYTES) return { error: 'Arquivo maior que 5 MB.' } as const
  // Fotos: sem EXIF, XMP ou textos (localização, aparelho, data) mesmo que tenham vindo da galeria sem compressão.
  const buf = isImage ? stripImageMetadata(raw, sig.mime) : raw
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
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
export const CHAT_TYPES = [...DOC_TYPES, ...AUDIO_TYPES]

/** Grava um arquivo gerado pelo próprio sistema (ex.: exportação LGPD em JSON), sem passar pelo filtro de envio. */
export async function saveSystemFile(buf: Buffer, ext: string, mime: string) {
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, '')}`
  const full = path.join(root(), key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, buf, { mode: 0o600 })
  return { key, mime, size: buf.length } as const
}
