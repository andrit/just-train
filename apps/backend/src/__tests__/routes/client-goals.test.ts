// ------------------------------------------------------------
// routes/client-goals.test.ts — Client Goal endpoint tests (Phase 3C)
//
// Tests all four goal endpoints:
//   GET    /clients/:clientId/goals
//   POST   /clients/:clientId/goals
//   PATCH  /clients/:clientId/goals/:id
//   DELETE /clients/:clientId/goals/:id
//
// Pattern: ownership check (findFirst on clients) always runs first.
// If the client isn't found/owned, the goal operation never executes.
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildClientGoalTestApp } from '../helpers/buildApp'
import {
  makeClient, makeClientGoal,
  validGoalBody,
  TEST_TRAINER_ID, TEST_CLIENT_ID, TEST_GOAL_ID, TEST_UNKNOWN_ID,
} from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

vi.mock('../../db', () => {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    db: {
      query: {
        clients:     { findFirst: vi.fn().mockResolvedValue(undefined) },
        clientGoals: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      _chain: chain,
    },
    clients:         {},
    clientGoals:     {},
    clientSnapshots: {},
    trainers:        {},
  }
})

function authHeader(trainerId = TEST_TRAINER_ID) {
  return `Bearer ${generateAccessToken(trainerId, 'trainer')}`
}

// ── GET /clients/:clientId/goals ──────────────────────────────────────────────

describe('GET /api/v1/clients/:clientId/goals', () => {
  let app: Awaited<ReturnType<typeof buildClientGoalTestApp>>
  beforeAll(async () => { app = await buildClientGoalTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client not found or not owned', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 with empty array when no goals', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns 200 with serialized goals', async () => {
    const { db } = await import('../../db')
    const goal = makeClientGoal()
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([goal])
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(TEST_GOAL_ID)
    expect(body[0].goal).toBe('Run a 5K in under 30 minutes')
    expect(body[0].achievedAt).toBeNull()
    expect(body[0].progressionState).toBe('programming')
    // Dates serialized as ISO strings
    expect(typeof body[0].setAt).toBe('string')
  })

  it('returns 400 for non-UUID clientId', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/clients/not-a-uuid/goals',
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /clients/:clientId/goals ─────────────────────────────────────────────

describe('POST /api/v1/clients/:clientId/goals', () => {
  let app: Awaited<ReturnType<typeof buildClientGoalTestApp>>
  beforeAll(async () => { app = await buildClientGoalTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      payload: validGoalBody,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client not owned', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      payload: validGoalBody,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 201 with created goal', async () => {
    const { db } = await import('../../db')
    const goal = makeClientGoal()
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([goal])
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      payload: validGoalBody,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().goal).toBe('Run a 5K in under 30 minutes')
    expect(res.json().achievedAt).toBeNull()
  })

  it('defaults progressionState to client current state when not provided', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(
      makeClient({ progressionState: 'programming' })
    )
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClientGoal({ progressionState: 'programming' })])
    await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      payload: { goal: 'New goal' }, // no progressionState
      headers: { authorization: authHeader() },
    })
    const valuesCall = (db as any)._chain.values.mock.calls[0]?.[0]
    expect(valuesCall?.progressionState).toBe('programming')
  })

  it('returns 400 when goal text is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals`,
      payload: {},
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── PATCH /clients/:clientId/goals/:id ────────────────────────────────────────

describe('PATCH /api/v1/clients/:clientId/goals/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientGoalTestApp>>
  beforeAll(async () => { app = await buildClientGoalTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 200 with updated goal text', async () => {
    const { db } = await import('../../db')
    const updated = makeClientGoal({ goal: 'Run a 10K' })
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([updated])
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_GOAL_ID}`,
      payload: { goal: 'Run a 10K' },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().goal).toBe('Run a 10K')
  })

  it('marks a goal as achieved when achievedAt is provided', async () => {
    const { db } = await import('../../db')
    const achievedAt = new Date()
    const updated = makeClientGoal({ achievedAt })
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([updated])
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_GOAL_ID}`,
      payload: { achievedAt: achievedAt.toISOString() },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().achievedAt).not.toBeNull()
  })

  it('un-achieves a goal when achievedAt is null', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClientGoal({ achievedAt: null })])
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_GOAL_ID}`,
      payload: { achievedAt: null },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().achievedAt).toBeNull()
  })

  it('returns 404 when goal not found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_UNKNOWN_ID}`,
      payload: { goal: 'Updated' },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── DELETE /clients/:clientId/goals/:id ───────────────────────────────────────

describe('DELETE /api/v1/clients/:clientId/goals/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientGoalTestApp>>
  beforeAll(async () => { app = await buildClientGoalTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_GOAL_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 204 on successful deletion', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClientGoal()])
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_GOAL_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when goal not found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_UNKNOWN_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 when client not owned (ownership blocks goal access)', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/clients/${TEST_CLIENT_ID}/goals/${TEST_GOAL_ID}`,
      headers: { authorization: authHeader('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') },
    })
    expect(res.statusCode).toBe(404)
  })
})
