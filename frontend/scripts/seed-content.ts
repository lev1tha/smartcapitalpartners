// Сид контента: переносит текущие данные из src/data в backend/content/*.json
// Запуск: node scripts/seed-content.ts
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { businessModels, modelOps } from '../src/data/catalog.ts'
import { franchises, investments, readyBusinesses } from '../src/data/offerings.ts'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../../backend/content')
mkdirSync(out, { recursive: true })

const models = businessModels.map((m) => ({ ...m, ops: modelOps[m.id] ?? null }))

const write = (name: string, data: unknown) =>
  writeFileSync(resolve(out, name), JSON.stringify(data, null, 2) + '\n')

write('models.json', models)
write('franchises.json', franchises)
write('investments.json', investments)
write('ready.json', readyBusinesses)

console.log(
  `seeded: models=${models.length}, franchises=${franchises.length}, investments=${investments.length}, ready=${readyBusinesses.length}`,
)
