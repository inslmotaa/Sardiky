// Gera os ícones PNG do app (tela inicial do Android/iPhone) a partir de public/icon.svg.
// Uso: node scripts/gerar-icones.mjs
import sharp from 'sharp'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const svg = await readFile(path.join(root, 'public/icon.svg'))
const out = path.join(root, 'public/icons')
await mkdir(out, { recursive: true })
for (const size of [192, 512]) await sharp(svg, { density: 512 }).resize(size, size).png().toFile(path.join(out, `icon-${size}.png`))
// Ícone "maskable": fundo cheio e margem de segurança de 20% (o sistema recorta em círculo ou gota).
const inner = await sharp(svg, { density: 512 }).resize(410, 410).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#2f5d50' } })
  .composite([{ input: inner, left: 51, top: 51 }])
  .png()
  .toFile(path.join(out, 'maskable-512.png'))
await sharp(svg, { density: 512 }).resize(180, 180).flatten({ background: '#2f5d50' }).png().toFile(path.join(out, 'apple-touch-icon.png'))
await sharp(svg, { density: 512 }).resize(96, 96).png().toFile(path.join(out, 'badge-96.png'))
console.log('ícones gerados em public/icons')
