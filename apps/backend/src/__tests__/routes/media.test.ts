// ------------------------------------------------------------
// routes/media.test.ts — Exercise media endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildMediaTestApp } from '../helpers/buildApp'
import { TEST_TRAINER_ID, TEST_UNKNOWN_ID } from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

const TEST_EXERCISE_ID = 'ffffffff-0000-0000-0000-ffffffffffff'
const TEST_MEDIA_ID    = '77777777-7777-7777-7777-777777777777'

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
        exercises:     { findFirst: vi.fn().mockResolvedValue(undefined) },
        exerciseMedia: { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
      },
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue(chain),
    },
    exercises:     {},
    exerciseMedia: {},
  }
})

vi.mock('../../services/cloudinary.service', () => ({
  uploadBuffer:     vi.fn().mockResolvedValue({ url: 'https://cloudinary.com/test.jpg', publicId: 'test-id', width: 800, height: 600 }),
  deleteByPublicId: vi.fn().mockResolvedValue(undefined),
  validateMediaFile:vi.fn().mockReturnValue(null),
  exerciseFolder:   vi.fn().mockReturnValue('trainer-app/exercises/test'),
  snapshotFolder:   vi.fn().mockReturnValue('trainer-app/snapshots/test'),
  sessionExerciseFolder: vi.fn().mockReturnValue('trainer-app/session-exercises/test'),
}))

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

// ── POST /exercises/:id/media ─────────────────────────────────────────────────

describe('POST /exercises/:id/media', () => {
  let app: Awaited<ReturnType<typeof buildMediaTestApp>>
  beforeAll(async () => { app = await buildMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/v1/exercises/${TEST_EXERCISE_ID}/media` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when exercise does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce(undefined)

    // Send a minimal multipart request so auth passes; exercise check happens first
    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/exercises/${TEST_EXERCISE_ID}/media`,
      headers: { ...authHeader(), 'content-type': 'multipart/form-data; boundary=----boundary' },
      payload: '------boundary\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\nfakedata\r\n------boundary--',
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── DELETE /exercises/:id/media/:mediaId ──────────────────────────────────────

describe('DELETE /exercises/:id/media/:mediaId', () => {
  let app: Awaited<ReturnType<typeof buildMediaTestApp>>
  beforeAll(async () => { app = await buildMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/exercises/${TEST_EXERCISE_ID}/media/${TEST_MEDIA_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when media does not exist', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exerciseMedia.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'DELETE',
      url:     `/api/v1/exercises/${TEST_EXERCISE_ID}/media/${TEST_MEDIA_ID}`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('deletes media and returns 204', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exerciseMedia.findFirst).mockResolvedValueOnce({
      id:                 TEST_MEDIA_ID,
      exerciseId:         TEST_EXERCISE_ID,
      cloudinaryPublicId: 'test-public-id',
      mediaType:          'image',
      exercise:           { trainerId: TEST_TRAINER_ID },
    } as never)

    const res = await app.inject({
      method:  'DELETE',
      url:     `/api/v1/exercises/${TEST_EXERCISE_ID}/media/${TEST_MEDIA_ID}`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(204)
  })
})

// ── PATCH /exercises/:id/media/:mediaId/primary ───────────────────────────────

describe('PATCH /exercises/:id/media/:mediaId/primary', () => {
  let app: Awaited<ReturnType<typeof buildMediaTestApp>>
  beforeAll(async () => { app = await buildMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/exercises/${TEST_EXERCISE_ID}/media/${TEST_MEDIA_ID}/primary`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when exercise does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'PATCH',
      url:     `/api/v1/exercises/${TEST_EXERCISE_ID}/media/${TEST_MEDIA_ID}/primary`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('sets a media item as primary and returns 200', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce({ id: TEST_EXERCISE_ID } as never)
    const mediaRecord = {
      id:                 TEST_MEDIA_ID,
      exerciseId:         TEST_EXERCISE_ID,
      cloudinaryUrl:      'https://cloudinary.com/test.jpg',
      cloudinaryPublicId: 'test-public-id',
      mediaType:          'image' as const,
      isPrimary:          true,
      displayOrder:       0,
      createdAt:          new Date('2025-01-01T00:00:00Z'),
    }
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning)
      .mockResolvedValueOnce([mediaRecord])

    const res = await app.inject({
      method:  'PATCH',
      url:     `/api/v1/exercises/${TEST_EXERCISE_ID}/media/${TEST_MEDIA_ID}/primary`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('id', TEST_MEDIA_ID)
  })
})

// ── Unknown exercise ──────────────────────────────────────────────────────────

describe('DELETE with unknown exercise ID', () => {
  let app: Awaited<ReturnType<typeof buildMediaTestApp>>
  beforeAll(async () => { app = await buildMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 404 for unknown media ID', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exerciseMedia.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'DELETE',
      url:     `/api/v1/exercises/${TEST_EXERCISE_ID}/media/${TEST_UNKNOWN_ID}`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })
})
