"""
Gera os dados das tabelas de alimentos a partir das fontes oficiais:

  - TACO 4ª edição (NEPA/Unicamp, 2011): planilha original "Taco_4a_edicao_2011.xls";
  - Medidas caseiras do IBGE (POF 2008-2009, "Tabela de medidas referidas para os
    alimentos consumidos no Brasil"), já em CSV (pof_medidas_caseiras.csv).

Uso (precisa de xlrd==2.0.1):
  python scripts/tabelas/gerar_dados.py <Taco_4a_edicao_2011.xls> <pof_medidas_caseiras.csv>

Saída: src/db/data/taco-4ed.json e src/db/data/ibge-medidas.json
Arredondamento como na publicação impressa da TACO; "Tr" (traços) e "NA" (não se aplica) são
mantidos; "*" e células vazias (não analisado) viram null.
"""
import csv, json, os, sys
import xlrd

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
xls_path, pof_path = sys.argv[1], sys.argv[2]

# Colunas da planilha (aba "CMVCol taco3") → chave, casas decimais
COLS = {
    2: ('umidade', 1), 3: ('kcal', 0), 5: ('proteina', 1), 6: ('lipideos', 1), 7: ('colesterol', 0),
    8: ('carboidrato', 1), 9: ('fibra', 1), 10: ('cinzas', 1), 11: ('calcio', 0), 12: ('magnesio', 0),
    14: ('manganes', 2), 15: ('fosforo', 0), 16: ('ferro', 1), 17: ('sodio', 0), 18: ('potassio', 0),
    19: ('cobre', 2), 20: ('zinco', 1), 21: ('retinol', 0), 22: ('re', 0), 23: ('rae', 0),
    24: ('tiamina', 2), 25: ('riboflavina', 2), 26: ('piridoxina', 2), 27: ('niacina', 2), 28: ('vitaminaC', 1),
}

# Categoria da TACO → grupo usado nas substituições do sistema
GROUPS = {
    'Cereais e derivados': 'cereais',
    'Verduras, hortaliças e derivados': 'verduras',
    'Frutas e derivados': 'frutas',
    'Gorduras e óleos': 'gorduras',
    'Pescados e frutos do mar': 'carnes',
    'Carnes e derivados': 'carnes',
    'Leite e derivados': 'laticinios',
    'Bebidas (alcoólicas e não alcoólicas)': 'bebidas',
    'Ovos e derivados': 'carnes',
    'Produtos açucarados': 'acucares',
    'Miscelâneas': 'outros',
    'Outros alimentos industrializados': 'outros',
    'Alimentos preparados': 'outros',
    'Leguminosas e derivados': 'leguminosas',
    'Nozes e sementes': 'gorduras',
}
# Tubérculos ficam na categoria de hortaliças na TACO, mas substituem cereais no plano.
TUBERS = ('batata', 'mandioca', 'inhame', 'cara,', 'cará', 'mandioquinha', 'aipim')


ANOMALIES = []


def value(v, digits):
    if isinstance(v, str):
        v = v.strip()
        if v == 'Tr':
            return 'Tr'
        # NA = não se aplica (ex.: colesterol em vegetais), conta como zero; "*" e vazio = não analisado.
        if v == 'NA':
            return 'NA'
        if v in ('*', ''):
            return None
        # Algumas células da planilha original têm vírgula sobrando (ex.: ",0,02" = 0,02).
        fixed = v.lstrip(',').replace(',', '.')
        try:
            number = float(fixed)
        except ValueError:
            ANOMALIES.append(f'{v!r} -> ignorada')
            return None
        if fixed != v:
            ANOMALIES.append(f'{v!r} -> {fixed}')
        v = number
    r = round(float(v), digits)
    return int(r) if digits == 0 else r


sheet = xlrd.open_workbook(xls_path).sheet_by_index(0)
foods, category = [], None
for r in range(sheet.nrows):
    row = sheet.row_values(r)
    first = row[0]
    if isinstance(first, str) and first.strip() and all(not str(x).strip() for x in row[1:4]):
        category = first.strip()
        continue
    try:
        code = int(float(first))
    except (TypeError, ValueError):
        continue
    name = str(row[1]).strip()
    if not name or category not in GROUPS:
        continue
    n = {key: value(row[c], d) for c, (key, d) in COLS.items()}
    group = GROUPS[category]
    if group == 'verduras' and name.lower().startswith(TUBERS):
        group = 'cereais'
    foods.append({'code': code, 'name': name, 'category': category, 'group': group, 'n': n})

assert len(foods) == 597, len(foods)
with open(os.path.join(ROOT, 'src/db/data/taco-4ed.json'), 'w', encoding='utf-8') as f:
    json.dump(foods, f, ensure_ascii=False, separators=(',', ':'))

# Unidades de peso/volume não são medidas caseiras: ficam de fora das sugestões.
NOT_HOUSEHOLD = {'GRAMA', 'QUILO', 'MILILITRO', 'LITRO'}
# A tabela do IBGE vem sem acentos; devolve os acentos das palavras das medidas.
ACCENTS = {
    'XICARA': 'XÍCARA', 'CHA': 'CHÁ', 'CAFE': 'CAFÉ', 'PEDACO': 'PEDAÇO', 'PORCAO': 'PORÇÃO', 'MEDIO': 'MÉDIO',
    'REQUEIJAO': 'REQUEIJÃO', 'FILE': 'FILÉ', 'TACA': 'TAÇA', 'PESCOCO': 'PESCOÇO', 'FACA': 'FACA',
}


def accents(text):
    return ' '.join(ACCENTS.get(w, w) for w in text.split(' '))


seen, measures = set(), []
with open(pof_path, encoding='utf-8') as f:
    for row in csv.DictReader(f):
        try:
            grams = round(float(row['quantidade_g']), 1)
        except ValueError:
            continue
        if grams <= 0:
            continue
        prep = row['descricao_preparacao'].strip()
        measure = row['descricao_medida'].strip()
        if measure in NOT_HOUSEHOLD:
            continue
        item = (row['descricao_alimento'].strip(), '' if prep == 'NAO SE APLICA' else prep, accents(measure), grams)
        if item in seen:
            continue
        seen.add(item)
        measures.append(list(item))
with open(os.path.join(ROOT, 'src/db/data/ibge-medidas.json'), 'w', encoding='utf-8') as f:
    json.dump(measures, f, ensure_ascii=False, separators=(',', ':'))
print(len(foods), 'alimentos TACO;', len(measures), 'medidas IBGE')
print('células corrigidas na planilha:', ANOMALIES)
