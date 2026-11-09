import { describe, expect, it } from 'vitest'
import { offUrl, parseOffProduct, validBarcode } from '@/lib/openfoodfacts'
import { planMicros } from '@/lib/tabela-nutricional'
import { checkinState, daysLate, nextDueDate } from '@/lib/checkin-rules'
import { acessoVencido, renovacaoEtapa } from '@/lib/renovacao'
import { valorPorExtenso } from '@/lib/extenso'
import { WA_TEMPLATES, waHref, waPhone, waText } from '@/lib/whatsapp'
import { parseAssinaturaRef } from '@/lib/mercadopago-core'
import { pctOf } from '@/lib/nutricao'
import { DEFAULT_FEATURES } from '@/db/schema'

/** Parte 4: app do cliente e painel. */

describe('Código de barras e Open Food Facts', () => {
  it('valida o dígito verificador (EAN-8, EAN-13, UPC-A)', () => {
    expect(validBarcode('7891000100103')).toBe('7891000100103')
    expect(validBarcode('789 1000 100 103')).toBe('7891000100103')
    expect(validBarcode('7891000100104')).toBeNull()
    expect(validBarcode('96385074')).toBe('96385074')
    expect(validBarcode('036000291452')).toBe('036000291452')
    expect(validBarcode('123')).toBeNull()
  })

  it('lê o produto por 100 g, converte sódio e kJ, e marca dados incompletos', () => {
    const s = parseOffProduct(
      {
        status: 1,
        product: { product_name: 'Leite em pó integral', brands: 'Marca Teste,Outra', serving_size: '26 g', nutriments: { 'energy-kcal_100g': 496, proteins_100g: 25.4, carbohydrates_100g: 38.5, fat_100g: 26.9, sodium_100g: 0.38 } },
      },
      '7891000100103',
    )!
    expect(s).toMatchObject({ name: 'Leite em pó integral · Marca Teste', kcal: 496, protein: 25.4, carbs: 38.5, fat: 26.9, sodiumMg: 380, serving: '26 g', incomplete: false })
    const kj = parseOffProduct({ status: 1, product: { product_name: '<b>Biscoito</b>', nutriments: { 'energy-kj_100g': 2092, salt_100g: 1 } } }, '96385074')!
    expect(kj.kcal).toBe(500)
    expect(kj.sodiumMg).toBe(400)
    expect(kj.name).toBe('bBiscoito/b')
    expect(kj.incomplete).toBe(true)
    expect(parseOffProduct({ status: 0 }, '96385074')).toBeNull()
    expect(offUrl('7891000100103', 'http://x/off/')).toBe('http://x/off/api/v2/product/7891000100103.json?fields=product_name,product_name_pt,generic_name,brands,nutriments,serving_size')
  })
})

describe('Micronutrientes no plano', () => {
  const day = {
    meals: [
      { id: 'cafe', name: 'Café', options: [{ items: [{ foodId: 'leite', grams: 200 }, { foodId: null, grams: 30 }] }] },
      { id: 'almoco', name: 'Almoço', options: [{ items: [{ foodId: 'feijao', grams: 100 }] }, { items: [{ foodId: 'leite', grams: 100 }] }] },
    ],
  }
  const tables: Record<string, Record<string, number | 'Tr' | 'NA' | null>> = { leite: { calcio: 120, ferro: 'Tr' }, feijao: { calcio: 27, ferro: 1.3 } }
  it('soma por refeição (opção exibida) e no dia, e marca o total parcial', () => {
    const r = planMicros(day, () => 0, (id) => tables[id], ['calcio', 'ferro'])
    expect(r.meals[0].totals.calcio).toBe(240)
    expect(r.meals[0].missing.calcio).toBe(1) // item em texto, sem tabela
    expect(r.meals[1].totals.ferro).toBeCloseTo(1.3)
    expect(r.day.totals.calcio).toBe(267)
    expect(r.day.totals.ferro).toBeCloseTo(1.3) // traços contam como zero
    const alt = planMicros(day, (m) => (m === 'almoco' ? 1 : 0), (id) => tables[id], ['calcio'])
    expect(alt.meals[1].totals.calcio).toBe(120)
  })
  it('o quadro começa desligado para o cliente', () => {
    expect(DEFAULT_FEATURES.micronutrientes).toBe(false)
  })
})

describe('Check-ins periódicos', () => {
  it('aguardando, aberto (3 dias antes), atrasado e enviado', () => {
    expect(checkinState({ status: 'pendente', dueDate: '2026-11-20' }, '2026-11-16')).toBe('aguardando')
    expect(checkinState({ status: 'pendente', dueDate: '2026-11-20' }, '2026-11-17')).toBe('aberto')
    expect(checkinState({ status: 'pendente', dueDate: '2026-11-20' }, '2026-11-20')).toBe('aberto')
    expect(checkinState({ status: 'pendente', dueDate: '2026-11-20' }, '2026-11-21')).toBe('atrasado')
    expect(checkinState({ status: 'enviado', dueDate: '2026-11-20' }, '2026-12-01')).toBe('enviado')
    expect(daysLate('2026-11-20', '2026-11-23')).toBe(3)
    expect(daysLate('2026-11-20', '2026-11-19')).toBe(0)
  })
  it('o próximo prazo mantém a cadência e pula prazos já passados', () => {
    expect(nextDueDate('2026-11-20', 15, '2026-11-19')).toBe('2026-12-05')
    expect(nextDueDate('2026-10-01', 15, '2026-11-09')).toBe('2026-11-15')
  })
})

describe('Renovação e acesso vencido', () => {
  it('avisos aos 7 e aos 2 dias', () => {
    expect(renovacaoEtapa(8)).toBeNull()
    expect(renovacaoEtapa(7)).toBe('7')
    expect(renovacaoEtapa(3)).toBe('7')
    expect(renovacaoEtapa(2)).toBe('2')
    expect(renovacaoEtapa(0)).toBe('2')
    expect(renovacaoEtapa(-1)).toBeNull()
  })
  it('vence só com término definido e já passado', () => {
    expect(acessoVencido(null, '2026-11-09')).toBe(false)
    expect(acessoVencido('2026-11-09', '2026-11-09')).toBe(false)
    expect(acessoVencido('2026-11-08', '2026-11-09')).toBe(true)
  })
  it('referência da assinatura mensal', () => {
    const a = '11111111-1111-1111-1111-111111111111'
    const b = '22222222-2222-2222-2222-222222222222'
    expect(parseAssinaturaRef(`assinatura:${a}:${b}`)).toEqual({ patientId: a, packageId: b })
    expect(parseAssinaturaRef(a)).toBeNull()
    expect(parseAssinaturaRef(null)).toBeNull()
  })
})

describe('Recibo: valor por extenso', () => {
  it('reais e centavos', () => {
    expect(valorPorExtenso(25000)).toBe('duzentos e cinquenta reais')
    expect(valorPorExtenso(63750)).toBe('seiscentos e trinta e sete reais e cinquenta centavos')
    expect(valorPorExtenso(120000)).toBe('mil e duzentos reais')
    expect(valorPorExtenso(225000)).toBe('dois mil duzentos e cinquenta reais')
    expect(valorPorExtenso(100)).toBe('um real')
    expect(valorPorExtenso(1)).toBe('um centavo')
    expect(valorPorExtenso(10000)).toBe('cem reais')
  })
})

describe('WhatsApp sem custo (wa.me)', () => {
  it('telefone com 55 e texto do modelo (salvo ou padrão)', () => {
    expect(waPhone('(41) 99155-1789')).toBe('5541991551789')
    expect(waPhone('5541991551789')).toBe('5541991551789')
    expect(waPhone('123')).toBeNull()
    const t = waText({}, 'waCheckin', { nome: 'Helena', data: '07/11/2026', link: 'https://farion.com.br/paciente/checkin' })
    expect(t).toBe('Olá, Helena! Seu check-in de 07/11/2026 ainda está pendente. Leva poucos minutos e me ajuda a ajustar o seu plano: https://farion.com.br/paciente/checkin')
    expect(waText({ waContato: 'Oi {nome}, tudo certo?' }, 'waContato', { nome: 'Bia' })).toBe('Oi Bia, tudo certo?')
    // Variável sem valor some, sem deixar ":" pendurado.
    expect(waText({}, 'waPlanoNovo', { nome: 'Bia' })).toBe('Olá, Bia! Seu plano alimentar novo já está no app. Qualquer dúvida, me chama por aqui.')
    expect(waHref('41991551789', 'Olá!')).toBe('https://wa.me/5541991551789?text=Ol%C3%A1!')
    expect(waHref('', 'x')).toBeNull()
  })
  it('modelos para todos os botões do painel', () => {
    for (const k of ['waLembreteConsulta', 'waPlanoNovo', 'waCheckin', 'waVencimento', 'waCobranca'] as const) expect(WA_TEMPLATES[k].text.length).toBeGreaterThan(20)
  })
})

describe('Real × planejado', () => {
  it('percentual do planejado', () => {
    expect(pctOf(1500, 2000)).toBe(75)
    expect(pctOf(100, 0)).toBeNull()
    expect(pctOf(100, null)).toBeNull()
  })
})
