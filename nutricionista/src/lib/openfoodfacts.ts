/**
 * Produtos industrializados pelo código de barras (Open Food Facts, base aberta e gratuita).
 * Regras puras, testadas em tests/unit/parte4.test.ts. Os valores são uma sugestão: o coach
 * confere com o rótulo e confirma antes de salvar.
 */

/** Só dígitos; aceita EAN-8, UPC-A (12), EAN-13 e GTIN-14 com dígito verificador correto. */
export function validBarcode(raw: string): string | null {
  const code = raw.replace(/\D/g, '')
  if (![8, 12, 13, 14].includes(code.length)) return null
  const digits = code.split('').map(Number)
  const check = digits.pop()!
  // Da direita para a esquerda (sem o verificador): pesos 3, 1, 3, 1…
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check ? code : null
}

export type OffSuggestion = {
  barcode: string
  name: string
  brand: string | null
  /** Valores por 100 g (ou 100 ml); null quando o produto não informa. */
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  /** Sódio em mg por 100 g. */
  sodiumMg: number | null
  serving: string | null
  /** Faltam calorias ou macros: o coach precisa completar pelo rótulo. */
  incomplete: boolean
}

const num = (v: unknown, max: number, digits = 1): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n) || n < 0 || n > max) return null
  const f = 10 ** digits
  return Math.round(n * f) / f
}

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)
  return t || null
}

/** Lê a resposta de /api/v2/product/{código}.json; null se o produto não existe na base. */
export function parseOffProduct(json: unknown, barcode: string): OffSuggestion | null {
  if (!json || typeof json !== 'object') return null
  const j = json as { status?: number; product?: Record<string, unknown> }
  if (j.status !== 1 || !j.product) return null
  const p = j.product
  const n = (p.nutriments ?? {}) as Record<string, unknown>
  const name = text(p.product_name_pt, 120) ?? text(p.product_name, 120) ?? text(p.generic_name, 120)
  const brand = text(typeof p.brands === 'string' ? p.brands.split(',')[0] : null, 60)
  // Energia em kcal; se só houver kJ, converte (1 kcal = 4,184 kJ).
  const kj = num(n['energy-kj_100g'] ?? n['energy_100g'], 4000)
  const kcal = num(n['energy-kcal_100g'], 950) ?? (kj != null ? Math.round(kj / 4.184) : null)
  // Sódio e sal vêm em gramas: mantém a precisão para converter em mg (sal ÷ 2,5 = sódio).
  const salt = num(n['salt_100g'], 100, 4)
  const sodiumG = num(n['sodium_100g'], 40, 4) ?? (salt != null ? salt / 2.5 : null)
  const out: OffSuggestion = {
    barcode,
    name: [name, brand && name && !name.toLowerCase().includes(brand.toLowerCase()) ? brand : null].filter(Boolean).join(' · ') || `Produto ${barcode}`,
    brand,
    kcal,
    protein: num(n['proteins_100g'], 100),
    carbs: num(n['carbohydrates_100g'], 100),
    fat: num(n['fat_100g'], 100),
    fiber: num(n['fiber_100g'], 100),
    sodiumMg: sodiumG != null ? Math.round(sodiumG * 1000) : null,
    serving: text(p.serving_size, 60),
    incomplete: false,
  }
  out.incomplete = [out.kcal, out.protein, out.carbs, out.fat].some((v) => v == null)
  return out
}

/** Endereço da consulta (OPENFOODFACTS_API_BASE permite um servidor falso nos testes). */
export function offUrl(barcode: string, base = 'https://world.openfoodfacts.org') {
  const fields = 'product_name,product_name_pt,generic_name,brands,nutriments,serving_size'
  return `${base.replace(/\/+$/, '')}/api/v2/product/${barcode}.json?fields=${fields}`
}
