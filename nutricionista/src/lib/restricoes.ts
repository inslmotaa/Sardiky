import { normalize } from './nutricao'

/**
 * Restrições alimentares do paciente (vindas da anamnese ou marcadas na ficha) e
 * alerta ao adicionar um alimento no editor de planos. Módulo puro.
 */
export const RESTRICTIONS = {
  lactose: { label: 'Lactose', groups: ['laticinios'], words: ['leite', 'queijo', 'iogurte', 'requeijao', 'manteiga', 'creme de leite', 'nata', 'mussarela', 'coalhada'] },
  gluten: { label: 'Glúten', groups: [], words: ['pao', 'trigo', 'macarrao', 'biscoito', 'aveia', 'cevada', 'centeio', 'cuscuz marroquino', 'bolo', 'cream cracker'] },
  vegetariano: { label: 'Vegetariano(a)', groups: [], words: ['frango', 'carne', 'bovina', 'suina', 'peixe', 'merluza', 'atum', 'sardinha', 'bacon', 'presunto', 'linguica', 'camarao', 'patinho', 'acem'] },
  vegano: { label: 'Vegano(a)', groups: ['laticinios'], words: ['frango', 'carne', 'bovina', 'suina', 'peixe', 'merluza', 'atum', 'sardinha', 'bacon', 'presunto', 'ovo', 'mel', 'leite', 'queijo', 'iogurte', 'manteiga', 'patinho', 'acem', 'camarao'] },
  frutos_do_mar: { label: 'Frutos do mar', groups: [], words: ['camarao', 'lula', 'polvo', 'marisco', 'mexilhao', 'ostra', 'siri', 'caranguejo', 'lagosta'] },
  peixe: { label: 'Peixe', groups: [], words: ['peixe', 'merluza', 'atum', 'sardinha', 'salmao', 'tilapia', 'bacalhau'] },
  ovo: { label: 'Ovo', groups: [], words: ['ovo'] },
  amendoim: { label: 'Amendoim', groups: [], words: ['amendoim', 'pacoca'] },
  oleaginosas: { label: 'Castanhas e oleaginosas', groups: [], words: ['castanha', 'amendoa', 'noz', 'nozes', 'avela', 'pistache', 'macadamia'] },
  soja: { label: 'Soja', groups: [], words: ['soja', 'tofu', 'edamame'] },
} as const
export type RestrictionKey = keyof typeof RESTRICTIONS

/** Palavra no início de um termo (pega plurais: “ovo” acha “ovos”). */
const has = (text: string, word: string) => new RegExp(`(^| )${word}`).test(text)

/** Restrições que o alimento fere (rótulos para o alerta). */
export function restrictionAlerts(food: { name: string; group?: string | null }, restrictions: string[]) {
  const n = normalize(food.name)
  const out: string[] = []
  for (const key of restrictions) {
    const r = RESTRICTIONS[key as RestrictionKey]
    if (!r) continue
    const byGroup = !!food.group && (r.groups as readonly string[]).includes(food.group)
    const byWord = r.words.some((w) => has(n, w))
    // Exceção comum: “sem lactose” no nome do alimento.
    if (key === 'lactose' && /sem lactose|zero lactose/.test(n)) continue
    if (key === 'gluten' && /sem gluten|pao de queijo/.test(n)) continue
    if (byGroup || byWord) out.push(r.label)
  }
  return out
}

/** Converte opções marcadas na anamnese (“Lactose”, “Glúten”, “Vegetariano(a)”…) em chaves de restrição. */
export function restrictionsFromText(values: string[]) {
  const out = new Set<RestrictionKey>()
  for (const v of values) {
    const n = normalize(v)
    for (const [k, r] of Object.entries(RESTRICTIONS) as [RestrictionKey, (typeof RESTRICTIONS)[RestrictionKey]][]) {
      const label = normalize(r.label).replace(/ a$/, '')
      if (n === normalize(k.replace(/_/g, ' ')) || n.startsWith(label) || n.includes(label)) out.add(k)
    }
  }
  return [...out]
}
