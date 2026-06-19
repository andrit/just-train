// ------------------------------------------------------------
// routes/session-exercise-media.test.ts — Form check media endpoint tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildSessionExerciseMediaTestApp } from '../helpers/buildApp'
import { TEST_TRAINER_ID, TEST_SESSION_ID } from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

const TEST_SESSION_EXERCISE_ID = 'aaaabbbb-aaaa-bbbb-cccc-aaaaaaaaaaaa'
const TEST_MEDIA_ID             = '77777777-7777-7777-7777-777777777777'

vi.mock('../../db', () => {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockResolvedValue([]),
    orderBy:   vi.fn().mockResolvedValue([]),
    limit:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    db: {
      query: {
        sessions:             { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
        sessionExercises:     { findFirst: vi.fn().mockResolvedValue(undefined) },
        sessionExerciseMedia: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue(chain),
    },
    sessions:             {},
    sessionExercises:     {},
    sessionExerciseMedia: {},
    sets:                 {},
    templateExercises:    {},
    clients:              {},
  }
})

vi.mock('../../services/cloudinary.service', () => ({
  uploadBuffer:          vi.fn().mockResolvedValue({ url: 'https://cloudinary.com/test.mp4', publicId: 'test-id', width: 0, height: 0, mediaType: 'video' }),
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

// ── POST /session-exercises/:id/media ─────────────────────────────────────────

describe('POST /session-exercises/:id/media', () => {
  let app: Awaited<ReturnType<typeof buildSessionExerciseMediaTestApp>>
  beforeAll(async () => { app = await buildSessionExerciseMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}/media`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when session exercise does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}/media`,
      headers: { ...authHeader(), 'content-type': 'multipart/form-data; boundary=----boundary' },
      payload: '------boundary\r\nContent-Disposition: form-data; name="file"; filename="test.mp4"\r\nContent-Type: video/mp4\r\n\r\nfakedata\r\n------boundary--',
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── DELETE /session-exercise-media/:id ───────────────────────────────────────

describe('DELETE /session-exercise-media/:id', () => {
  let app: Awaited<ReturnType<typeof buildSessionExerciseMediaTestApp>>
  beforeAll(async () => { app = await buildSessionExerciseMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/session-exercise-media/${TEST_MEDIA_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when media does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExerciseMedia.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/session-exercise-media/${TEST_MEDIA_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('deletes owned media and returns 204', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExerciseMedia.findFirst).mockResolvedValueOnce({
      id:                 TEST_MEDIA_ID,
      sessionExerciseId:  TEST_SESSION_EXERCISE_ID,
      cloudinaryPublicId: 'test-public-id',
      mediaType:          'video',
      sessionExercise: {
        session: { trainerId: TEST_TRAINER_ID, id: TEST_SESSION_ID, clientId: '22222222-2222-2222-2222-222222222222' },
      },
    } as never)

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/session-exercise-media/${TEST_MEDIA_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(204)
  })
})

// ── GET /session-exercises/:id/media ─────────────────────────────────────────

describe('GET /session-exercises/:id/media', () => {
  let app: Awaited<ReturnType<typeof buildSessionExerciseMediaTestApp>>
  beforeAll(async () => { app = await buildSessionExerciseMediaTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}/media`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when session exercise does not belong to trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}/media`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns empty media list for an owned session exercise', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce({
      id: TEST_SESSION_EXERCISE_ID,
      session: { trainerId: TEST_TRAINER_ID },
    } as never)
    // chain.where returns [] (default for select chain)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}/media`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })
})
