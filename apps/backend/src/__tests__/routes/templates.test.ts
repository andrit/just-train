// ------------------------------------------------------------
// routes/templates.test.ts — Template endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildTemplateTestApp } from '../helpers/buildApp'
import {
  makeTemplate,
  makeTemplateExercise,
  makeSession,
  makeSessionExercise,
  validTemplateBody,
  TEST_TRAINER_ID, TEST_TEMPLATE_ID, TEST_TEMPLATE_EXERCISE_ID, TEST_EXERCISE_ID, TEST_SESSION_ID,
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
  const db: Record<string, unknown> = {
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
        findMany:  vi.fn().mockResolvedValue([]),
      },
      sessions: {
        findFirst: vi.fn().mockResolvedValue(undefined),
      },
    },
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
    select: vi.fn().mockReturnValue(chain),
  }
  // A transaction hands the callback the same client surface (insert/update/…),
  // so the per-call assertions on db.insert().values see the writes made via tx.
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
  return {
    db,
    templates:         {},
    templateExercises: {},
    exercises:         {},
    sessions:          {},
    sessionExercises:  {},
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

  it('remaps circuitId on forked exercises (fresh, shared, distinct from source)', async () => {
    const { db } = await import('../../db')
    const SRC_CID = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa'
    const source = {
      ...makeTemplate(),
      templateExercises: [
        makeTemplateExercise({ id: 'e1', exerciseId: TEST_EXERCISE_ID, circuitId: SRC_CID, orderIndex: 0 }),
        makeTemplateExercise({ id: 'e2', exerciseId: TEST_EXERCISE_ID, circuitId: SRC_CID, orderIndex: 1 }),
      ],
    }
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(source as never)
    vi.mocked(db.insert({} as never).values({} as never).returning)
      .mockResolvedValueOnce([{ id: 'ffffffff-1111-1111-1111-111111111111', trainerId: TEST_TRAINER_ID, name: 'copy', type: 'session', description: null, notes: null, createdAt: new Date(), updatedAt: new Date() }])
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ ...makeTemplate(), templateExercises: [] } as never)

    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/fork`,
      headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(201)

    // The exercises go in as one multi-row insert (the only array-valued .values call).
    const arrays = vi.mocked(db.insert({} as never).values).mock.calls
      .map((c) => c[0] as unknown)
      .filter((v): v is any[] => Array.isArray(v))
    expect(arrays).toHaveLength(1)
    const exValues = arrays[0] ?? []
    expect(exValues).toHaveLength(2)
    expect(exValues[0].templateId).toBe('ffffffff-1111-1111-1111-111111111111')
    expect(exValues[0].circuitId).toBeTruthy()
    expect(exValues[0].circuitId).toBe(exValues[1].circuitId)   // shared within the circuit
    expect(exValues[0].circuitId).not.toBe(SRC_CID)             // fresh, not the source's
  })

  it('writes the header and the rows inside one transaction', async () => {
    const { db } = await import('../../db')
    const source = { ...makeTemplate(), templateExercises: [makeTemplateExercise()] }
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(source as never)
    vi.mocked(db.insert({} as never).values({} as never).returning)
      .mockResolvedValueOnce([{ id: 'ffffffff-1111-1111-1111-111111111111', trainerId: TEST_TRAINER_ID, name: 'copy', type: 'session', description: null, notes: null, createdAt: new Date(), updatedAt: new Date() }])
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ ...makeTemplate(), templateExercises: [] } as never)
    vi.mocked(db.insert).mockClear()   // the mock setup above called db.insert once; count only the route's calls

    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/fork`,
      headers: authHeader(), payload: {},
    })
    expect(res.statusCode).toBe(201)
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.insert).toHaveBeenCalledTimes(2)   // header + one multi-row insert
  })
})

// ── POST /templates/:id/circuits ──────────────────────────────────────────────

describe('POST /templates/:id/circuits', () => {
  const EX_A = 'ffffffff-0000-0000-0000-ffffffffffff'
  const EX_B = 'ffffffff-3333-3333-3333-ffffffffffff'
  // Returned-row ids must be real UUIDs: the 201 body is validated against
  // TemplateExerciseResponseSchema, whose `id` is z.string().uuid(). A short stub
  // id fails serialization and surfaces as a 500, not as a validation message.
  const TE_A = 'eeeeeeee-1111-1111-1111-eeeeeeeeeeee'
  const TE_B = 'eeeeeeee-2222-2222-2222-eeeeeeeeeeee'

  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  function insertedValues(db: any): any[] | undefined {
    const call = vi.mocked(db.insert({} as never).values).mock.calls.find((c: unknown[]) => Array.isArray(c[0]))
    return call?.[0] as unknown[] as any[] | undefined
  }

  // The payload must satisfy the body schema even though this asserts on auth:
  // Fastify validates the body *before* the authenticate preHandler runs, so an
  // empty {} returns 400 for the missing exerciseIds/rounds and the auth path is
  // never reached. Every other 401 test in this file sends a schema-valid body for
  // the same reason.
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/v1/templates/${TEST_TEMPLATE_ID}/circuits`,
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('stamps one shared circuitId and rounds→targetSets across members', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TEST_TEMPLATE_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance' },
      { id: EX_B, workoutType: 'resistance' },
    ] as never)
    vi.mocked(db.query.templateExercises.findMany).mockResolvedValueOnce([] as never) // startIndex 0
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([
      makeTemplateExercise({ id: TE_A, exerciseId: EX_A }),
      makeTemplateExercise({ id: TE_B, exerciseId: EX_B }),
    ])

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/templates/${TEST_TEMPLATE_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 4, targetReps: 10, targetWeight: 40 },
    })
    expect(res.statusCode).toBe(201)

    const values = insertedValues(db)
    expect(values).toHaveLength(2)
    expect(values?.[0].circuitId).toBeTruthy()
    expect(values?.[0].circuitId).toBe(values?.[1].circuitId)   // shared id
    expect(values?.every((v) => v.targetSets === 4)).toBe(true) // rounds → targetSets
    expect(values?.[0].orderIndex).toBe(0)
    expect(values?.[1].orderIndex).toBe(1)                      // contiguous
  })

  it('rejects a circuit whose exercises span workout types', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TEST_TEMPLATE_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance' },
      { id: EX_B, workoutType: 'cardio' },
    ] as never)

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/templates/${TEST_TEMPLATE_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('appends after existing exercises using max(orderIndex)+1', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TEST_TEMPLATE_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance' },
      { id: EX_B, workoutType: 'resistance' },
    ] as never)
    // Existing rows with a gap (count 2, but max index 5) — append must start at 6.
    vi.mocked(db.query.templateExercises.findMany).mockResolvedValueOnce([
      { orderIndex: 0 }, { orderIndex: 5 },
    ] as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([
      makeTemplateExercise({ id: TE_A, exerciseId: EX_A }),
      makeTemplateExercise({ id: TE_B, exerciseId: EX_B }),
    ])

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/templates/${TEST_TEMPLATE_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3 },
    })
    expect(res.statusCode).toBe(201)

    const values = insertedValues(db)
    expect(values?.[0].orderIndex).toBe(6)
    expect(values?.[1].orderIndex).toBe(7)
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

// ── POST /templates/from-session ──────────────────────────────────────────────
// Save a session's plan as a template. Deep-copies every planning field
// (including the ramp step and per-side mode), remaps circuits, and writes
// header + rows in one transaction.

describe('POST /templates/from-session', () => {
  let app: Awaited<ReturnType<typeof buildTemplateTestApp>>
  beforeAll(async () => { app = await buildTemplateTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  const NEW_TEMPLATE_ID = 'ffffffff-2222-2222-2222-222222222222'
  const url = '/api/v1/templates/from-session'
  const payload = { sessionId: TEST_SESSION_ID, name: 'Leg Day' }

  function newTemplateRow() {
    return { id: NEW_TEMPLATE_ID, trainerId: TEST_TRAINER_ID, name: 'Leg Day', type: 'session', description: null, notes: null, createdAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01') }
  }
  function newTemplateDetail() {
    return { ...newTemplateRow(), createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', templateExercises: [] }
  }
  // Collect the row array passed to the exercises insert (the only array-valued .values call).
  async function insertedRows(): Promise<any[]> {
    const { db } = await import('../../db')
    const arrays = vi.mocked(db.insert({} as never).values).mock.calls
      .map((c) => c[0] as unknown)
      .filter((v): v is any[] => Array.isArray(v))
    expect(arrays).toHaveLength(1)
    return arrays[0] ?? []
  }

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url, payload })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for a missing name', async () => {
    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload: { sessionId: TEST_SESSION_ID } })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when the session is not found or not owned by the trainer', async () => {
    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload })
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 for a session with no exercises (never creates an empty template)', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({ ...makeSession(), sessionExercises: [] } as never)

    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload })
    expect(res.statusCode).toBe(400)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('copies every planning field into the new template and returns 201', async () => {
    const { db } = await import('../../db')
    const source = {
      ...makeSession(),
      sessionExercises: [
        makeSessionExercise({ id: 's1', orderIndex: 0, targetSets: 4, targetReps: 6, targetRepsPerSet: '8,6,4,4', targetWeight: 100, targetWeightStep: 10, targetWeightUnit: 'kg', notes: 'pause', trackPerSide: true }),
        makeSessionExercise({ id: 's2', orderIndex: 1, workoutType: 'cardio', targetSets: null, targetReps: null, targetWeight: null, targetDurationSeconds: 600, targetDistance: 2, targetIntensity: 'high' }),
      ],
    }
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(source as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([newTemplateRow()])
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(newTemplateDetail() as never)

    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toHaveProperty('id', NEW_TEMPLATE_ID)
    expect(db.transaction).toHaveBeenCalledTimes(1)

    const rows = await insertedRows()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      templateId: NEW_TEMPLATE_ID, exerciseId: TEST_EXERCISE_ID, workoutType: 'resistance', orderIndex: 0, circuitId: null,
      targetSets: 4, targetReps: 6, targetRepsPerSet: '8,6,4,4', targetWeight: 100, targetWeightStep: 10, targetWeightUnit: 'kg',
      notes: 'pause', trackPerSide: true,
    })
    expect(rows[1]).toMatchObject({
      templateId: NEW_TEMPLATE_ID, workoutType: 'cardio', orderIndex: 1,
      targetDurationSeconds: 600, targetDistance: 2, targetIntensity: 'high', trackPerSide: false,
    })
    // Nothing session-specific leaks into a plan row.
    expect(rows[0]).not.toHaveProperty('sessionId')
    expect(rows[0]).not.toHaveProperty('id')
  })

  it('remaps circuitId (fresh, shared within the circuit, distinct from the source)', async () => {
    const { db } = await import('../../db')
    const SRC_CID = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa'
    const source = {
      ...makeSession(),
      sessionExercises: [
        makeSessionExercise({ id: 's1', orderIndex: 0, circuitId: SRC_CID }),
        makeSessionExercise({ id: 's2', orderIndex: 1, circuitId: SRC_CID }),
        makeSessionExercise({ id: 's3', orderIndex: 2, circuitId: null }),
      ],
    }
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(source as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([newTemplateRow()])
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(newTemplateDetail() as never)

    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload })
    expect(res.statusCode).toBe(201)

    const rows = await insertedRows()
    expect(rows[0].circuitId).toBeTruthy()
    expect(rows[0].circuitId).toBe(rows[1].circuitId)
    expect(rows[0].circuitId).not.toBe(SRC_CID)
    expect(rows[2].circuitId).toBeNull()
  })

  it('uses the session name as the template description hint only when supplied', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({ ...makeSession(), sessionExercises: [makeSessionExercise()] } as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([newTemplateRow()])
    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce(newTemplateDetail() as never)

    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload: { ...payload, description: 'From Monday' } })
    expect(res.statusCode).toBe(201)
    const header = vi.mocked(db.insert({} as never).values).mock.calls
      .map((c) => c[0] as any)
      .find((v) => v && !Array.isArray(v) && v.name)
    expect(header).toMatchObject({ trainerId: TEST_TRAINER_ID, name: 'Leg Day', type: 'session', description: 'From Monday' })
  })
})
