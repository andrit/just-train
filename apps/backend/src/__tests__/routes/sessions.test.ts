// ------------------------------------------------------------
// routes/sessions.test.ts — Session endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildSessionTestApp } from '../helpers/buildApp'
import {
  makeClient, makeSession,
  validSessionBody,
  TEST_TRAINER_ID, TEST_CLIENT_ID, TEST_SESSION_ID, TEST_UNKNOWN_ID,
} from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

vi.mock('../../db', () => {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockResolvedValue([]),
    limit:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    db: {
      query: {
        clients:  { findFirst: vi.fn().mockResolvedValue(undefined) },
        sessions: { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
      },
      insert:      vi.fn().mockReturnValue(chain),
      update:      vi.fn().mockReturnValue(chain),
      delete:      vi.fn().mockReturnValue(chain),
      select:      vi.fn().mockReturnValue(chain),
      transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(chain)),
    },
    clients:         {},
    sessions:        {},
    sessionExercises: {},
    sets:            {},
    templateExercises: {},
  }
})

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

// ── GET /sessions ─────────────────────────────────────────────────────────────

describe('GET /sessions', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions' })
    expect(res.statusCode).toBe(401)
  })

  it('returns session list for the authenticated trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findMany).mockResolvedValueOnce([makeSession()])

    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions', headers: authHeader() })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })

  it('filters by status when query param provided', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findMany).mockResolvedValueOnce([])

    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions?status=planned', headers: authHeader() })
    expect(res.statusCode).toBe(200)
  })
})

// ── GET /sessions/:id ─────────────────────────────────────────────────────────
// Route uses WHERE including trainerId — no result means either non-existent
// or belongs to another trainer. Mock returns undefined to simulate both cases.

describe('GET /sessions/:id', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/sessions/${TEST_SESSION_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for a session not owned by the authenticated trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for a non-existent session', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/sessions/${TEST_UNKNOWN_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── POST /sessions ────────────────────────────────────────────────────────────

describe('POST /sessions', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: validSessionBody })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/sessions', headers: authHeader(),
      payload: { date: '2025-01-15' }, // missing clientId
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates a session for a client', async () => {
    const { db } = await import('../../db')
    const session = makeSession()
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([session])
    // Second returning call — client fetch for response (uses findFirst not insert)
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())

    const res = await app.inject({
      method: 'POST', url: '/api/v1/sessions', headers: authHeader(), payload: validSessionBody,
    })
    expect(res.statusCode).toBe(201)
  })
})

// ── PATCH /sessions/:id ───────────────────────────────────────────────────────
// Route uses db.update().where().returning() — no ownership findFirst.
// Default chain.returning returns [] → [updated] = undefined → 404.

describe('PATCH /sessions/:id', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/sessions/${TEST_SESSION_ID}`, payload: { status: 'in_progress' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when session not owned by trainer', async () => {
    // Default chain.returning returns [] → [updated] undefined → 404
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
      payload: { status: 'in_progress' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('updates status for an owned session', async () => {
    const { db } = await import('../../db')
    const session = makeSession()
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning)
      .mockResolvedValueOnce([{ ...session, status: 'in_progress' as const }])
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
      payload: { status: 'in_progress' },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ── DELETE /sessions/:id ──────────────────────────────────────────────────────
// Route uses db.delete().where().returning() — no ownership findFirst.
// Default chain.returning returns [] → [deleted] = undefined → 404.

describe('DELETE /sessions/:id', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/sessions/${TEST_SESSION_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when session not owned by trainer', async () => {
    // Default chain.returning returns [] → [deleted] undefined → 404
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('deletes an owned session', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.delete({} as never).where({} as never).returning).mockResolvedValueOnce([makeSession()])

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(204)
  })
})
