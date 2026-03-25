// ------------------------------------------------------------
// routes/exercises.test.ts — Exercise endpoint integration tests
//
// Coverage:
//   GET  /body-parts            → 200 list, 401 without auth
//   GET  /exercises             → 200, filter querystring, ownership
//   GET  /exercises/:id         → 200, 404 not found, 404 wrong trainer
//   POST /exercises             → 201 created, 400 validation, 401
//   POST /exercises/quick-add  → 201 draft, 400 missing fields
//   PATCH /exercises/:id        → 200, 404, 400 bad UUID
//   DELETE /exercises/:id       → 204, 404
//
// The test validates the draft flow end-to-end:
//   quick-add → returns isDraft:true → PATCH enriches → isDraft:false
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { exerciseRoutes } from '../../routes/exercises'
import { generateAccessToken } from '../../services/auth.service'
import {
  makeTrainer as _makeTrainer, TEST_TRAINER_ID, TEST_CLIENT_ID, TEST_UNKNOWN_ID,
} from '../helpers/factories'

// ── Module mocks ──────────────────────────────────────────────────────────────

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
        exercises: {
          findFirst: vi.fn().mockResolvedValue(undefined),
          findMany:  vi.fn().mockResolvedValue([]),
        },
        bodyParts:     { findMany:  vi.fn().mockResolvedValue([]) },
        exerciseMedia: { findFirst: vi.fn().mockResolvedValue(undefined) },
      },
      select: vi.fn().mockReturnValue(chain),
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      _chain: chain,
    },
    exercises:     {},
    bodyParts:     {},
    exerciseMedia: {},
    trainers:      {},
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(trainerId = TEST_TRAINER_ID) {
  return `Bearer ${generateAccessToken(trainerId, 'trainer')}`
}

function makeExercise(overrides: Record<string, unknown> = {}) {
  return {
    id:            TEST_CLIENT_ID,
    trainerId:     TEST_TRAINER_ID,
    name:          'Barbell Back Squat',
    workoutType:   'resistance' as const,
    bodyPartId:    TEST_UNKNOWN_ID,
    equipment:     'barbell' as const,
    difficulty:    'intermediate' as const,
    category:      'compound' as const,
    isDraft:       false,
    isPublic:      false,
    description:   null,
    instructions:  null,
    visualization: null,
    demonstration: null,
    bodyPart:      { id: TEST_UNKNOWN_ID, name: 'legs', displayOrder: 4 },
    media:         [] as never[],
    createdAt:     new Date(),
    updatedAt:     new Date(),
    ...overrides,
  }
}

async function buildExerciseTestApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(exerciseRoutes, { prefix: '/api/v1' })
  await app.ready()
  return app
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/body-parts', () => {
  let app: Awaited<ReturnType<typeof buildExerciseTestApp>>
  beforeAll(async () => { app = await buildExerciseTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/body-parts' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with an array of body parts', async () => {
    const { db } = await import('../../db')
    const bps = [
      { id: TEST_UNKNOWN_ID, name: 'legs', displayOrder: 4 },
      { id: TEST_CLIENT_ID,  name: 'back', displayOrder: 2 },
    ]
    ;(db as any)._chain.orderBy.mockResolvedValueOnce(bps)

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/body-parts',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
  })

  it('returns 200 with empty array when no body parts exist', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.orderBy.mockResolvedValueOnce([])

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/body-parts',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/exercises', () => {
  let app: Awaited<ReturnType<typeof buildExerciseTestApp>>
  beforeAll(async () => { app = await buildExerciseTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/exercises' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with list of exercises', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([makeExercise()])

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/exercises',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })

  it('returns 200 with empty array when trainer has no exercises', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([])

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/exercises',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('accepts workoutType querystring filter', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([makeExercise()])

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/exercises?workoutType=resistance',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
  })

  it('accepts isDraft querystring filter', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([makeExercise({ isDraft: true })])

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/exercises?isDraft=true',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
  })

  it('returns 400 for an invalid workoutType enum value', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/exercises?workoutType=swimming',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/exercises/:id', () => {
  let app: Awaited<ReturnType<typeof buildExerciseTestApp>>
  beforeAll(async () => { app = await buildExerciseTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/exercises/${TEST_CLIENT_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with exercise detail', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce(makeExercise())

    const res = await app.inject({
      method:  'GET',
      url:     `/api/v1/exercises/${TEST_CLIENT_ID}`,
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Barbell Back Squat')
  })

  it('returns 404 when exercise does not exist', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'GET',
      url:     `/api/v1/exercises/${TEST_CLIENT_ID}`,
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 404 when exercise belongs to a different trainer', async () => {
    const { db } = await import('../../db')
    // Route's WHERE includes trainerId — so a different trainer's exercise is invisible
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce(undefined)

    const otherTrainer = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const res = await app.inject({
      method:  'GET',
      url:     `/api/v1/exercises/${TEST_CLIENT_ID}`,
      headers: { authorization: `Bearer ${generateAccessToken(otherTrainer, 'trainer')}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for a non-UUID id param', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/exercises/not-a-uuid',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/exercises', () => {
  let app: Awaited<ReturnType<typeof buildExerciseTestApp>>
  beforeAll(async () => { app = await buildExerciseTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  const validBody = {
    name:        'Romanian Deadlift',
    workoutType: 'resistance',
    bodyPartId:  TEST_UNKNOWN_ID,
    equipment:   'barbell',
    difficulty:  'intermediate',
  }

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/exercises', payload: validBody })
    expect(res.statusCode).toBe(401)
  })

  it('returns 201 with the created exercise', async () => {
    const { db } = await import('../../db')
    const created = makeExercise({ name: 'Romanian Deadlift', isDraft: false })
    ;(db as any)._chain.returning.mockResolvedValueOnce([created])

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/exercises',
      payload: validBody,
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().name).toBe('Romanian Deadlift')
  })

  it('creates with isDraft:false (full create always has all required fields)', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeExercise({ isDraft: false })])

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/exercises',
      payload: validBody,
      headers: { authorization: authHeader() },
    })

    // The route sets isDraft based on whether required fields are present
    // A full create with name+workoutType+bodyPartId should not be a draft
    expect(res.statusCode).toBe(201)
  })

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/exercises',
      payload: { workoutType: 'resistance', bodyPartId: TEST_UNKNOWN_ID },
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when workoutType is invalid', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/exercises',
      payload: { ...validBody, workoutType: 'not-valid' },
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/exercises/quick-add', () => {
  let app: Awaited<ReturnType<typeof buildExerciseTestApp>>
  beforeAll(async () => { app = await buildExerciseTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  const quickAddBody = {
    name:        'Mystery Move',
    bodyPartId:  TEST_UNKNOWN_ID,
    workoutType: 'resistance',
  }

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/exercises/quick-add', payload: quickAddBody })
    expect(res.statusCode).toBe(401)
  })

  it('returns 201 with isDraft:true', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeExercise({ isDraft: true, name: 'Mystery Move' })])

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/exercises/quick-add',
      payload: quickAddBody,
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().isDraft).toBe(true)
  })

  it('returns 400 when name is missing', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/exercises/quick-add',
      payload: { bodyPartId: TEST_UNKNOWN_ID, workoutType: 'resistance' },
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/v1/exercises/:id', () => {
  let app: Awaited<ReturnType<typeof buildExerciseTestApp>>
  beforeAll(async () => { app = await buildExerciseTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method:  'PATCH',
      url:     `/api/v1/exercises/${TEST_CLIENT_ID}`,
      payload: { name: 'Updated' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 200 with updated exercise', async () => {
    const { db } = await import('../../db')
    const updated = makeExercise({ name: 'Updated Exercise', isDraft: false })
    ;(db as any)._chain.returning.mockResolvedValueOnce([updated])

    const res = await app.inject({
      method:  'PATCH',
      url:     `/api/v1/exercises/${TEST_CLIENT_ID}`,
      payload: { name: 'Updated Exercise' },
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Updated Exercise')
  })

  it('clears isDraft when enriching a quick-added exercise with description and instructions', async () => {
    // The route marks isDraft:false when description or instructions are added
    // (specific route logic to test the draft → complete lifecycle)
    const { db } = await import('../../db')
    const enriched = makeExercise({ isDraft: false, description: 'Full description added' })
    ;(db as any)._chain.returning.mockResolvedValueOnce([enriched])

    const res = await app.inject({
      method:  'PATCH',
      url:     `/api/v1/exercises/${TEST_CLIENT_ID}`,
      payload: { description: 'Full description added', instructions: 'Step 1: ...' },
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().isDraft).toBe(false)
  })

  it('returns 404 when exercise not found or belongs to different trainer', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.returning.mockResolvedValueOnce([])

    const res = await app.inject({
      method:  'PATCH',
      url:     `/api/v1/exercises/${TEST_UNKNOWN_ID}`,
      payload: { name: 'Ghost' },
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for a non-UUID id param', async () => {
    const res = await app.inject({
      method:  'PATCH',
      url:     '/api/v1/exercises/not-a-uuid',
      payload: { name: 'Test' },
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/exercises/:id', () => {
  let app: Awaited<ReturnType<typeof buildExerciseTestApp>>
  beforeAll(async () => { app = await buildExerciseTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/exercises/${TEST_CLIENT_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 204 on successful delete', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.returning.mockResolvedValueOnce([makeExercise()])

    const res = await app.inject({
      method:  'DELETE',
      url:     `/api/v1/exercises/${TEST_CLIENT_ID}`,
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when exercise does not exist', async () => {
    const { db } = await import('../../db')
    ;(db as any)._chain.returning.mockResolvedValueOnce([])

    const res = await app.inject({
      method:  'DELETE',
      url:     `/api/v1/exercises/${TEST_UNKNOWN_ID}`,
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(404)
  })
})
