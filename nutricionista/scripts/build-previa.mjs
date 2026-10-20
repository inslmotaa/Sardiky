// Empacota previa/src/app.tsx (demonstração da área do cliente e do painel do André) num único JS.
// Reaproveita os componentes reais do sistema; os dados ficam no localStorage do navegador.
// Uso: node scripts/build-previa.mjs <saida.js>
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const out = process.argv[2] ?? path.join(root, 'previa/app.bundle.js')

// O zod exporta todas as traduções de mensagens (~300 kB); a prévia só precisa da padrão.
const zodLocales = {
  name: 'zod-sem-traducoes',
  setup(b) {
    b.onResolve({ filter: /locales\/index\.js$/ }, (args) =>
      args.importer.includes(`${path.sep}zod${path.sep}`) ? { path: 'zod-locales', namespace: 'stub' } : undefined,
    )
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: 'server-only', namespace: 'stub' }))
    b.onLoad({ filter: /^zod-locales$/, namespace: 'stub' }, () => ({
      contents: `export { default as en } from ${JSON.stringify(path.join(root, 'node_modules/zod/v4/locales/en.js'))}`,
      resolveDir: root,
    }))
    b.onLoad({ filter: /^server-only$/, namespace: 'stub' }, () => ({
      contents: 'throw new Error("Módulo de servidor importado na prévia")',
    }))
  },
}

await build({
  entryPoints: [path.join(root, 'previa/src/app.tsx')],
  bundle: true,
  format: 'iife',
  minify: true,
  jsx: 'automatic',
  target: 'es2020',
  alias: { '@': path.join(root, 'src') },
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  plugins: [zodLocales],
  outfile: out,
  logLevel: 'warning',
})
