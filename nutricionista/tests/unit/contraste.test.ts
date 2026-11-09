import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Contraste AA (WCAG 2.1) das cores do tema, lidas dos próprios arquivos CSS:
 * texto normal ≥ 4,5:1; elementos grandes/gráficos ≥ 3:1.
 */
function block(css: string, selectorStart: string) {
  const i = css.indexOf(selectorStart)
  if (i < 0) throw new Error(`bloco não encontrado: ${selectorStart}`)
  const open = css.indexOf('{', i)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}
function vars(body: string) {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
function resolve(v: Record<string, string>, name: string, depth = 0): string {
  const raw = v[name]
  if (!raw) throw new Error(`token ausente: --${name}`)
  const ref = /^var\(--([\w-]+)\)$/.exec(raw)
  return ref && depth < 5 ? resolve(v, ref[1], depth + 1) : raw
}
function lum(hex: string) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const globals = readFileSync('src/app/globals.css', 'utf8')
const site = readFileSync('src/app/(site)/site.css', 'utf8')
const dark = readFileSync('src/app/dark-theme.css', 'utf8')

const light = { ...vars(block(globals, ':root {')), ...vars(block(site, '.tl {')), ...vars(block(dark, ':root {')) }
light['brand'] = light['verde-principal']
const darkVars = { ...light, ...vars(block(dark, ':root[data-theme="dark"] {')) }
darkVars['brand'] = darkVars['brand-dark']

// [texto, fundo, mínimo]
const PAIRS: [string, string, number][] = [
  ['ink', 'bg', 4.5],
  ['ink', 'surface', 4.5],
  ['ink-2', 'surface', 4.5],
  ['muted', 'bg', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'surface-2', 4.5],
  ['brand', 'bg', 4.5],
  ['brand', 'surface', 4.5],
  ['on-brand', 'brand', 4.5],
  ['on-brand', 'brand-hover', 4.5],
  ['ok', 'ok-bg', 4.5],
  ['warn', 'warn-bg', 4.5],
  ['danger', 'danger-bg', 4.5],
  ['info', 'info-bg', 4.5],
  ['tl-ink', 'tl-bg', 4.5],
  ['tl-muted', 'tl-bg', 4.5],
  ['tl-green', 'tl-bg', 4.5],
  ['tl-green', 'tl-surface', 4.5],
  ['on-brand', 'tl-green', 4.5],
  ['line-strong', 'surface', 1.4], // bordas decorativas: só precisam aparecer
]

describe('contraste AA do tema', () => {
  for (const [name, v] of [
    ['claro', light],
    ['escuro', darkVars],
  ] as const) {
    it.each(PAIRS)(`${name}: --%s sobre --%s ≥ %s:1`, (fg, bg, min) => {
      const a = resolve(v, fg)
      const b = resolve(v, bg)
      expect(a, `--${fg}`).toMatch(/^#[0-9a-f]{3,6}$/i)
      expect(b, `--${bg}`).toMatch(/^#[0-9a-f]{3,6}$/i)
      expect(ratio(a, b)).toBeGreaterThanOrEqual(min)
    })
  }
  it('modo escuro segue o aparelho e pode ser forçado (os dois blocos têm os mesmos tokens)', () => {
    const auto = vars(block(dark, ':root:not([data-theme="light"]) {'))
    const forced = vars(block(dark, ':root[data-theme="dark"] {'))
    expect(auto).toEqual(forced)
    expect(dark).toContain('@media (prefers-color-scheme: dark)')
  })
})
