// ------------------------------------------------------------
// __tests__/db/setup.ts — env for the real-database lane (G3)
//
// Runs before any test module loads. db/index.ts builds its Pool from
// DATABASE_URL at import time, so it is set HERE from TEST_DATABASE_URL —
// and only from that, never from a .env. Refuses anything that does not
// look like a scratch database: harness.ts truncates every table.
// ------------------------------------------------------------

const url = process.env.TEST_DATABASE_URL
if (!url) {
  throw new Error(
    'TEST_DATABASE_URL is not set. The db lane needs a scratch Postgres — see vitest.db.config.ts. ' +
    'Run `pnpm --filter backend test` for the unit lane instead.',
  )
}
if (!/\/[^/?]*(test|ci)[^/?]*(\?|$)/i.test(url)) {
  throw new Error('Refusing to run the db lane: the database name must contain "test" or "ci" (the harness truncates tables).')
}

process.env.DATABASE_URL       = url
process.env.NODE_ENV           = 'test'
process.env.JWT_SECRET         = 'db-lane-jwt-secret-that-is-long-enough-for-testing-only-do-not-use'
process.env.COOKIE_SECRET      = 'db-lane-cookie-secret-32-bytes!!'
process.env.JWT_ACCESS_TTL     = '15m'
process.env.JWT_REFRESH_TTL_MS = String(7 * 24 * 60 * 60 * 1000)
