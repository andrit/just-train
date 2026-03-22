// ------------------------------------------------------------
// seeds/index.ts — Seed runner
//
// Run with: pnpm db:seed  (from apps/backend/)
//
// Loads .env automatically — make sure your .env exists at
// apps/backend/.env with DATABASE_URL set.
// ------------------------------------------------------------

import * as dotenv from 'dotenv'
import { resolve }  from 'path'

// Load .env from the backend root (two levels up from src/db/seeds/)
dotenv.config({ path: resolve(__dirname, '../../../.env') })

if (!process.env['DATABASE_URL']) {
  console.error('❌ DATABASE_URL is not set.')
  console.error('   Make sure apps/backend/.env exists and contains DATABASE_URL.')
  process.exit(1)
}
// Seeds are idempotent — safe to run multiple times.
// Order matters: body parts must exist before exercises.
// ------------------------------------------------------------

import { seedBodyParts } from './bodyParts'
import { seedExercises } from './exercises'

async function main(): Promise<void> {
  console.log('🚀 Starting database seed…\n')

  await seedBodyParts()
  await seedExercises()

  console.log('\n✅ Seed complete')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
