/**
 * Limitador simples em memória (janela fixa). Suficiente para uma única
 * instância; com várias instâncias, trocar por Redis ou tabela no banco.
 */
const buckets = new Map<string, { count: number; reset: number }>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k)
    }
    return true
  }
  b.count++
  return b.count <= limit
}
