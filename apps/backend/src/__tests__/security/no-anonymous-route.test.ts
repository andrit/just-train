// ------------------------------------------------------------
// security/no-anonymous-route.test.ts — every route requires a token unless
// it is on the public allow-list.
//
// Layer 1 (source): each route file either registers the file-level
// `app.addHook('preHandler', authenticate)` or every route in it carries
// `preHandler: [authenticate]` — except the routes listed as PUBLIC.
// Layer 2 (runtime): every GET and DELETE in the full app answers 401 with no
// token. (POST/PATCH are excluded from the runtime layer only because Fastify
// validates the body before preHandler runs — an empty body 400s first. That
// ordering is the open decision 4e in docs/SECURITY.md; the source layer still
// covers them.)
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('../../db', () => {
  const chain = { values: vi.fn().mockReturnThis(), set: vi.fn().mockReturnThis(), from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]) }
  const q = () => ({ findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) })
  const db: Record<string, unknown> = {
    query: Object.fromEntries(['trainers','clients','clientGoals','clientSnapshots','exercises','exerciseMedia','bodyParts','templates','templateExercises','sessions','sessionExercises','sets','challenges','snapshotMedia','sessionExerciseMedia','refreshTokens','emailVerificationTokens','clientEvents'].map((t) => [t, q()])),
    insert: vi.fn().mockReturnValue(chain), update: vi.fn().mockReturnValue(chain), delete: vi.fn().mockReturnValue(chain), select: vi.fn().mockReturnValue(chain),
  }
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
  return { db, trainers: {}, clients: {}, clientGoals: {}, clientSnapshots: {}, exercises: {}, exerciseMedia: {}, bodyParts: {},
    templates: {}, templateExercises: {}, sessions: {}, sessionExercises: {}, sets: {}, syncLog: {}, challenges: {},
    snapshotMedia: {}, sessionExerciseMedia: {}, refreshTokens: {}, emailVerificationTokens: {}, idempotencyKeys: {}, clientEvents: {}, trainerUsageMonthly: {} }
})

import { buildAuditedFullTestApp, type RegisteredRoute } from '../helpers/buildApp'

const ROUTES_DIR = join(__dirname, '..', '..', 'routes')

// Routes that are public by design. Adding here is a deliberate act.
const PUBLIC = new Set([
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',       // authenticates via the httpOnly cookie + headers, not a Bearer token
  'GET /auth/verify-email',   // the emailed link; token in the query
])

describe('no anonymous route — source layer', () => {
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts')).sort()) {
    const src = readFileSync(join(ROUTES_DIR, file), 'utf8')
    const fileLevel = src.includes("app.addHook('preHandler', authenticate)")
    const re = /app\.(get|post|patch|delete)\('([^']*)'/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const key = `${(m[1] ?? '').toUpperCase()} ${m[2] ?? ''}`
      const rest = src.slice(m.index + m[0].length)
      const opts = rest.slice(0, rest.indexOf('}, async'))
      const routeLevel = opts.includes('preHandler: [authenticate]') || opts.includes('preHandler: [') && opts.includes('authenticate')
      it(`${key} (${file})`, () => {
        if (PUBLIC.has(key)) {
          expect(fileLevel || routeLevel, `${key} is listed PUBLIC but is authenticated — remove it from the list`).toBe(false)
        } else {
          expect(fileLevel || routeLevel, `${key} has no authenticate preHandler`).toBe(true)
        }
      })
    }
  }
})

describe('no anonymous route — runtime layer (GET + DELETE, no token)', () => {
  let app: Awaited<ReturnType<typeof buildAuditedFullTestApp>>['app']
  let routes: RegisteredRoute[]
  beforeAll(async () => { ({ app, routes } = await buildAuditedFullTestApp()) })
  afterAll(async ()  => { await app.close() })

  it('registered enough routes for this to mean something', () => {
    expect(routes.length).toBeGreaterThan(60)
  })

  it('every GET/DELETE under /api/v1 answers 401 without a token (public routes excepted)', async () => {
    const failures: string[] = []
    for (const r of routes) {
      if (!['GET', 'DELETE'].includes(r.method)) continue
      const key = `${r.method} ${r.url.replace('/api/v1', '')}`
      if (PUBLIC.has(key) || r.url === '/health' || r.url.startsWith('/documentation')) continue
      const url = r.url.replace(/:[A-Za-z]+/g, '11111111-1111-1111-1111-111111111111')
      const res = await app.inject({ method: r.method as 'GET' | 'DELETE', url })
      if (res.statusCode !== 401) failures.push(`${key} → ${res.statusCode}`)
    }
    expect(failures).toEqual([])
  })
})
