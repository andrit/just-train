// ------------------------------------------------------------
// routes/client-snapshots.test.ts — Client Snapshot endpoint tests (Phase 3C)
//
// Tests all six snapshot endpoints:
//   GET  /clients/:clientId/snapshots
//   GET  /clients/:clientId/snapshots/latest
//   GET  /clients/:clientId/snapshots/:id
//   POST /clients/:clientId/snapshots
//   PATCH /clients/:clientId/snapshots/:id
//   DELETE /clients/:clientId/snapshots/:id
//
// Key design verified:
//   - All fields nullable — snapshot with only subjective scores is valid
//   - progressionState defaults to client's current state
//   - capturedBy is always set from JWT trainerId, not request body
//   - Ownership check on client always precedes snapshot operation
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildClientSnapshotTestApp } from '../helpers/buildApp'
import {
  makeClient, makeClientSnapshot,
  validSnapshotBody,
  TEST_TRAINER_ID, TEST_CLIENT_ID, TEST_SNAPSHOT_ID, TEST_UNKNOWN_ID,
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
        clients:         { findFirst: vi.fn().mockResolvedValue(undefined) },
        clientSnapshots: { findFirst: vi.fn().mockResolvedValue(undefined) },
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

// ── GET /clients/:clientId/snapshots ──────────────────────────────────────────

describe('GET /api/v1/clients/:clientId/snapshots', () => {
  let app: Awaited<ReturnType<typeof buildClientSnapshotTestApp>>
  beforeAll(async () => { app = await buildClientSnapshotTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client not owned', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 200 with empty array when no snapshots', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns 200 with serialized snapshots including all nullable fields', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([makeClientSnapshot()])
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    const snap = body[0]
    expect(snap.id).toBe(TEST_SNAPSHOT_ID)
    expect(snap.weightLbs).toBe(185)
    expect(snap.energyLevel).toBe(7)
    expect(snap.bodyFatPct).toBeNull()  // nullable — not set in factory
    expect(snap.waistIn).toBeNull()
    expect(snap.capturedBy).toBe(TEST_TRAINER_ID)
    expect(snap.progressionState).toBe('assessment')
  })
})

// ── GET /clients/:clientId/snapshots/latest ───────────────────────────────────

describe('GET /api/v1/clients/:clientId/snapshots/latest', () => {
  let app: Awaited<ReturnType<typeof buildClientSnapshotTestApp>>
  beforeAll(async () => { app = await buildClientSnapshotTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 200 with the most recent snapshot', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    vi.mocked(db.query.clientSnapshots.findFirst).mockResolvedValueOnce(makeClientSnapshot())
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/latest`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(TEST_SNAPSHOT_ID)
  })

  it('returns 404 when no snapshots exist', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    vi.mocked(db.query.clientSnapshots.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/latest`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── GET /clients/:clientId/snapshots/:id ──────────────────────────────────────

describe('GET /api/v1/clients/:clientId/snapshots/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientSnapshotTestApp>>
  beforeAll(async () => { app = await buildClientSnapshotTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 200 when found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    vi.mocked(db.query.clientSnapshots.findFirst).mockResolvedValueOnce(makeClientSnapshot())
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/${TEST_SNAPSHOT_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(TEST_SNAPSHOT_ID)
  })

  it('returns 404 when snapshot not found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    vi.mocked(db.query.clientSnapshots.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/${TEST_UNKNOWN_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── POST /clients/:clientId/snapshots ─────────────────────────────────────────

describe('POST /api/v1/clients/:clientId/snapshots', () => {
  let app: Awaited<ReturnType<typeof buildClientSnapshotTestApp>>
  beforeAll(async () => { app = await buildClientSnapshotTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      payload: validSnapshotBody,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client not owned', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      payload: validSnapshotBody,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 201 with created snapshot', async () => {
    const { db } = await import('../../db')
    const snap = makeClientSnapshot()
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([snap])
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      payload: validSnapshotBody,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().weightLbs).toBe(185)
    expect(res.json().energyLevel).toBe(7)
  })

  it('accepts a snapshot with only subjective scores (all physical fields null)', async () => {
    const { db } = await import('../../db')
    const minimalSnap = makeClientSnapshot({
      weightLbs: null, heightIn: null,
      energyLevel: 5, sleepQuality: 6, stressLevel: 7,
    })
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([minimalSnap])
    const res = await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      payload: { energyLevel: 5, sleepQuality: 6, stressLevel: 7 },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().energyLevel).toBe(5)
    expect(res.json().weightLbs).toBeNull()
  })

  it('sets capturedBy from JWT trainerId', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClientSnapshot()])
    await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      payload: validSnapshotBody,
      headers: { authorization: authHeader() },
    })
    const valuesCall = (db as any)._chain.values.mock.calls[0]?.[0]
    expect(valuesCall?.capturedBy).toBe(TEST_TRAINER_ID)
  })

  it('defaults progressionState to client current state', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(
      makeClient({ progressionState: 'programming' })
    )
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClientSnapshot({ progressionState: 'programming' })])
    await app.inject({
      method: 'POST', url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots`,
      payload: validSnapshotBody, // no progressionState provided
      headers: { authorization: authHeader() },
    })
    const valuesCall = (db as any)._chain.values.mock.calls[0]?.[0]
    expect(valuesCall?.progressionState).toBe('programming')
  })
})

// ── PATCH /clients/:clientId/snapshots/:id ────────────────────────────────────

describe('PATCH /api/v1/clients/:clientId/snapshots/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientSnapshotTestApp>>
  beforeAll(async () => { app = await buildClientSnapshotTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 200 when updated successfully', async () => {
    const { db } = await import('../../db')
    const updated = makeClientSnapshot({ weightLbs: 180 })
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([updated])
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/${TEST_SNAPSHOT_ID}`,
      payload: { weightLbs: 180 },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().weightLbs).toBe(180)
  })

  it('returns 404 when snapshot not found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/${TEST_UNKNOWN_ID}`,
      payload: { weightLbs: 180 },
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── DELETE /clients/:clientId/snapshots/:id ───────────────────────────────────

describe('DELETE /api/v1/clients/:clientId/snapshots/:id', () => {
  let app: Awaited<ReturnType<typeof buildClientSnapshotTestApp>>
  beforeAll(async () => { app = await buildClientSnapshotTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/${TEST_SNAPSHOT_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 204 on successful deletion', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeClientSnapshot()])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/${TEST_SNAPSHOT_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when snapshot not found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    ;(db as any)._chain.returning.mockResolvedValueOnce([])
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/clients/${TEST_CLIENT_ID}/snapshots/${TEST_UNKNOWN_ID}`,
      headers: { authorization: authHeader() },
    })
    expect(res.statusCode).toBe(404)
  })
})
