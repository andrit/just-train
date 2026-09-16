/**
 * drizzle.ci.config.ts — drizzle-kit config for the real-database TEST lane only.
 *
 * Differs from drizzle.config.ts in two ways, both deliberate:
 *   - reads TEST_DATABASE_URL, never DATABASE_URL (a .env with the dev URL
 *     must not be able to point `push` — or the truncating harness — at dev data)
 *   - strict: false — `push` must not prompt for confirmation; CI has no stdin.
 *
 * Used by: `pnpm --filter backend test:db:prepare` (= drizzle-kit push --config drizzle.ci.config.ts)
 */

import type { Config } from 'drizzle-kit'

const url = process.env['TEST_DATABASE_URL']
if (!url) throw new Error('TEST_DATABASE_URL is required for the test-database lane')
if (!/\/[^/?]*(test|ci)[^/?]*(\?|$)/i.test(url)) {
  throw new Error(`Refusing: TEST_DATABASE_URL database name must contain "test" or "ci" (got ${url.replace(/\/\/.*@/, '//***@')})`)
}

export default {
  schema:        './src/db/schema/index.ts',
  out:           './drizzle',
  dialect:       'postgresql',
  dbCredentials: { url },
  verbose:       false,
  strict:        false,
} satisfies Config
