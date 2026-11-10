"""
Gera src/app/fonts/archivo-latin-wght400-800-wdth100-125.woff2: a Archivo variável (subconjunto
latino do @fontsource-variable/archivo) só com os pesos 400 a 800 e as larguras 100% a 125%, que
são as faixas usadas no CSS. Fica com 59 KB em vez de 90 KB, sem mudar o visual.

Uso (uma vez, só se trocar a versão da fonte ou as faixas usadas):
  pip install "fonttools[woff]" brotli
  python3 scripts/fonte-archivo.py
"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

SRC = 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2'
OUT = 'src/app/fonts/archivo-latin-wght400-800-wdth100-125.woff2'

font = instancer.instantiateVariableFont(TTFont(SRC), {'wght': (400, 600, 800), 'wdth': (100, 100, 125)})
font.flavor = 'woff2'
font.save(OUT)
print('ok', OUT)
