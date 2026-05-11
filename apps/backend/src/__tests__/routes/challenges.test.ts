// ------------------------------------------------------------
// routes/challenges.test.ts — Challenge endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildChallengeTestApp } from '../helpers/buildApp'
import {
  makeClient, makeChallenge, validChallengeBody,
  TEST_TRAINER_ID, TEST_CLIENT_ID, TEST_CHALLENGE_ID,
} from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

vi.mock('../../db', () => {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockResolvedValue([]),
    limit:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    db: {
      query: {
        clients:    { findFirst: vi.fn().mockResolvedValue(undefined) },
        challenges: {
          findFirst: vi.fn().mockResolvedValue(undefined),
          findMany:  vi.fn().mockResolvedValue([]),
        },
      },
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue(chain),
    },
    clients:    {},
    challenges: {},
  }
})

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

// ── GET /clients/:clientId/challenges ─────────────────────────────────────────

describe('GET /clients/:clientId/challenges', () => {
  let app: Awaited<ReturnType<typeof buildChallengeTestApp>>
  beforeAll(async () => { app = await buildChallengeTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/challenges` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/challenges`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns challenge list for an owned client', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    vi.mocked(db.query.challenges.findMany).mockResolvedValueOnce([makeChallenge()])

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/challenges`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})

// ── POST /clients/:clientId/challenges ────────────────────────────────────────

describe('POST /clients/:clientId/challenges', () => {
  let app: Awaited<ReturnType<typeof buildChallengeTestApp>>
  beforeAll(async () => { app = await buildChallengeTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/challenges`, payload: validChallengeBody,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/challenges`,
      headers: authHeader(), payload: { title: 'Missing metric type' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when client does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/challenges`,
      headers: authHeader(), payload: validChallengeBody,
    })
    expect(res.statusCode).toBe(404)
  })

  it('creates a challenge for an owned client', async () => {
    const { db } = await import('../../db')
    const challenge = makeChallenge()
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([challenge])
    vi.mocked(db.query.challenges.findFirst).mockResolvedValueOnce(challenge)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/challenges`,
      headers: authHeader(), payload: validChallengeBody,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toHaveProperty('id', TEST_CHALLENGE_ID)
  })
})

// ── PATCH /challenges/:id ─────────────────────────────────────────────────────

describe('PATCH /challenges/:id', () => {
  let app: Awaited<ReturnType<typeof buildChallengeTestApp>>
  beforeAll(async () => { app = await buildChallengeTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/challenges/${TEST_CHALLENGE_ID}`, payload: {},
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when challenge belongs to another trainer', async () => {
    // Default chain.returning returns [] → [updated] undefined → 404
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/challenges/${TEST_CHALLENGE_ID}`,
      headers: authHeader(), payload: { title: 'Updated title' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('updates a challenge owned by the trainer', async () => {
    const { db } = await import('../../db')
    const challenge = makeChallenge()
    // PATCH with title only (no currentValue) → skips pre-update findOwnedChallenge
    // Flow: update.returning → [updated], then findOwnedChallenge for response
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning)
      .mockResolvedValueOnce([{ ...challenge, title: 'Updated' }])
    vi.mocked(db.query.challenges.findFirst).mockResolvedValueOnce(challenge)

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/challenges/${TEST_CHALLENGE_ID}`,
      headers: authHeader(), payload: { title: 'Updated' },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ── DELETE /challenges/:id ────────────────────────────────────────────────────

describe('DELETE /challenges/:id', () => {
  let app: Awaited<ReturnType<typeof buildChallengeTestApp>>
  beforeAll(async () => { app = await buildChallengeTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/challenges/${TEST_CHALLENGE_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when challenge does not belong to trainer', async () => {
    // Default chain.returning returns [] → [updated] undefined → 404
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/challenges/${TEST_CHALLENGE_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('cancels (soft-deletes) a challenge owned by the trainer', async () => {
    const { db } = await import('../../db')
    const challenge = makeChallenge()
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning)
      .mockResolvedValueOnce([{ ...challenge, status: 'cancelled' as const }])
    vi.mocked(db.query.challenges.findFirst).mockResolvedValueOnce({ ...challenge, status: 'cancelled' as const })

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/challenges/${TEST_CHALLENGE_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
  })
})
