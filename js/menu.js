/*
 * Cardápio Rock Me Mamma.
 * Para mudar um preço, um nome ou uma descrição, edite só este arquivo.
 *
 * Campos de cada item:
 *   name    nome do prato ou drink
 *   size    complemento pequeno ao lado do nome (ex.: "600 ml", "12 anos")
 *   desc    descrição (opcional)
 *   price   preço em reais (número) ...
 *   prices  ... ou vários preços: [{ label: "350 ml", value: 18 }, ...]
 *   extra   adicional opcional: { label: "Com lascas de frango", value: 47 }
 *   tags    "veg" (vegetariano), "vegan" (vegano), "lac" (zero lactose)
 */
window.MENU = [
  {
    id: "cozinha",
    label: "Cozinha",
    categories: [
      {
        id: "entradas",
        title: "Entradas",
        items: [
          { name: "Pizzeta", desc: "Massa da nossa pizza, temperada com azeite de ervas, sal rosa e queijo grana padano.", price: 31, tags: ["veg"] },
          { name: "Steak Tartare", desc: "Filé mignon batido na ponta da faca com os temperos da Chef, acompanha nossa massa de pizza crocante.", price: 71 },
          { name: "Pastéis de Brie com geleia de pimentões", desc: "Porção de 4 mini pastéis, com geleia de pimentões da casa.", price: 37, tags: ["veg"] },
          { name: "Bolinhos de carne seca com queijo Canastra", desc: "Porção com 3 bolinhos, servidos com molho campana.", price: 42 },
          { name: "Croquetes de costela defumada", desc: "Porção de 3 croquetes com emulsão de leite e gremolata.", price: 38 },
          { name: "Burrata com tomates confitados", desc: "Coberta por pesto genovês e rúcula, acompanha nossa massa crocante e flor de sal.", price: 89, tags: ["veg"] },
          { name: "Dadinhos de tapioca", desc: "Porção de 6 dadinhos, acompanha geleia de maçã com pimenta dedo-de-moça.", price: 39 },
          { name: "Carpaccio", desc: "Servido com alcaparras, molho da casa, parmesão capa preta, rúcula fresca e massa crocante de pizzeta.", price: 53 },
          { name: "Fish & Chips", desc: "Batata rústica e peixe empanado temperado com lemon pepper e molho sour cream.", price: 46 },
          { name: "Costela desfiada com batata", desc: "Costela desfiada, batata palito e creme de queijo.", price: 49 }
        ]
      },
      {
        id: "pizzas-tradicionais",
        title: "Pizzas Tradicionais",
        items: [
          { name: "Mozzarela", desc: "Molho de tomate e mozzarela.", price: 55, tags: ["veg"] },
          { name: "Caprese", desc: "Molho de tomate, mozzarela, manjericão, queijo grana padano e azeite de oliva.", price: 68, tags: ["veg"] },
          { name: "Margherita Tradicional", desc: "Molho de tomate, mozzarela, manjericão, grana padano e azeite de oliva extravirgem.", price: 63, tags: ["veg"] },
          { name: "Lusa à Portuguesa do Mamma", desc: "Molho de tomate, mozzarela, presunto, ovos, cebola roxa e azeitonas.", price: 65 },
          { name: "Calabresa", desc: "Molho de tomate, mozzarela, calabresa defumada, cebola roxa e orégano.", price: 67 },
          { name: "Marinara", desc: "Molho de tomate, alho negro, orégano, manjericão e azeite de oliva extravirgem. Sem queijo.", price: 65, tags: ["vegan", "lac"] },
          { name: "Pierot", desc: "Molho de tomate, mozzarela, gorgonzola e peras confitadas.", price: 68 },
          { name: "Candy Bacon", desc: "Molho de tomate, mozzarela, gorgonzola e bacon caramelizado.", price: 68 },
          { name: "Corn & Bacon", desc: "Molho de tomate, mozzarela, milho e fatias de bacon.", price: 68 },
          { name: "Milho Cremoso", desc: "Molho de tomate, mozzarela, milho e requeijão cremoso.", price: 68, tags: ["veg"] },
          { name: "Zucchini do Mamma", desc: "Molho de tomate, mozzarela, fatias de abobrinha grelhadas, queijo grana padano, finalizada com alho crispy e semente de girassol.", price: 62, tags: ["veg"] },
          { name: "Margherita do Mamma", desc: "Molho de tomate, queijo mozzarela, grana padano, rodelas de tomate e folhas de manjericão.", price: 66 },
          { name: "Pepperoni / Diavola", desc: "Pepperoni: molho de tomate, mozzarela e pepperoni. Diavola: molho de tomate, mozzarela, pepperoni e geleia de pimenta da casa.", price: 71 },
          { name: "3 Queijos", desc: "Molho de tomate, mozzarela, gorgonzola e brie.", price: 74 },
          { name: "La Reina", desc: "Molho de tomate, mozzarela, cogumelos frescos, presunto e azeitonas.", price: 72 },
          { name: "Rúcula e Tomate Seco", desc: "Molho de tomate, queijo mozzarela, finalizada com rúcula, mozzarela de búfala, tapenade de azeitonas e tomate seco.", price: 68 },
          { name: "Caprese Specialle", desc: "Molho de tomate, queijo mozzarela, rodelas de tomate com requeijão cremoso e tapenade de azeitonas.", price: 72 },
          { name: "Pizza Specialle LAC FREE", desc: "Peça qualquer uma das nossas pizzas em versão sem lactose.", price: 14, priceNote: "adicional", tags: ["lac"] }
        ]
      },
      {
        id: "pizzas-especiais",
        title: "Pizzas Especiais do Mamma",
        items: [
          { name: "Tartufi", desc: "Molho de tomate, mozzarela, scamorza de búfala, cogumelos frescos, crocante de parma e azeite trufado.", price: 88 },
          { name: "Brie e Abricot", desc: "Molho de tomate, presunto di Parma, brie e damascos.", price: 88 },
          { name: "Burrata", desc: "Molho de tomate, burrata, pesto genovês, tomatinhos confitados e rúcula.", price: 92, tags: ["veg"] },
          { name: "Lusa Lux", desc: "Molho de tomate, mozzarela, presunto de Parma, ovo cozido, cebola roxa e tapenade de azeitona preta.", price: 85 },
          { name: "Alcachofra do Mamma", desc: "Molho de tomate, queijo mozzarela, coração de alcachofra, finalizada com cebola crispy e orégano.", price: 89 },
          { name: "Truffle Rock", desc: "Molho de tomate, queijo brie, cogumelos refogados à moda oriental, finalizada com mel trufado.", price: 79, extra: { label: "Sugestão do chef: Parma Crispy", value: 9 } },
          { name: "Salmão", desc: "Sour cream, raspas de limão, brotos variados e salmão curado. Pizza fria de molho branco.", price: 99 },
          { name: "Burrata com Pesto Rosso", desc: "Massa, molho de tomate, queijo mozzarela, burrata fatiada, finalizada com pesto rosso.", price: 89 }
        ]
      },
      {
        id: "pizzas-doces",
        title: "Pizzas Doces",
        items: [
          { name: "Paraíso", desc: "Pizza de chocolate suíço ao leite, Nutella, mini Oreo e xerém de castanha de caju.", price: 89 },
          { name: "Delícia de Frutas", desc: "Queijo brie, chocolate branco suíço, geleia de frutas vermelhas e bolacha amanteigada.", price: 89 },
          { name: "Sonho de Valsa / Ouro Branco", desc: "Brigadeiro do chef, Sonho de Valsa ou Ouro Branco, topping de bolacha Negresco.", price: 72 },
          { name: "Pizza Snickers", desc: "Ganache de chocolate, amendoim tostado, doce de leite, bombom Snickers e granulados.", price: 72 }
        ]
      },
      {
        id: "saladas",
        title: "Saladas",
        items: [
          { name: "Caesar Salad", desc: "Alface americana, croutons artesanais de parmesão, molho Caesar e raspas de parmesão.", price: 40, tags: ["veg"], extra: { label: "Com lascas de frango", value: 47, total: true } },
          { name: "Gorgonzola, pera e nozes", desc: "Mix de folhas, gorgonzola, pera confitada e nozes caramelizadas, acompanha emulsão de balsâmico, azeite de oliva e mel.", price: 44, tags: ["veg"] }
        ]
      },
      {
        id: "kids",
        title: "Menu Kids",
        items: [
          { name: "Chicken & Chips", desc: "Nuggets com batata palito e molho rosé.", price: 45 },
          { name: "Spaghetti & Nuggets", desc: "Spaghetti na manteiga, acompanha nuggets.", price: 45 }
        ]
      },
      {
        id: "sobremesas",
        title: "Sobremesas",
        items: [
          { name: "Banoffee Desconstruída", desc: "Banoffee desconstruída com bananas flambadas.", price: 35 },
          { name: "Brownie com Crumble Doce", desc: "Brownie servido com sorvete de creme, brigadeiro mole e crumble.", price: 36 },
          { name: "Petit Gâteau Chocolate / Doce de Leite", desc: "A tradicional sobremesa francesa, acompanha sorvete de creme e calda de doce de leite.", price: 38 },
          { name: "Domo de Chocolate", desc: "Esfera regada com calda de chocolate quente, sorvete de pistache e crocante de amendoim.", price: 47 }
        ]
      }
    ]
  },
  {
    id: "bar",
    label: "Bar",
    categories: [
      {
        id: "drinks-originais",
        title: "Drinks Originais do Mamma",
        items: [
          { name: "Mamma Fashion", desc: "Rum, kiwi, pera e espuma de gengibre.", price: 37 },
          { name: "Jack Lemon", desc: "Jack Daniel's, licor Curaçao, suco de limão e Schweppes Citrus.", price: 38 },
          { name: "Loneliness", desc: "Whisky The Singleton 12 anos, licor de café e Licor 43.", price: 44 },
          { name: "Red Velvet", desc: "Vodka Ketel One, suco de limão e purê de frutas vermelhas.", price: 39 },
          { name: "Margarita de Morango", desc: "Tequila prata, Monin de morango, redução de pimenta, suco e espuma de limão.", price: 39 },
          { name: "Creta", desc: "Gin, amora, cranberry, suco de limão-siciliano, suco de limão-taiti e frutas vermelhas.", price: 36 },
          { name: "Red Mamma", desc: "Gin, purê de frutas vermelhas, grenadine, suco de limão e Schweppes.", price: 36 },
          { name: "Aperol Bucko", desc: "Aperol, gin Bucko, Monin de tangerina, tônica e laranja desidratada.", price: 38 },
          { name: "Jack 43", desc: "Whiskey Jack Daniel's, Licor 43, polpa de maracujá e alecrim.", price: 38 },
          { name: "Tequila Sunrise", desc: "Tequila, Monin de toranja e suco de laranja.", price: 36 }
        ]
      },
      {
        id: "caipirinhas",
        title: "Caipirinhas",
        note: "Com cachaça Ypióca, vodka Smirnoff ou saquê.",
        compact: true,
        items: [
          { name: "Limão", price: 29 },
          { name: "Morango", price: 36 },
          { name: "Frutas vermelhas", price: 38 },
          { name: "Maracujá com hortelã e gengibre", price: 35 }
        ]
      },
      {
        id: "classicos",
        title: "Clássicos",
        items: [
          { name: "Aperol Spritz", desc: "Aperol, espumante brut, água tônica e laranja-baía.", price: 36 },
          { name: "Boulevardier", desc: "Bulleit Bourbon, vermute tinto, Campari, bitter e laranja-baía.", price: 38 },
          { name: "Cosmopolitan", desc: "Vodka, licor Curaçao, suco de limão, cranberry e cereja.", price: 38 },
          { name: "Bulleit & Coke / Jack n' Coke", desc: "Bourbon e Coca-Cola.", prices: [{ label: "Bulleit", value: 39 }, { label: "Jack", value: 36 }] },
          { name: "Dry Martini", desc: "Gin, vermute dry e azeitona.", price: 33 },
          { name: "Paloma", desc: "Tequila Don Julio, xarope de toranja, limão e água com gás.", price: 38 },
          { name: "Kir Royal", desc: "Espumante brut, licor de creme de cassis e cereja.", price: 35 },
          { name: "Manhattan", desc: "Whiskey bourbon, vermute tinto, bitter e cereja.", price: 38 },
          { name: "Margarita", desc: "Tequila, licor Curaçao, suco de limão, licor Curaçao Blue e sal.", price: 38 },
          { name: "Whisky Sour", desc: "Black Label, limão, xarope simples e albumina.", price: 36 },
          { name: "Mojito", desc: "Rum, suco de limão, açúcar invertido, água com gás e hortelã.", price: 36 },
          { name: "Moscow Mule", desc: "Vodka Ketel One, açúcar invertido, gengibre, suco de limão, bitter e espuma de gengibre.", price: 37 },
          { name: "Negroni", desc: "Gin, vermute tinto, Campari, bitter e laranja-baía.", price: 41 },
          { name: "Piña Colada", desc: "Rum, leite de coco, leite condensado, creme de leite e suco de abacaxi com coco ralado.", price: 38 },
          { name: "Penicillin", desc: "Black Label, limão-siciliano, mel e gengibre.", price: 38 },
          { name: "Pink Lemonade", desc: "Vodka Smirnoff, morango, melancia, suco de limão e suco de gengibre.", price: 38 },
          { name: "Amaretto Sour", desc: "Amaretto, suco de limão, açúcar invertido, bitter e albumina.", price: 36 },
          { name: "Campari Soda", desc: "Campari e Schweppes Citrus.", price: 28 }
        ]
      },
      {
        id: "refrescantes",
        title: "Drinks Refrescantes",
        note: "Servidos na jarra.",
        items: [
          { name: "Clericot", desc: "Licor amaretto, frutas da estação e água com gás, com vinho branco ou espumante.", prices: [{ label: "Vinho branco", value: 79 }, { label: "Espumante", value: 93 }] },
          { name: "Sangria de Vinho Tinto", desc: "Vinho tinto, Stock Curaçao e conhaque.", price: 93 }
        ]
      },
      {
        id: "gin",
        title: "Gin",
        items: [
          { name: "Gin Tônica Bucko / Tanqueray", desc: "Gin, tônica, limão-siciliano e zimbro.", prices: [{ label: "Bucko", value: 33 }, { label: "Tanqueray", value: 38 }] },
          { name: "Gin Tônica Ginger Lemon", desc: "Gin, Schweppes, Monin de gengibre e suco de limão-siciliano.", price: 35 },
          { name: "Gin Tônica de Frutas Vermelhas", desc: "Gin, Schweppes, Monin de frutas vermelhas e hibisco.", price: 36 },
          { name: "Gin Tropical", desc: "Gin e Red Bull.", price: 39 }
        ]
      },
      {
        id: "mocktails",
        title: "Mocktails",
        note: "Coquetéis sem álcool.",
        items: [
          { name: "Piña Descolada", desc: "Suco de abacaxi, leite de coco, creme de leite e leite condensado.", price: 27 },
          { name: "Mojito Virgem", desc: "Schweppes Citrus, suco de limão e hortelã.", price: 25 },
          { name: "Pink Lemonade", desc: "Schweppes, Monin de morango e melancia, e suco de limão.", price: 33 },
          { name: "Shirley Temple", desc: "Schweppes, Monin de grenadine e gengibre, e suco de limão.", price: 35 },
          { name: "Soda Italiana", desc: "Refrigerante de soda com sabor a escolher: maçã verde, cranberry, tangerina, amora, maracujá ou gengibre.", price: 19 }
        ]
      },
      {
        id: "cervejas",
        title: "Cervejas",
        groups: [
          {
            title: "Chopes e garrafas",
            compact: true,
            items: [
              { name: "Chopp Brahma", prices: [{ label: "350 ml", value: 18 }, { label: "500 ml", value: 22 }] },
              { name: "Chopp Bonato Pilsen", prices: [{ label: "350 ml", value: 14 }, { label: "500 ml", value: 18 }] },
              { name: "Chopp Bonato IPA", prices: [{ label: "350 ml", value: 22 }, { label: "500 ml", value: 25 }] },
              { name: "Baden Baden IPA Maracujá", size: "600 ml", price: 28 },
              { name: "Baden Baden Cristal Pilsen", size: "600 ml", price: 28 },
              { name: "Baden Baden Witbier de trigo, coentro e laranja", size: "600 ml", price: 28 },
              { name: "Patagonia IPA", size: "740 ml", price: 28 },
              { name: "Patagonia Amber Lager", size: "740 ml", price: 28 },
              { name: "Patagonia Weisse", size: "740 ml", price: 28 },
              { name: "Antarctica Original", size: "600 ml", price: 24 },
              { name: "Heineken", size: "600 ml", price: 24 }
            ]
          },
          {
            title: "Long necks",
            compact: true,
            items: [
              { name: "Stella Artois", price: 17 },
              { name: "Stella Artois", size: "sem glúten", price: 18 },
              { name: "Heineken", price: 18 },
              { name: "Patagonia IPA", price: 18 },
              { name: "Patagonia Amber Lager", price: 18 },
              { name: "Patagonia Weisse", price: 18 },
              { name: "Blue Moon", price: 20 },
              { name: "Heineken 0.0", price: 18 },
              { name: "Corona Cero", price: 18 },
              { name: "Lagunitas IPA", price: 20 }
            ]
          }
        ]
      },
      {
        id: "doses",
        title: "Doses",
        compact: true,
        items: [
          { name: "Singleton", size: "12 anos", price: 25 },
          { name: "Johnnie Walker Black Label", size: "12 anos", price: 25 },
          { name: "Johnnie Walker Red Label", size: "8 anos", price: 22 },
          { name: "Jack Daniel's", price: 25 },
          { name: "Jägermeister", price: 22 },
          { name: "Campari", price: 15 },
          { name: "Vodka", size: "Smirnoff ou Bacco", price: 15 },
          { name: "Vodka Ketel One", price: 25 },
          { name: "Gin Tanqueray", price: 25 },
          { name: "Cachaça", size: "Hambre ou Salinissima", prices: [{ label: "Hambre", value: 15 }, { label: "Salinissima", value: 18 }] }
        ]
      },
      {
        id: "vinho",
        title: "Vinho",
        compact: true,
        items: [
          { name: "Taça de vinho tinto ou branco", price: 27 }
        ]
      },
      {
        id: "softdrinks",
        title: "Softdrinks",
        compact: true,
        items: [
          { name: "Limonada Suíça", size: "com hortelã", price: 14 },
          { name: "Limonada Suíça", size: "com leite condensado", price: 16 },
          { name: "Suco de laranja", price: 14 },
          { name: "Refrigerantes", price: 9.9 },
          { name: "Água mineral", size: "com ou sem gás", price: 9 },
          { name: "Chá mate gelado", price: 10 },
          { name: "Chá mate gelado com limão", price: 12 },
          { name: "Chá mate gelado saborizado", desc: "Tangerina, maçã verde, pêssego, amora, grenadine ou melancia.", price: 16 },
          { name: "Red Bull", size: "tradicional, Zero ou Tropical", price: 18 }
        ]
      }
    ]
  }
];
