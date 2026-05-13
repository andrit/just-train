// ------------------------------------------------------------
// routes/snapshot-media.test.ts — Progress photo endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildSnapshotMediaTestApp } from '../helpers/buildApp'
import {
  makeClient, makeClientSnapshot,
  TEST_TRAINER_ID, TEST_CLIENT_ID, TEST_SNAPSHOT_ID,
} from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

const TEST_MEDIA_ID = '77777777-7777-7777-7777-777777777777'

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
        clients:         { findFirst: vi.fn().mockResolvedValue(undefined) },
        clientSnapshots: { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        snapshotMedia:   { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
      },
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue(chain),
    },
    clients:         {},
    clientSnapshots: {},
    snapshotMedia:   {},
  }
})

vi.mock('../../services/cloudinary.service', () => ({
  uploadBuffer:          vi.fn().mockResolvedValue({ url: 'https://cloudinary.com/test.jpg', publicId: 'test-id', width: 800, height: 600 }),
  deleteByPublicId:      vi.fn().mockResolvedValue(undefined),
  validateMediaFile:     vi.fn().mockReturnValue(null),
  exerciseFolder:        vi.fn().mockReturnValue('trainer-app/exercises/test'),
  snapshotFolder:        vi.fn().mockReturnValue('trainer-app/snapshots/test'),
  sessionExerciseFolder: vi.fn().mockReturnValue('trainer-app/session-exercises/test'),
}))

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

// ── POST /snapshots/:id/media ─────────────────────────────────────────────────

describe('POST /snapshots/:id/media', () => {
  let app: Awaited<ReturnType<typeof buildSnapshotMediaTestApp>>
  beforeAll(async () => { app = await buildSnapshotMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/v1/snapshots/${TEST_SNAPSHOT_ID}/media` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 when pose query param is missing', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/snapshots/${TEST_SNAPSHOT_ID}/media`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when snapshot does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clientSnapshots.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/snapshots/${TEST_SNAPSHOT_ID}/media?pose=front`,
      headers: { ...authHeader(), 'content-type': 'multipart/form-data; boundary=----boundary' },
      payload: '------boundary\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\nfakedata\r\n------boundary--',
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when client has opted out of progress photos', async () => {
    const { db } = await import('../../db')
    const snapshot = { ...makeClientSnapshot(), client: makeClient({ progressPhotosOptedOut: true }) }
    vi.mocked(db.query.clientSnapshots.findFirst).mockResolvedValueOnce(snapshot as never)

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/snapshots/${TEST_SNAPSHOT_ID}/media?pose=front`,
      headers: { ...authHeader(), 'content-type': 'multipart/form-data; boundary=----boundary' },
      payload: '------boundary\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\nfakedata\r\n------boundary--',
    })
    expect(res.statusCode).toBe(403)
  })
})

// ── PATCH /snapshot-media/:id ─────────────────────────────────────────────────

describe('PATCH /snapshot-media/:id', () => {
  let app: Awaited<ReturnType<typeof buildSnapshotMediaTestApp>>
  beforeAll(async () => { app = await buildSnapshotMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/snapshot-media/${TEST_MEDIA_ID}`, payload: {},
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when media does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.snapshotMedia.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/snapshot-media/${TEST_MEDIA_ID}`,
      headers: authHeader(), payload: { caption: 'Progress check' },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── DELETE /snapshot-media/:id ────────────────────────────────────────────────

describe('DELETE /snapshot-media/:id', () => {
  let app: Awaited<ReturnType<typeof buildSnapshotMediaTestApp>>
  beforeAll(async () => { app = await buildSnapshotMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/snapshot-media/${TEST_MEDIA_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when media does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.snapshotMedia.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/snapshot-media/${TEST_MEDIA_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('deletes an owned photo and returns 204', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.snapshotMedia.findFirst).mockResolvedValueOnce({
      id:                 TEST_MEDIA_ID,
      snapshotId:         TEST_SNAPSHOT_ID,
      cloudinaryPublicId: 'test-public-id',
      snapshot: { client: { trainerId: TEST_TRAINER_ID } },
    } as never)

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/snapshot-media/${TEST_MEDIA_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(204)
  })
})

// ── GET /clients/:clientId/progress-photos ────────────────────────────────────

describe('GET /clients/:clientId/progress-photos', () => {
  let app: Awaited<ReturnType<typeof buildSnapshotMediaTestApp>>
  beforeAll(async () => { app = await buildSnapshotMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/progress-photos`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when client does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/progress-photos`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns empty array when client has no snapshots', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())
    // chain.orderBy returns [] (default) — no snapshots

    const res = await app.inject({
      method: 'GET', url: `/api/v1/clients/${TEST_CLIENT_ID}/progress-photos`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})
