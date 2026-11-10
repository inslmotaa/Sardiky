import localFont from 'next/font/local'

/**
 * Fontes da marca, servidas pelo próprio site (sem Google Fonts) com next/font: o Next pré-carrega
 * os arquivos e cria uma fonte de reserva com as mesmas métricas, então o texto aparece cedo e não
 * "pula" quando a fonte chega (melhor LCP e CLS). Só o subconjunto latino (cobre o português).
 */
export const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
})

// Archivo variável cortada para as faixas usadas no CSS (peso 400–800, largura 100–125%):
// 59 KB em vez de 90 KB, mesmo visual. Gerada por scripts/fonte-archivo.py.
export const archivo = localFont({
  src: './fonts/archivo-latin-wght400-800-wdth100-125.woff2',
  variable: '--font-archivo',
  weight: '400 800',
  declarations: [{ prop: 'font-stretch', value: '100% 125%' }],
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const geistMono = localFont({
  src: '../../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
  // Rótulos pequenos: não disputa a banda com as fontes do texto principal.
  preload: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
})
