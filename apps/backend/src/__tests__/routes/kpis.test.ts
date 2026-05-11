// ------------------------------------------------------------
// routes/kpis.test.ts — KPI endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildKpiTestApp } from '../helpers/buildApp'
import {
  makeClient,
  TEST_TRAINER_ID, TEST_CLIENT_ID,
} from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

vi.mock('../../db', () => {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockResolvedValue([]),  // terminal for personal-bests select chain
    innerJoin: vi.fn().mockReturnThis(),       // needed for joins in personal-bests
    orderBy:   vi.fn().mockResolvedValue([]),
    limit:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    db: {
      query: {
        clients:   { findFirst: vi.fn().mockResolvedValue(undefined) },
        sessions:  { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        sets:      { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        exercises: { findMany: vi.fn().mockResolvedValue([]) },
      },
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue(chain),
    },
    clients:          {},
    sessions:         {},
    workouts:         {},
    sessionExercises: {},
    sets:             {},
  }
})

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

// ── GET /clients/:id/kpis ─────────────────────────────────────────────────────

describe('GET /clients/:id/kpis', () => {
  let app: Awaited<ReturnType<typeof buildKpiTestApp>>
  beforeAll(async () => { app = await buildKpiTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/kpis` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/kpis`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for unknown clientId', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/kpis`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns KPI response shape for an owned client with no sessions', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    // sessions.findMany defaults to [] — no additional mock needed

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/kpis`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('currentStreakWeeks')
    expect(body).toHaveProperty('bestStreakWeeks')
    expect(body).toHaveProperty('totalSessionsAllTime')
    expect(body).toHaveProperty('sessionsThisMonth')
    expect(body).toHaveProperty('focusKpi')
  })

  it('does not expose data from another trainer\'s client', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'GET',
      url:     `/api/v1/clients/${TEST_CLIENT_ID}/kpis`,
      headers: authHeader('ffffffff-ffff-ffff-ffff-ffffffffffff'),
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── GET /clients/:id/personal-bests ──────────────────────────────────────────

describe('GET /clients/:id/personal-bests', () => {
  let app: Awaited<ReturnType<typeof buildKpiTestApp>>
  beforeAll(async () => { app = await buildKpiTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/personal-bests` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/personal-bests`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns empty array when client has no logged sets', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    // chain.where defaults to mockResolvedValue([]) → rows = [] → empty result

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/personal-bests`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})
