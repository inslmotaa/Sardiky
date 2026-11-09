/** Valor em reais por extenso (até 999.999,99), para o recibo. Regras puras (testadas). */
const UNI = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const r = n % 100
  const parts: string[] = []
  if (c) parts.push(CEN[c])
  if (r) parts.push(r < 20 ? UNI[r] : [DEZ[Math.floor(r / 10)], UNI[r % 10]].filter(Boolean).join(' e '))
  return parts.join(' e ')
}

function inteiro(n: number): string {
  if (n === 0) return 'zero'
  const mil = Math.floor(n / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (mil) partes.push(mil === 1 ? 'mil' : `${ate999(mil)} mil`)
  if (resto) partes.push(ate999(resto))
  // "mil e cem", "mil e vinte", mas "mil duzentos e trinta"
  const sep = mil && resto && (resto < 100 || resto % 100 === 0) ? ' e ' : ' '
  return partes.join(sep)
}

export function valorPorExtenso(cents: number): string {
  const c = Math.round(Math.abs(cents))
  const reais = Math.floor(c / 100)
  const centavos = c % 100
  const r = reais ? `${inteiro(reais)} ${reais === 1 ? 'real' : 'reais'}` : ''
  const ct = centavos ? `${inteiro(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}` : ''
  return [r, ct].filter(Boolean).join(' e ') || 'zero real'
}
