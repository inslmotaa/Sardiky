/**
 * Base inicial de alimentos — valores por 100 g de referência da TACO
 * (Tabela Brasileira de Composição de Alimentos, NEPA/Unicamp, 4ª ed.).
 *
 * ATENÇÃO: valores transcritos para a demonstração. Antes de usar com pacientes,
 * confira com a tabela oficial ou importe a TACO completa. As medidas caseiras e
 * os fatores de cocção (peso cozido ÷ peso cru) são aproximados e editáveis no painel.
 */
export type SeedFood = {
  name: string
  group: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium?: number
  cookingFactor?: number
  measures: [string, number][]
}

export const TACO_FOODS: SeedFood[] = [
  // Cereais, pães e tubérculos
  { name: 'Arroz, tipo 1, cozido', group: 'cereais', kcal: 128, protein: 2.5, carbs: 28.1, fat: 0.2, fiber: 1.6, sodium: 1, cookingFactor: 2.5, measures: [['colher de sopa cheia', 25], ['escumadeira', 80], ['colher de servir', 45]] },
  { name: 'Arroz, integral, cozido', group: 'cereais', kcal: 124, protein: 2.6, carbs: 25.8, fat: 1.0, fiber: 2.7, sodium: 1, cookingFactor: 2.5, measures: [['colher de sopa cheia', 25], ['escumadeira', 80]] },
  { name: 'Batata-doce, cozida', group: 'cereais', kcal: 77, protein: 0.6, carbs: 18.4, fat: 0.1, fiber: 2.2, sodium: 3, measures: [['colher de sopa', 30], ['unidade média', 130], ['fatia média', 40]] },
  { name: 'Batata inglesa, cozida', group: 'cereais', kcal: 52, protein: 1.2, carbs: 11.9, fat: 0.0, fiber: 1.3, sodium: 2, measures: [['unidade média', 90], ['colher de sopa', 30]] },
  { name: 'Mandioca, cozida', group: 'cereais', kcal: 125, protein: 0.6, carbs: 30.1, fat: 0.3, fiber: 1.6, sodium: 1, measures: [['pedaço médio', 60], ['colher de sopa', 30]] },
  { name: 'Macarrão de trigo, cru', group: 'cereais', kcal: 371, protein: 10.0, carbs: 77.9, fat: 1.3, fiber: 2.9, sodium: 7, cookingFactor: 2.4, measures: [['xícara (cru)', 80]] },
  { name: 'Pão francês', group: 'cereais', kcal: 300, protein: 8.0, carbs: 58.6, fat: 3.1, fiber: 2.3, sodium: 648, measures: [['unidade', 50]] },
  { name: 'Pão de forma integral', group: 'cereais', kcal: 253, protein: 9.4, carbs: 49.9, fat: 3.7, fiber: 6.9, sodium: 506, measures: [['fatia', 25]] },
  { name: 'Polvilho doce (goma de tapioca)', group: 'cereais', kcal: 351, protein: 0.4, carbs: 86.8, fat: 0.0, fiber: 0.2, sodium: 2, measures: [['colher de sopa', 15]] },
  { name: 'Cuscuz de milho, cozido', group: 'cereais', kcal: 113, protein: 2.2, carbs: 25.3, fat: 0.7, fiber: 2.1, sodium: 247, measures: [['colher de sopa', 20], ['xícara', 120]] },
  { name: 'Aveia em flocos', group: 'cereais', kcal: 394, protein: 13.9, carbs: 66.6, fat: 8.5, fiber: 9.1, sodium: 5, measures: [['colher de sopa', 15], ['colher de sobremesa', 8]] },
  { name: 'Farinha de mandioca torrada', group: 'cereais', kcal: 365, protein: 1.2, carbs: 89.2, fat: 0.3, fiber: 6.5, sodium: 10, measures: [['colher de sopa', 16]] },
  { name: 'Biscoito cream cracker', group: 'cereais', kcal: 432, protein: 10.1, carbs: 68.7, fat: 14.4, fiber: 2.5, sodium: 854, measures: [['unidade', 6]] },
  { name: 'Milho verde em conserva, drenado', group: 'cereais', kcal: 98, protein: 3.2, carbs: 17.1, fat: 2.4, fiber: 4.6, sodium: 260, measures: [['colher de sopa', 25]] },

  // Leguminosas
  { name: 'Feijão carioca, cozido', group: 'leguminosas', kcal: 76, protein: 4.8, carbs: 13.6, fat: 0.5, fiber: 8.5, sodium: 2, cookingFactor: 2.2, measures: [['concha média', 80], ['colher de sopa', 17]] },
  { name: 'Feijão preto, cozido', group: 'leguminosas', kcal: 77, protein: 4.5, carbs: 14.0, fat: 0.5, fiber: 8.4, sodium: 2, cookingFactor: 2.2, measures: [['concha média', 80], ['colher de sopa', 17]] },
  { name: 'Lentilha, cozida', group: 'leguminosas', kcal: 93, protein: 6.3, carbs: 16.3, fat: 0.5, fiber: 7.9, sodium: 1, cookingFactor: 2.5, measures: [['concha média', 80], ['colher de sopa', 18]] },
  { name: 'Grão-de-bico, cozido', group: 'leguminosas', kcal: 129, protein: 7.0, carbs: 21.2, fat: 2.1, fiber: 5.1, sodium: 5, cookingFactor: 2.2, measures: [['colher de sopa', 22]] },

  // Carnes e ovos
  { name: 'Ovo de galinha, inteiro, cozido', group: 'carnes', kcal: 146, protein: 13.3, carbs: 0.6, fat: 9.5, fiber: 0, sodium: 146, measures: [['unidade', 50]] },
  { name: 'Ovo de galinha, inteiro, frito', group: 'carnes', kcal: 240, protein: 15.6, carbs: 1.2, fat: 18.6, fiber: 0, sodium: 173, measures: [['unidade', 50]] },
  { name: 'Frango, peito sem pele, grelhado', group: 'carnes', kcal: 159, protein: 32.0, carbs: 0, fat: 2.5, fiber: 0, sodium: 50, cookingFactor: 0.7, measures: [['filé médio', 100], ['colher de sopa (desfiado)', 20]] },
  { name: 'Carne bovina, patinho, grelhado', group: 'carnes', kcal: 219, protein: 35.9, carbs: 0, fat: 7.3, fiber: 0, sodium: 60, cookingFactor: 0.65, measures: [['bife médio', 100]] },
  { name: 'Carne bovina, acém moído, cozido', group: 'carnes', kcal: 212, protein: 26.7, carbs: 0, fat: 10.9, fiber: 0, sodium: 52, cookingFactor: 0.7, measures: [['colher de sopa', 25]] },
  { name: 'Merluza, filé, assado', group: 'carnes', kcal: 122, protein: 26.6, carbs: 0, fat: 0.9, fiber: 0, sodium: 80, measures: [['filé médio', 100]] },
  { name: 'Atum em conserva no óleo', group: 'carnes', kcal: 166, protein: 26.2, carbs: 0, fat: 6.0, fiber: 0, sodium: 362, measures: [['colher de sopa', 20], ['lata drenada', 120]] },
  { name: 'Sardinha em conserva no óleo', group: 'carnes', kcal: 285, protein: 15.9, carbs: 0, fat: 24.0, fiber: 0, sodium: 666, measures: [['unidade', 30]] },

  // Leite e derivados
  { name: 'Leite de vaca integral', group: 'laticinios', kcal: 61, protein: 2.9, carbs: 4.3, fat: 3.2, fiber: 0, sodium: 64, measures: [['copo (200 ml)', 200], ['xícara (240 ml)', 240]] },
  { name: 'Leite de vaca desnatado', group: 'laticinios', kcal: 35, protein: 3.4, carbs: 4.9, fat: 0.2, fiber: 0, sodium: 51, measures: [['copo (200 ml)', 200]] },
  { name: 'Iogurte natural', group: 'laticinios', kcal: 51, protein: 4.1, carbs: 1.9, fat: 3.0, fiber: 0, sodium: 52, measures: [['pote', 170]] },
  { name: 'Queijo minas frescal', group: 'laticinios', kcal: 264, protein: 17.4, carbs: 3.2, fat: 20.2, fiber: 0, sodium: 31, measures: [['fatia média', 30]] },
  { name: 'Queijo mussarela', group: 'laticinios', kcal: 330, protein: 22.6, carbs: 3.0, fat: 25.2, fiber: 0, sodium: 581, measures: [['fatia', 15]] },
  { name: 'Requeijão cremoso', group: 'laticinios', kcal: 257, protein: 9.6, carbs: 2.4, fat: 23.4, fiber: 0, sodium: 558, measures: [['colher de sopa', 30]] },

  // Frutas
  { name: 'Banana prata', group: 'frutas', kcal: 98, protein: 1.3, carbs: 26.0, fat: 0.1, fiber: 2.0, sodium: 0, measures: [['unidade média', 60]] },
  { name: 'Banana nanica', group: 'frutas', kcal: 92, protein: 1.4, carbs: 23.8, fat: 0.1, fiber: 1.9, sodium: 0, measures: [['unidade média', 90]] },
  { name: 'Maçã Fuji, com casca', group: 'frutas', kcal: 56, protein: 0.3, carbs: 15.2, fat: 0.0, fiber: 1.3, sodium: 0, measures: [['unidade média', 130]] },
  { name: 'Mamão papaia', group: 'frutas', kcal: 40, protein: 0.5, carbs: 10.4, fat: 0.1, fiber: 1.0, sodium: 2, measures: [['unidade', 310], ['fatia média', 100]] },
  { name: 'Laranja pera', group: 'frutas', kcal: 37, protein: 1.0, carbs: 8.9, fat: 0.1, fiber: 0.8, sodium: 0, measures: [['unidade média (gomos)', 130]] },
  { name: 'Morango', group: 'frutas', kcal: 30, protein: 0.9, carbs: 6.8, fat: 0.3, fiber: 1.7, sodium: 0, measures: [['unidade', 12], ['xícara', 140]] },
  { name: 'Melancia', group: 'frutas', kcal: 33, protein: 0.9, carbs: 8.1, fat: 0.0, fiber: 0.1, sodium: 0, measures: [['fatia média', 200]] },
  { name: 'Abacate', group: 'frutas', kcal: 96, protein: 1.2, carbs: 6.0, fat: 8.4, fiber: 6.3, sodium: 0, measures: [['colher de sopa', 30]] },
  { name: 'Uva Itália', group: 'frutas', kcal: 53, protein: 0.7, carbs: 13.6, fat: 0.2, fiber: 0.9, sodium: 0, measures: [['cacho pequeno', 100], ['unidade', 8]] },
  { name: 'Kiwi', group: 'frutas', kcal: 51, protein: 1.3, carbs: 11.5, fat: 0.6, fiber: 2.7, sodium: 0, measures: [['unidade', 75]] },
  { name: 'Pera Williams', group: 'frutas', kcal: 53, protein: 0.6, carbs: 14.0, fat: 0.1, fiber: 3.0, sodium: 0, measures: [['unidade média', 130]] },

  // Verduras e legumes
  { name: 'Alface crespa, crua', group: 'verduras', kcal: 11, protein: 1.3, carbs: 1.7, fat: 0.2, fiber: 1.8, sodium: 3, measures: [['folha média', 10], ['prato raso', 40]] },
  { name: 'Tomate, cru', group: 'verduras', kcal: 15, protein: 1.1, carbs: 3.1, fat: 0.2, fiber: 1.2, sodium: 1, measures: [['fatia', 15], ['unidade média', 100]] },
  { name: 'Cenoura, crua', group: 'verduras', kcal: 34, protein: 1.3, carbs: 7.7, fat: 0.2, fiber: 3.2, sodium: 3, measures: [['colher de sopa (ralada)', 12], ['unidade média', 70]] },
  { name: 'Brócolis, cozido', group: 'verduras', kcal: 25, protein: 2.1, carbs: 4.4, fat: 0.5, fiber: 3.4, sodium: 2, measures: [['ramo', 10], ['colher de sopa', 15]] },
  { name: 'Abobrinha italiana, cozida', group: 'verduras', kcal: 15, protein: 1.1, carbs: 3.0, fat: 0.2, fiber: 1.6, sodium: 1, measures: [['colher de sopa', 20]] },
  { name: 'Beterraba, cozida', group: 'verduras', kcal: 32, protein: 1.3, carbs: 7.2, fat: 0.1, fiber: 1.9, sodium: 23, measures: [['colher de sopa', 20], ['fatia', 15]] },
  { name: 'Chuchu, cozido', group: 'verduras', kcal: 19, protein: 0.4, carbs: 4.8, fat: 0.0, fiber: 1.0, sodium: 1, measures: [['colher de sopa', 20]] },
  { name: 'Couve-manteiga, refogada', group: 'verduras', kcal: 90, protein: 1.7, carbs: 8.7, fat: 6.6, fiber: 5.7, sodium: 7, measures: [['colher de sopa', 20]] },

  // Óleos, gorduras e oleaginosas
  { name: 'Azeite de oliva extravirgem', group: 'gorduras', kcal: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, sodium: 0, measures: [['colher de sopa', 8], ['colher de chá', 3]] },
  { name: 'Manteiga com sal', group: 'gorduras', kcal: 726, protein: 0.4, carbs: 0.1, fat: 82.4, fiber: 0, sodium: 579, measures: [['colher de chá', 5]] },
  { name: 'Castanha-do-brasil', group: 'gorduras', kcal: 643, protein: 14.5, carbs: 15.1, fat: 63.5, fiber: 7.9, sodium: 1, measures: [['unidade', 4]] },
  { name: 'Amendoim, cru', group: 'gorduras', kcal: 544, protein: 27.2, carbs: 20.3, fat: 43.9, fiber: 8.0, sodium: 0, measures: [['colher de sopa', 17]] },

  // Açúcares e bebidas
  { name: 'Mel', group: 'acucares', kcal: 309, protein: 0, carbs: 84.0, fat: 0, fiber: 0, sodium: 6, measures: [['colher de sopa', 20], ['colher de chá', 7]] },
  { name: 'Açúcar refinado', group: 'acucares', kcal: 387, protein: 0, carbs: 99.5, fat: 0, fiber: 0, sodium: 0, measures: [['colher de chá', 5], ['colher de sopa', 12]] },
  { name: 'Café, infusão 10%', group: 'bebidas', kcal: 9, protein: 0.7, carbs: 1.5, fat: 0.1, fiber: 0, sodium: 1, measures: [['xícara de café', 50], ['xícara de chá', 180]] },
  { name: 'Suco de laranja natural', group: 'bebidas', kcal: 33, protein: 0.7, carbs: 7.6, fat: 0.1, fiber: 0, sodium: 0, measures: [['copo (200 ml)', 200]] },
]
