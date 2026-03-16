// ------------------------------------------------------------
// routes/clients.test.ts — Client endpoint integration tests (Phase 3C)
//
// Phase 3C additions tested here:
//   - GET /clients/self — returns isSelf=true client
//   - POST /clients — accepts new focus/progression fields
//   - DELETE /clients/:id — blocks deletion of self-client
//   - isSelf field present in all responses
//   - List excludes self-client
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildClientTestApp } from '../helpers/buildApp'
import {
  makeClient, makeSelfClient,
  validClientBody, validClientBodyWithFocus,
  TEST_TRAINER_ID, TEST_CLIENT_ID, TEST_UNKNOWN_ID,
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
        clients: {
          findFirst: vi.fn().mockResolvedValue(undefined),
          findMany:  vi.fn().mockResolvedValue([]),
        },
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

// ── GET /clients/self ─────────────────────────────────────────────────────────

describe('GET /api/v1/clients/self', () => {
  let app: Awaited<ReturnType<typeof buildClientTestApp>>
  beforeAll(async () => { app = await buildClientTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/clients/self' })
    expect(res.statusCode).toBe(401)
  })

  it('returns the self-client when found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeSelfClient())
    const res = await app.inject({
      method: 'GET', url: '/api/v1/clients/self',
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().isSelf).toBe(true)
    expect(res.json().name).toBe('Test Trainer')
  })

  it('returns 404 when self-client is missing (data integrity issue)', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET', url: '/api/v1/clients/self',
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── GET /clients ──────────────────────────────────────────────────────────────

describe('GET /api/v1/clients', () => {
  let app: Awaited<ReturnType<typeof buildClientTestApp>>
  beforeAll(async () => { app = await buildClientTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/clients' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with empty array when trainer has no clients', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'GET', url: '/api/v1/clients',
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns active external clients with Phase 3C fields', async () => {
    const { db } = await import('../../db')
    const client = makeClient({ primaryFocus: 'resistance', progressionState: 'programming' })
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([client])
    const res = await app.inject({
      method: 'GET', url: '/api/v1/clients',
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].primaryFocus).toBe('resistance')
    expect(body[0].progressionState).toBe('programming')
    expect(body[0].isSelf).toBe(false)
  })

  it('applies ownership WHERE clause', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([])
    await app.inject({
      method: 'GET', url: '/api/v1/clients',
      headers: { authorization: authHeader() },
    })
    expect((db as any)._chain.where).toHaveBeenCalled()
  })
})

// ── GET /clients/:id ──────────────────────────────────────────────────────────

describe('GET /api/v1/clients/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientTestApp>>
  beforeAll(async () => { app = await buildClientTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with full client including Phase 3C fields', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(
      makeClient({ primaryFocus: 'cardio', progressionState: 'assessment', isSelf: false })
    )
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(TEST_CLIENT_ID)
    expect(body.primaryFocus).toBe('cardio')
    expect(body.progressionState).toBe('assessment')
    expect(body.isSelf).toBe(false)
  })

  it('returns 404 when not found or wrong trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for non-UUID param', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/clients/not-a-uuid',
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── POST /clients ─────────────────────────────────────────────────────────────

describe('POST /api/v1/clients', () => {
  let app: Awaited<ReturnType<typeof buildClientTestApp>>
  beforeAll(async () => { app = await buildClientTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/clients', payload: validClientBody })
    expect(res.statusCode).toBe(401)
  })

  it('returns 201 with created client including focus and progression fields', async () => {
    const { db } = await import('../../db')
    const created = makeClient({ primaryFocus: 'resistance', progressionState: 'assessment' })
    ;(db as any)._chain.returning.mockResolvedValueOnce([created])
    const res = await app.inject({
      method: 'POST', url: '/api/v1/clients',
      payload: validClientBodyWithFocus,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().primaryFocus).toBe('resistance')
    expect(res.json().progressionState).toBe('assessment')
  })

  it('always sets isSelf to false for externally created clients', async () => {
    const { db } = await import('../../db')
    const created = makeClient({ isSelf: false })
    ;(db as any)._chain.returning.mockResolvedValueOnce([created])
    await app.inject({
      method: 'POST', url: '/api/v1/clients',
      payload: { ...validClientBody, isSelf: true }, // attacker tries to set isSelf
      headers: { authorization: authHeader() },
    })
    const valuesCall = (db as any)._chain.values.mock.calls[0]?.[0]
    expect(valuesCall?.isSelf).toBe(false)
  })

  it('sets trainerId from JWT, not request body', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClient()])
    await app.inject({
      method: 'POST', url: '/api/v1/clients',
      payload: { ...validClientBody, trainerId: 'attacker-id' },
      headers: { authorization: authHeader() },
    })
    const valuesCall = (db as any)._chain.values.mock.calls[0]?.[0]
    expect(valuesCall?.trainerId).toBe(TEST_TRAINER_ID)
  })

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/clients',
      payload: { email: 'no-name@example.com' },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ── PATCH /clients/:id ────────────────────────────────────────────────────────

describe('PATCH /api/v1/clients/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientTestApp>>
  beforeAll(async () => { app = await buildClientTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 200 with updated progression state', async () => {
    const { db } = await import('../../db')
    const updated = makeClient({ progressionState: 'programming' })
    ;(db as any)._chain.returning.mockResolvedValueOnce([updated])
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/clients/${TEST_CLIENT_ID}`,
      payload: { progressionState: 'programming' },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().progressionState).toBe('programming')
  })

  it('returns 404 when client not found', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.returning.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/clients/${TEST_UNKNOWN_ID}`,
      payload: { name: 'Ghost' },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── DELETE /clients/:id ───────────────────────────────────────────────────────

describe('DELETE /api/v1/clients/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientTestApp>>
  beforeAll(async () => { app = await buildClientTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/clients/${TEST_CLIENT_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 204 on successful soft-delete of external client', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient({ isSelf: false }))
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClient({ active: false })])
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/clients/${TEST_CLIENT_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(204)
    expect(db.update).toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('returns 400 and blocks deletion of self-client', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeSelfClient())
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/clients/${TEST_CLIENT_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('SELF_CLIENT_PROTECTED')
    expect(db.update).not.toHaveBeenCalled()
  })

  it('returns 404 when client not found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/clients/${TEST_UNKNOWN_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})
