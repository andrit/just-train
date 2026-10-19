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

// ── GET /clients/:id/volume-history ───────────────────────────────────────────

describe('GET /clients/:id/volume-history', () => {
  let app: Awaited<ReturnType<typeof buildKpiTestApp>>
  beforeAll(async () => { app = await buildKpiTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  const SESSION_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const SESSION_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/volume-history` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/volume-history`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns empty points for an owned client with no sessions', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    // sessions.findMany defaults to [] → no points

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/volume-history`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ points: [] })
  })

  it('computes per-session volume and returns points oldest → newest', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    // Returned by the DB in desc date order (newest first); the route reverses.
    vi.mocked(db.query.sessions.findMany).mockResolvedValueOnce([
      {
        id: SESSION_A, date: '2026-01-02', name: 'Day 2',
        sessionExercises: [
          { sets: [{ weight: 100, reps: 10, perSide: false, repsLeft: null, repsRight: null }] },
        ],
      },
      {
        id: SESSION_B, date: '2026-01-01', name: null,
        sessionExercises: [
          { sets: [{ weight: 50, reps: 10, perSide: false, repsLeft: null, repsRight: null }] },
        ],
      },
    ] as never)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/volume-history`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.points).toHaveLength(2)
    // Chronological: oldest (Jan 1, 500) first, newest (Jan 2, 1000) last.
    expect(body.points[0]).toMatchObject({ sessionId: SESSION_B, date: '2026-01-01', name: null, volume: 500 })
    expect(body.points[1]).toMatchObject({ sessionId: SESSION_A, date: '2026-01-02', name: 'Day 2', volume: 1000 })
  })
})

// ── GET /clients/:id/muscle-frequency ─────────────────────────────────────────

describe('GET /clients/:id/muscle-frequency', () => {
  let app: Awaited<ReturnType<typeof buildKpiTestApp>>
  beforeAll(async () => { app = await buildKpiTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/muscle-frequency` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/muscle-frequency`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns empty counts for an owned client with no trained muscles', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    // select chain .where defaults to [] → no rows → empty counts

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/muscle-frequency`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ period: 'month', metric: 'sessions', counts: [] })
  })

  it('counts distinct sessions per muscle (a muscle hit twice in one session counts once)', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    const rows = [
      { sessionId: 's1', muscle: 'biceps_brachii' },
      { sessionId: 's1', muscle: 'biceps_brachii' },  // same session+muscle → still 1
      { sessionId: 's2', muscle: 'biceps_brachii' },
      { sessionId: 's1', muscle: 'pectoralis_major' },
    ]
    // The join query ends on `.where(...)` as its awaited terminal.
    const chain = (db.select as unknown as () => { where: { mockResolvedValueOnce: (v: unknown) => unknown } })()
    chain.where.mockResolvedValueOnce(rows)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/muscle-frequency`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.metric).toBe('sessions')
    const byMuscle = Object.fromEntries(
      body.counts.map((c: { muscle: string; count: number }) => [c.muscle, c.count]),
    )
    expect(byMuscle['biceps_brachii']).toBe(2)
    expect(byMuscle['pectoralis_major']).toBe(1)
  })
})
