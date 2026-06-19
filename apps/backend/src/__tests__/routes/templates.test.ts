// ------------------------------------------------------------
// routes/templates.test.ts — Template endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildTemplateTestApp } from '../helpers/buildApp'
import {
  makeTemplate, makeTemplateExercise,
  validTemplateBody,
  TEST_TRAINER_ID, TEST_TEMPLATE_ID, TEST_TEMPLATE_EXERCISE_ID, TEST_EXERCISE_ID,
} from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

vi.mock('../../db', () => {
  const chain = {
    values:    vi.fn().mockReturnThis(),
    set:       vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    where:     vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockResolvedValue([]),
    limit:     vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  }
  return {
    db: {
      query: {
        templates: {
          findFirst: vi.fn().mockResolvedValue(undefined),
          findMany:  vi.fn().mockResolvedValue([]),
        },
        templateExercises: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        exercises: {
          findFirst: vi.fn().mockResolvedValue(undefined),
        },
      },
      insert: vi.fn().mockReturnValue(chain),
      update: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockReturnValue(chain),
      select: vi.fn().mockReturnValue(chain),
    },
    templates:         {},
    templateExercises: {},
    exercises:         {},
  }
})

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

// ── GET /templates ────────────────────────────────────────────────────────────

describe('GET /templates', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/templates' })
    expect(res.statusCode).toBe(401)
  })

  it('returns empty list when trainer has no templates', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/templates', headers: authHeader() })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns template list for the authenticated trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findMany).mockResolvedValueOnce([makeTemplate()])

    const res = await app.inject({ method: 'GET', url: '/api/v1/templates', headers: authHeader() })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
    expect(res.json()).toHaveLength(1)
  })

  it('returns empty list when search matches nothing', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/templates?search=nonexistent', headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })
})

// ── GET /templates/:id ────────────────────────────────────────────────────────

describe('GET /templates/:id', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/templates/${TEST_TEMPLATE_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when template does not exist or belongs to another trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/templates/${TEST_TEMPLATE_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns template detail for an owned template', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({
      ...makeTemplate(),
      templateExercises: [],
    } as never)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/templates/${TEST_TEMPLATE_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('id', TEST_TEMPLATE_ID)
  })
})

// ── POST /templates ───────────────────────────────────────────────────────────

describe('POST /templates', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/templates', payload: validTemplateBody })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/templates', headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates a template and returns 201', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([makeTemplate()])

    const res = await app.inject({
      method: 'POST', url: '/api/v1/templates', headers: authHeader(), payload: validTemplateBody,
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toHaveProperty('id', TEST_TEMPLATE_ID)
  })
})

// ── PATCH /templates/:id ──────────────────────────────────────────────────────

describe('PATCH /templates/:id', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/templates/${TEST_TEMPLATE_ID}`, payload: {},
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when template not owned by trainer', async () => {
    // Default chain.returning returns [] → [updated] = undefined → 404
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/templates/${TEST_TEMPLATE_ID}`,
      headers: authHeader(), payload: { name: 'Updated Name' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('updates an owned template', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning)
      .mockResolvedValueOnce([makeTemplate({ name: 'Updated Name' })])

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/templates/${TEST_TEMPLATE_ID}`,
      headers: authHeader(), payload: { name: 'Updated Name' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('name', 'Updated Name')
  })
})

// ── DELETE /templates/:id ─────────────────────────────────────────────────────

describe('DELETE /templates/:id', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/templates/${TEST_TEMPLATE_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when template not owned by trainer', async () => {
    // Default chain.returning returns [] → [deleted] = undefined → 404
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/templates/${TEST_TEMPLATE_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('deletes an owned template and returns 204', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.delete({} as never).where({} as never).returning).mockResolvedValueOnce([makeTemplate()])

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/templates/${TEST_TEMPLATE_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(204)
  })
})

// ── POST /templates/:id/fork ──────────────────────────────────────────────────

describe('POST /templates/:id/fork', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/fork`, payload: {} })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when source template does not exist', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/fork`,
      headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(404)
  })

  it('forks a template and returns 201', async () => {
    const { db } = await import('../../db')
    const source = { ...makeTemplate(), templateExercises: [] }
    const forkedDetail = {
      id:               'ffffffff-1111-1111-1111-111111111111',
      trainerId:        TEST_TRAINER_ID,
      name:             'Push Day A (copy)',
      type:             'session',
      description:      null,
      notes:            null,
      createdAt:        '2025-01-01T00:00:00.000Z',
      updatedAt:        '2025-01-01T00:00:00.000Z',
      templateExercises: [],
    }
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(source as never)
    vi.mocked(db.insert({} as never).values({} as never).returning)
      .mockResolvedValueOnce([{ id: 'ffffffff-1111-1111-1111-111111111111', trainerId: TEST_TRAINER_ID, name: 'Push Day A (copy)', type: 'session', description: null, notes: null, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') }])
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(forkedDetail as never)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/fork`,
      headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(201)
  })
})

// ── POST /templates/:id/exercises ─────────────────────────────────────────────

describe('POST /templates/:id/exercises', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/exercises`,
      payload: { exerciseId: TEST_EXERCISE_ID },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when template not owned by trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(undefined)
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce({ workoutType: 'resistance' } as never)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/exercises`,
      headers: authHeader(), payload: { exerciseId: TEST_EXERCISE_ID },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 when exercise does not exist', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TEST_TEMPLATE_ID } as never)
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/exercises`,
      headers: authHeader(), payload: { exerciseId: TEST_EXERCISE_ID },
    })
    expect(res.statusCode).toBe(404)
  })

  it('adds an exercise to a template and returns 201', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TEST_TEMPLATE_ID } as never)
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce({ workoutType: 'resistance' } as never)
    vi.mocked(db.query.templateExercises.findMany).mockResolvedValueOnce([])
    vi.mocked(db.insert({} as never).values({} as never).returning)
      .mockResolvedValueOnce([{ id: TEST_TEMPLATE_EXERCISE_ID }])

    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/exercises`,
      headers: authHeader(), payload: { exerciseId: TEST_EXERCISE_ID },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toHaveProperty('id', TEST_TEMPLATE_EXERCISE_ID)
  })
})

// ── PATCH /templates/:id/exercises/reorder ────────────────────────────────────

describe('PATCH /templates/:id/exercises/reorder', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/exercises/reorder`,
      payload: { orderedIds: [] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 403 when template not owned by trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/exercises/reorder`,
      headers: authHeader(), payload: { orderedIds: [TEST_TEMPLATE_EXERCISE_ID] },
    })
    expect(res.statusCode).toBe(403)
  })

  it('reorders exercises for an owned template and returns 204', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TEST_TEMPLATE_ID } as never)

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/exercises/reorder`,
      headers: authHeader(), payload: { orderedIds: [TEST_TEMPLATE_EXERCISE_ID] },
    })
    expect(res.statusCode).toBe(204)
  })
})

// ── DELETE /template-exercises/:id ───────────────────────────────────────────

describe('DELETE /template-exercises/:id', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/template-exercises/${TEST_TEMPLATE_EXERCISE_ID}`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('removes an exercise and returns 204', async () => {
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/template-exercises/${TEST_TEMPLATE_EXERCISE_ID}`,
      headers: authHeader(),
    })
    expect(res.statusCode).toBe(204)
  })
})
