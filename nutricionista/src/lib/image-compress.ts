/**
 * Compressão no celular antes do envio (no navegador, sem serviço externo): redesenha a foto num
 * canvas com no máximo 1600 px no maior lado e salva em JPEG com qualidade 0,8. O canvas não copia
 * metadados, então a foto sai sem EXIF (localização, aparelho, data). Economiza disco e dados móveis.
 * Se o navegador não conseguir abrir o arquivo (ex.: HEIC fora do Safari, ou não é imagem), devolve
 * o original: o servidor confere o tipo real e recusa o que não for JPEG, PNG ou WebP.
 */
export const MAX_SIDE = 1600
export const QUALITY = 0.8

export async function compressImage(file: File, maxSide = MAX_SIDE, quality = QUALITY): Promise<File> {
  if (typeof document === 'undefined' || !file.type.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff' // PNG com transparência vira fundo branco no JPEG
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file
    const name = file.name.replace(/\.[^.]+$/, '') || 'foto'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return file
  }
}

/** Foto tirada da câmera (vídeo) já no tamanho certo, em JPEG. */
export async function frameToFile(video: HTMLVideoElement, name: string, mirror = false, maxSide = MAX_SIDE, quality = QUALITY): Promise<File | null> {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return null
  const scale = Math.min(1, maxSide / Math.max(vw, vh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vw * scale)
  canvas.height = Math.round(vh * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (mirror) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return blob ? new File([blob], `${name}.jpg`, { type: 'image/jpeg' }) : null
}
