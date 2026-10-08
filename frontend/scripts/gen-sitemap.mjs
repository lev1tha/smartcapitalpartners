// Генерация public/sitemap.xml из данных.
// Запуск: node scripts/gen-sitemap.mjs  (также вызывается в npm run build)
import { readFileSync, writeFileSync } from 'node:fs'

const SITE = 'https://kpioshsu.com'

// Достаём id из конкретного массива внутри файла (между `const <name>...[` и `]`),
// чтобы не зацепить посторонние id (например, InvestmentBucket).
function idsFrom(file, arrayName) {
  const src = readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8')
  const start = src.indexOf(`export const ${arrayName}`)
  if (start === -1) return []
  const slice = src.slice(start, src.indexOf('\n]', start))
  return [...slice.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
}

const staticPaths = [
  '/',
  '/catalog',
  '/turnkey',
  '/test',
  '/taxes',
  '/franchises',
  '/investments',
  '/ready',
]

const models = idsFrom('catalog.ts', 'businessModels').map((id) => `/catalog/${id}`)
const franchises = idsFrom('offerings.ts', 'franchises').map((id) => `/franchises/${id}`)
const investments = idsFrom('offerings.ts', 'investments').map((id) => `/investments/${id}`)
const ready = idsFrom('offerings.ts', 'readyBusinesses').map((id) => `/ready/${id}`)

const all = [...staticPaths, ...models, ...franchises, ...investments, ...ready]

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map(
    (p) =>
      `  <url>\n    <loc>${SITE}${p}</loc>\n    <changefreq>${p === '/' ? 'weekly' : 'monthly'}</changefreq>\n    <priority>${p === '/' ? '1.0' : '0.7'}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`

writeFileSync(new URL('../public/sitemap.xml', import.meta.url), xml)
console.log(`sitemap.xml: ${all.length} URL`)
