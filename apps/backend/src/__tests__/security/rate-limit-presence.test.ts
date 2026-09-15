// ------------------------------------------------------------
// security/rate-limit-presence.test.ts — every POST that creates rows, sends
// email, uploads media, or touches credentials declares its own rate limit.
//
// The global limit (100/min) exists; this guards the per-route limits that
// cost money or bound abuse. Source-level, like the ownership guard. Routes
// that legitimately rely on the global limit are listed with a reason — an
// unlisted POST without `config.rateLimit` fails.
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROUTES_DIR = join(__dirname, '..', '..', 'routes')

// Global-limit-only, with the reason. Remove an entry once the route gets its own limit.
const GLOBAL_ONLY: Record<string, string> = {
  'POST /auth/refresh':                    'token rotation on every 15-min expiry; a per-route cap would log active users out',
  'POST /auth/logout':                     'idempotent, no cost',
  'POST /auth/logout-all':                 'idempotent, no cost',
  'POST /auth/onboard':                    'one-time per account; sets a mode, creates nothing',
  'POST /clients/:clientId/challenges':    'creates a row per trainer action; bounded by client ownership',
  'POST /clients/:clientId/goals':         'creates a row per trainer action; bounded by client ownership',
  'POST /clients/:clientId/snapshots':     'creates a row per trainer action; bounded by client ownership',
  'POST /sessions/:id/exercises':          'gym-floor write; per-route cap would block a live session',
  'POST /sessions/:id/circuits':           'gym-floor write; per-route cap would block a live session',
  'POST /session-exercises/:id/sets':      'gym-floor write (set logging); per-route cap would block a live session',
  'POST /templates/:id/exercises':         'planning-time write, bounded by template ownership',
}

describe('rate-limit presence — POST routes', () => {
  const missing: string[] = []
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8')
    const re = /app\.post\('([^']*)'/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const rest = src.slice(m.index + m[0].length)
      const opts = rest.slice(0, rest.indexOf('}, async'))
      const key = `POST ${m[1] ?? ''}`
      if (!opts.includes('rateLimit') && !(key in GLOBAL_ONLY)) missing.push(`${key} (${file})`)
    }
  }

  it('every POST either declares config.rateLimit or is listed as global-only with a reason', () => {
    expect(missing).toEqual([])
  })

  it('the global-only list does not name routes that no longer exist', () => {
    const all = new Set<string>()
    for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(join(ROUTES_DIR, file), 'utf8')
      for (const m of src.matchAll(/app\.post\('([^']*)'/g)) all.add(`POST ${m[1] ?? ''}`)
    }
    for (const key of Object.keys(GLOBAL_ONLY)) expect(all.has(key), `${key} is listed but not registered`).toBe(true)
  })
})
