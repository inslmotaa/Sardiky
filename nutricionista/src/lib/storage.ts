import 'server-only'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { sniffMime } from './storage-sniff'
import { localDataDir } from './data-dir'

/**
 * Armazenamento de arquivos em pasta privada (fora de /public).
 * Os arquivos só são entregues pela rota /arquivos/[id], que confere permissões.
 * Para hospedagens sem disco persistente, substitua por um driver S3/R2
 * mantendo estas três funções.
 */
const root = () => path.resolve(process.env.UPLOAD_DIR ?? localDataDir('uploads'))

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

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
