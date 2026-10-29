# Tabelas de alimentos e composição nutricional

## O que o sistema usa

| Tabela | O que traz | Uso no sistema |
|---|---|---|
| **TACO 4ª ed.** (NEPA/Unicamp, 2011) | 597 alimentos, 25 nutrientes por 100 g: energia, proteína, lipídeos, carboidrato, fibra, colesterol, 9 minerais, vitaminas A, B1, B2, B3, B6 e C, umidade e cinzas | Base de alimentos do painel, editor de planos, diário e calculadoras |
| **IBGE – POF 2008-2009**, tabela de medidas referidas | 7.771 medidas caseiras (colher de sopa, concha, fatia…) em gramas | Sugestões de medidas na ficha de cada alimento |
| **Complementar** | 3 itens comuns que a TACO não analisa (leite líquido integral e desnatado, grão-de-bico cozido) | Valores de referência a conferir |
| **Próprio (rótulo)** | Alimentos cadastrados pelo coach a partir do rótulo | Produtos industrializados e marcas |

O Dietbox informa usar TBCA (USP), TACO, IBGE, USDA e Tucunduva, além de uma tabela própria com marcas parceiras. Aqui entram a **TACO** e as **medidas do IBGE**, que são públicas e de uso livre com citação da fonte:

- **Tucunduva** é um livro com direitos autorais: não pode ser copiado.
- **TBCA** só é consultada no site da USP, sem arquivo para download.
- **USDA** é americana, em inglês.

Para marcas e industrializados, use **Alimentos → Cadastrar alimento próprio**, com os dados do rótulo.

## Como os valores aparecem

- Valores por 100 g, arredondados como na TACO impressa.
- **Tr** = traços: o nutriente está presente em quantidade muito pequena e conta como zero nas somas.
- **NA** = não se aplica (ex.: colesterol em vegetais): conta como zero.
- **—** = não analisado na tabela: não entra na soma. O editor de planos marca o total com `*` e avisa que ele é parcial.
- **Alimentos sem energia na TACO** ficam inativos e fora dos planos, porque a própria tabela não traz esses valores. São 4: leite integral, leite desnatado UHT, iogurte sabor abacaxi e coco verde.

## Onde aparece no painel

- **Alimentos**: busca com filtro por grupo e por fonte. A ficha de cada alimento mostra:
  - a tabela nutricional completa, por 100 g ou por medida caseira;
  - as medidas caseiras do alimento e o fator de cocção;
  - as sugestões do IBGE, que entram com um clique em "Usar".
- **Editor de planos**: o cartão "Vitaminas e minerais" soma o dia, com fibra, cálcio, ferro, magnésio, potássio, sódio, zinco, vitamina A, vitamina C, vitaminas do complexo B e colesterol.
- **Busca de alimentos**: alimentos com medida caseira cadastrada aparecem primeiro. Por exemplo, "Arroz, tipo 1, cozido" vem antes de "Arroz, tipo 1, cru".

## Instalação e atualização

- **Em produção:** ao subir o sistema, `scripts/migrate.mjs` aplica as migrações e, se a base ainda não estiver completa, importa a TACO e as medidas do IBGE.
- **Para forçar uma atualização:** `npm run db:tabelas`. A reimportação atualiza os valores pelo número oficial da TACO e mantém as medidas caseiras, o fator de cocção e a situação (ativo/inativo) ajustados no painel.
- **Para regenerar os dados a partir das fontes:** use `scripts/tabelas/gerar_dados.py`, que precisa de `xlrd==2.0.1`. Ele lê a planilha original `Taco_4a_edicao_2011.xls` (NEPA/Unicamp) e a tabela de medidas da POF em CSV, e grava em `src/db/data/`.

## Citação das fontes

- NEPA/UNICAMP. *Tabela Brasileira de Composição de Alimentos – TACO*. 4ª ed. revisada e ampliada. Campinas: NEPA/UNICAMP, 2011.
- IBGE. *Pesquisa de Orçamentos Familiares 2008-2009: tabela de medidas referidas para os alimentos consumidos no Brasil*. Rio de Janeiro: IBGE, 2011.
