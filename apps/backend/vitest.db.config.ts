// ------------------------------------------------------------
// vitest.db.config.ts — the REAL-DATABASE lane (security gate G3)
//
// The default lane (vitest.config.ts) mocks ../db in every route test and
// must stay fast. This lane runs a small set of files against a live
// Postgres — the ownership matrix and the purge-order proof — and is what
// CI runs after the unit lane. Run locally only against a scratch database:
//
//   createdb trainer_test
//   TEST_DATABASE_URL=postgresql://localhost/trainer_test pnpm --filter backend test:db:prepare
//   TEST_DATABASE_URL=postgresql://localhost/trainer_test pnpm --filter backend test:db
//
// The setup file refuses any URL whose database name does not look like a
// test database — the harness truncates every table.
// ------------------------------------------------------------

import { defineConfig } from 'vitest/config'
import path             from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles:  ['./src/__tests__/db/setup.ts'],
    include:     ['src/__tests__/db/**/*.test.ts'],
    reporter:    'verbose',
    testTimeout: 30_000,
    // One worker: the files share one database and truncate it.
    poolOptions: { threads: { singleThread: true } },
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
