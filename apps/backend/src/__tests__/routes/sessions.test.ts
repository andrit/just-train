// ------------------------------------------------------------
// routes/sessions.test.ts — Session endpoint integration tests
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildSessionTestApp } from '../helpers/buildApp'
import {
  makeClient, makeSession, makeSessionExercise, makeTemplateExercise, makeSet,
  validSessionBody,
  TEST_TRAINER_ID, TEST_SESSION_ID, TEST_UNKNOWN_ID, TEST_EXERCISE_ID,
  TEST_CLIENT_ID, TEST_SESSION_EXERCISE_ID,
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
      clients:  { findFirst: vi.fn().mockResolvedValue(undefined) },
      sessions: { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
      exercises: { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
      sessionExercises: { findFirst: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]) },
      sets:     { findFirst: vi.fn().mockResolvedValue(undefined) },
      templates: { findFirst: vi.fn().mockResolvedValue(undefined) },
      templateExercises: { findMany: vi.fn().mockResolvedValue([]) },
    },
    insert:      vi.fn().mockReturnValue(chain),
    update:      vi.fn().mockReturnValue(chain),
    delete:      vi.fn().mockReturnValue(chain),
    select:      vi.fn().mockReturnValue(chain),
  }
  // A transaction hands the callback the same client surface (insert/update/…),
  // so per-call assertions on db.insert().values see writes made via tx.
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
  return {
    db,
    clients:         {},
    sessions:        {},
    sessionExercises: {},
    sets:            {},
    exercises:       {},
    templates:       {},
    templateExercises: {},
  }
})

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

// ── GET /sessions ─────────────────────────────────────────────────────────────

describe('GET /sessions', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions' })
    expect(res.statusCode).toBe(401)
  })

  it('returns session list for the authenticated trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findMany).mockResolvedValueOnce([makeSession()])

    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions', headers: authHeader() })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json())).toBe(true)
  })

  it('filters by status when query param provided', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findMany).mockResolvedValueOnce([])

    const res = await app.inject({ method: 'GET', url: '/api/v1/sessions?status=planned', headers: authHeader() })
    expect(res.statusCode).toBe(200)
  })
})

// ── GET /sessions/:id ─────────────────────────────────────────────────────────
// Route uses WHERE including trainerId — no result means either non-existent
// or belongs to another trainer. Mock returns undefined to simulate both cases.

describe('GET /sessions/:id', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/sessions/${TEST_SESSION_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 for a session not owned by the authenticated trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 for a non-existent session', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method: 'GET', url: `/api/v1/sessions/${TEST_UNKNOWN_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── POST /sessions ────────────────────────────────────────────────────────────

describe('POST /sessions', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/sessions', payload: validSessionBody })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing required fields', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/sessions', headers: authHeader(),
      payload: { date: '2025-01-15' }, // missing clientId
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates a session for a client', async () => {
    const { db } = await import('../../db')
    const session = makeSession()
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([session])
    // Second returning call — client fetch for response (uses findFirst not insert)
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient()).mockResolvedValueOnce(makeClient())   // ownership + response

    const res = await app.inject({
      method: 'POST', url: '/api/v1/sessions', headers: authHeader(), payload: validSessionBody,
    })
    expect(res.statusCode).toBe(201)
  })

  it('remaps template circuitIds to fresh per-session ids when applying a template', async () => {
    const { db } = await import('../../db')
    const TPL_ID  = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
    const TPL_CID = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'
    const EX_A = 'ffffffff-0000-0000-0000-ffffffffffff'
    const EX_B = 'ffffffff-3333-3333-3333-ffffffffffff'
    const EX_C = 'ffffffff-4444-4444-4444-ffffffffffff'

    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TPL_ID } as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([makeSession()])
    vi.mocked(db.query.templateExercises.findMany).mockResolvedValueOnce([
      makeTemplateExercise({ exerciseId: EX_A, circuitId: TPL_CID, orderIndex: 0 }),
      makeTemplateExercise({ exerciseId: EX_B, circuitId: TPL_CID, orderIndex: 1 }),
      makeTemplateExercise({ exerciseId: EX_C, circuitId: null,    orderIndex: 2 }),
    ] as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, laterality: 'bilateral' },
      { id: EX_B, laterality: 'bilateral' },
      { id: EX_C, laterality: 'bilateral' },
    ] as never)
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient()).mockResolvedValueOnce(makeClient())   // ownership + response

    const res = await app.inject({
      method: 'POST', url: '/api/v1/sessions', headers: authHeader(),
      payload: { ...validSessionBody, templateId: TPL_ID },
    })
    expect(res.statusCode).toBe(201)
    expect(db.transaction).toHaveBeenCalledTimes(1)

    const seValues = appliedRows(db)
    expect(seValues).toHaveLength(3)

    const byEx = Object.fromEntries(seValues.map((v) => [v.exerciseId, v]))
    expect(byEx[EX_A].circuitId).toBeTruthy()
    expect(byEx[EX_A].circuitId).toBe(byEx[EX_B].circuitId)   // members still grouped
    expect(byEx[EX_A].circuitId).not.toBe(TPL_CID)            // fresh, not the template's id
    expect(byEx[EX_C].circuitId).toBeNull()                   // standalone stays null
  })

  it('returns 404 when the template is not found or belongs to another trainer', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())   // client is ours; template is not
    const res = await app.inject({
      method: 'POST', url: '/api/v1/sessions', headers: authHeader(),
      payload: { ...validSessionBody, templateId: 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa' },
    })
    expect(res.statusCode).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()   // no orphan session for a template we cannot see
  })

  it('carries the ramp step and resolves per-side: explicit wins, null inherits laterality', async () => {
    const { db } = await import('../../db')
    const TPL_ID = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
    const UNI = 'ffffffff-0000-0000-0000-ffffffffffff'
    const BI  = 'ffffffff-3333-3333-3333-ffffffffffff'

    vi.mocked(db.query.templates.findFirst).mockResolvedValueOnce({ id: TPL_ID } as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([makeSession()])
    vi.mocked(db.query.templateExercises.findMany).mockResolvedValueOnce([
      makeTemplateExercise({ exerciseId: UNI, orderIndex: 0, trackPerSide: null,  targetWeightStep: 5 }),  // inherit → true
      makeTemplateExercise({ exerciseId: UNI, orderIndex: 1, trackPerSide: false }),                       // explicit "together"
      makeTemplateExercise({ exerciseId: BI,  orderIndex: 2, trackPerSide: null }),                        // inherit → false
    ] as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: UNI, laterality: 'unilateral' },
      { id: BI,  laterality: 'bilateral' },
    ] as never)
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient()).mockResolvedValueOnce(makeClient())   // ownership + response

    const res = await app.inject({
      method: 'POST', url: '/api/v1/sessions', headers: authHeader(),
      payload: { ...validSessionBody, templateId: TPL_ID },
    })
    expect(res.statusCode).toBe(201)

    const rows = appliedRows(db)
    expect(rows.map((r) => r.trackPerSide)).toEqual([true, false, false])
    expect(rows[0].targetWeightStep).toBe(5)
  })
})

// The applied plan goes in as one multi-row insert — the only array-valued .values call.
function appliedRows(db: typeof import('../../db')['db']): any[] {
  const arrays = vi.mocked(db.insert({} as never).values).mock.calls
    .map((c) => c[0] as unknown)
    .filter((v): v is any[] => Array.isArray(v))
  expect(arrays).toHaveLength(1)
  return arrays[0] ?? []
}

// ── PATCH /sessions/:id ───────────────────────────────────────────────────────
// Route uses db.update().where().returning() — no ownership findFirst.
// Default chain.returning returns [] → [updated] = undefined → 404.

describe('PATCH /sessions/:id', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/sessions/${TEST_SESSION_ID}`, payload: { status: 'in_progress' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when session not owned by trainer', async () => {
    // Default chain.returning returns [] → [updated] undefined → 404
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
      payload: { status: 'in_progress' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('updates status for an owned session', async () => {
    const { db } = await import('../../db')
    const session = makeSession()
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning)
      .mockResolvedValueOnce([{ ...session, status: 'in_progress' as const }])
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(makeClient())

    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
      payload: { status: 'in_progress' },
    })
    expect(res.statusCode).toBe(200)
  })
})

// ── DELETE /sessions/:id ──────────────────────────────────────────────────────
// Route uses db.delete().where().returning() — no ownership findFirst.
// Default chain.returning returns [] → [deleted] = undefined → 404.

describe('DELETE /sessions/:id', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth token', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/sessions/${TEST_SESSION_ID}` })
    expect(res.statusCode).toBe(401)
  })

  it('returns 404 when session not owned by trainer', async () => {
    // Default chain.returning returns [] → [deleted] undefined → 404
    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(404)
  })

  it('deletes an owned session', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.delete({} as never).where({} as never).returning).mockResolvedValueOnce([makeSession()])

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/sessions/${TEST_SESSION_ID}`, headers: authHeader(),
    })
    expect(res.statusCode).toBe(204)
  })
})

// ── POST /sessions/:id/exercises — per-side default derivation ──────────────────
// trackPerSide defaults from the exercise's laterality, and an explicit body
// value overrides it. Asserted by inspecting what the route passes to insert().

describe('POST /sessions/:id/exercises — trackPerSide', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  async function addExercise(laterality: 'bilateral' | 'unilateral', body: Record<string, unknown> = {}) {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(makeSession())   // owned session
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce({ workoutType: 'resistance', laterality } as never)
    // returning() echoes a row; the assertion is on what was passed to values()
    vi.mocked(db.insert({} as never).values({} as never).returning)
      .mockResolvedValueOnce([makeSessionExercise({ trackPerSide: laterality === 'unilateral' })])
    return app.inject({
      method:  'POST',
      url:     `/api/v1/sessions/${TEST_SESSION_ID}/exercises`,
      headers: authHeader(),
      payload: { exerciseId: TEST_EXERCISE_ID, orderIndex: 0, ...body },
    })
  }

  it('defaults trackPerSide=true for a unilateral exercise', async () => {
    const { db } = await import('../../db')
    const res = await addExercise('unilateral')
    expect(res.statusCode).toBe(201)
    expect(vi.mocked(db.insert({} as never).values)).toHaveBeenCalledWith(
      expect.objectContaining({ trackPerSide: true }),
    )
  })

  it('defaults trackPerSide=false for a bilateral exercise', async () => {
    const { db } = await import('../../db')
    const res = await addExercise('bilateral')
    expect(res.statusCode).toBe(201)
    expect(vi.mocked(db.insert({} as never).values)).toHaveBeenCalledWith(
      expect.objectContaining({ trackPerSide: false }),
    )
  })

  it('honours an explicit trackPerSide=false even on a unilateral exercise', async () => {
    const { db } = await import('../../db')
    const res = await addExercise('unilateral', { trackPerSide: false })
    expect(res.statusCode).toBe(201)
    expect(vi.mocked(db.insert({} as never).values)).toHaveBeenCalledWith(
      expect.objectContaining({ trackPerSide: false }),
    )
  })
})

// ── POST /sessions/:id/circuits ─────────────────────────────────────────────────
// One shared circuitId across members, rounds → targetSets, single-type guard.

describe('POST /sessions/:id/circuits', () => {
  const EX_A = 'ffffffff-0000-0000-0000-ffffffffffff'
  const EX_B = 'ffffffff-3333-3333-3333-ffffffffffff'

  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  function insertedValues(db: any): any[] | undefined {
    const call = vi.mocked(db.insert({} as never).values).mock.calls.find((c: unknown[]) => Array.isArray(c[0]))
    return call?.[0] as unknown[] as any[] | undefined
  }

  it('stamps one shared circuitId and rounds→targetSets across members', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({ id: TEST_SESSION_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance', laterality: 'bilateral' },
      { id: EX_B, workoutType: 'resistance', laterality: 'unilateral' },
    ] as never)
    vi.mocked(db.query.sessionExercises.findMany).mockResolvedValueOnce([] as never) // startIndex 0
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([
      makeSessionExercise({ exerciseId: EX_A }),
      makeSessionExercise({ exerciseId: EX_B }),
    ])

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/sessions/${TEST_SESSION_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3, targetReps: 10, targetWeight: 40 },
    })
    expect(res.statusCode).toBe(201)

    const values = insertedValues(db)
    expect(values).toHaveLength(2)
    expect(values?.[0].circuitId).toBeTruthy()
    expect(values?.[0].circuitId).toBe(values?.[1].circuitId)      // shared id
    expect(values?.every((v) => v.targetSets === 3)).toBe(true)     // rounds → targetSets
    expect(values?.[0].orderIndex).toBe(0)
    expect(values?.[1].orderIndex).toBe(1)                          // contiguous
    expect(values?.[1].trackPerSide).toBe(true)                    // EX_B is unilateral
  })

  it('applies a shared targetWeightStep to every member', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({ id: TEST_SESSION_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance', laterality: 'bilateral' },
      { id: EX_B, workoutType: 'resistance', laterality: 'bilateral' },
    ] as never)
    vi.mocked(db.query.sessionExercises.findMany).mockResolvedValueOnce([] as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([
      makeSessionExercise({ exerciseId: EX_A }),
      makeSessionExercise({ exerciseId: EX_B }),
    ])

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/sessions/${TEST_SESSION_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3, targetWeight: 40, targetWeightStep: 50 },
    })
    expect(res.statusCode).toBe(201)

    const values = insertedValues(db)
    expect(values?.every((v) => v.targetWeightStep === 50)).toBe(true)
  })

  it('defaults targetWeightStep to null when omitted', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({ id: TEST_SESSION_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance', laterality: 'bilateral' },
      { id: EX_B, workoutType: 'resistance', laterality: 'bilateral' },
    ] as never)
    vi.mocked(db.query.sessionExercises.findMany).mockResolvedValueOnce([] as never)
    vi.mocked(db.insert({} as never).values({} as never).returning).mockResolvedValueOnce([
      makeSessionExercise({ exerciseId: EX_A }),
      makeSessionExercise({ exerciseId: EX_B }),
    ])

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/sessions/${TEST_SESSION_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3 },
    })
    expect(res.statusCode).toBe(201)

    const values = insertedValues(db)
    expect(values?.every((v) => v.targetWeightStep === null)).toBe(true)
  })

  it('rejects a circuit whose exercises span workout types', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({ id: TEST_SESSION_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance', laterality: 'bilateral' },
      { id: EX_B, workoutType: 'cardio',     laterality: 'bilateral' },
    ] as never)

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/sessions/${TEST_SESSION_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects when an exercise is missing', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce({ id: TEST_SESSION_ID } as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([
      { id: EX_A, workoutType: 'resistance', laterality: 'bilateral' },
    ] as never) // only 1 of 2 found

    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/sessions/${TEST_SESSION_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when the session is not the trainer\'s', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({
      method:  'POST',
      url:     `/api/v1/sessions/${TEST_SESSION_ID}/circuits`,
      headers: authHeader(),
      payload: { exerciseIds: [EX_A, EX_B], rounds: 3 },
    })
    expect(res.statusCode).toBe(404)
  })
})

// ── Ownership — the session tree (Phase 19 security gate) ─────────────────────
// Session-exercises and sets have no trainer_id; they belong to whoever owns the
// session. Before this audit, seven routes mutated by bare id. Each case below
// seeds a row owned by ANOTHER trainer and proves the caller gets 404 with no
// write. The mocked db cannot evaluate WHERE clauses, so these tests prove the
// route *resolves ownership before writing*; the SQL-level proof is the
// real-database matrix (Phase 19 item 5b).

const OTHER_TRAINER = '99999999-9999-9999-9999-999999999999'

function seOwnedBy(trainerId: string, overrides: Partial<ReturnType<typeof makeSessionExercise>> = {}) {
  return { ...makeSessionExercise(overrides), session: { id: TEST_SESSION_ID, trainerId, clientId: TEST_CLIENT_ID } }
}
function setOwnedBy(trainerId: string) {
  return { ...makeSet(), sessionExercise: { ...makeSessionExercise(), session: { trainerId } } }
}

describe('Ownership — session tree', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('POST /sessions/:id/exercises → 404 for another trainer\'s session, nothing inserted', async () => {
    const { db } = await import('../../db')
    // ownedSession() scopes by trainer in its WHERE; the mock models "no row for this trainer".
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({ method: 'POST', url: `/api/v1/sessions/${TEST_SESSION_ID}/exercises`,
      headers: authHeader(), payload: { exerciseId: TEST_EXERCISE_ID, orderIndex: 0 } })
    expect(res.statusCode).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('PATCH /session-exercises/:id → 404 when its session belongs to another trainer, no update', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(seOwnedBy(OTHER_TRAINER) as never)
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}`,
      headers: authHeader(), payload: { trackPerSide: true } })
    expect(res.statusCode).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('DELETE /session-exercises/:id → 404 when its session belongs to another trainer, no delete', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(seOwnedBy(OTHER_TRAINER) as never)
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}`, headers: authHeader() })
    expect(res.statusCode).toBe(404)
    expect(db.delete).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('POST /session-exercises/:id/sets → 404 when its session belongs to another trainer, no insert', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(seOwnedBy(OTHER_TRAINER) as never)
    const res = await app.inject({ method: 'POST', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}/sets`,
      headers: authHeader(), payload: { setNumber: 1, reps: 10, weight: 100 } })
    expect(res.statusCode).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('POST /session-exercises/:id/sets → 404 when the session-exercise does not exist (previously inserted anyway)', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(undefined)
    const res = await app.inject({ method: 'POST', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}/sets`,
      headers: authHeader(), payload: { setNumber: 1, reps: 10, weight: 100 } })
    expect(res.statusCode).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('PATCH /sets/:id → 404 when the set\'s session belongs to another trainer, no update', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sets.findFirst).mockResolvedValueOnce(setOwnedBy(OTHER_TRAINER) as never)
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/sets/${makeSet().id}`, headers: authHeader(), payload: { reps: 12 } })
    expect(res.statusCode).toBe(404)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('DELETE /sets/:id → 404 when the set\'s session belongs to another trainer, no delete', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sets.findFirst).mockResolvedValueOnce(setOwnedBy(OTHER_TRAINER) as never)
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/sets/${makeSet().id}`, headers: authHeader() })
    expect(res.statusCode).toBe(404)
    expect(db.delete).not.toHaveBeenCalled()
  })

  it('PATCH /sets/:id → proceeds for the owner', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sets.findFirst).mockResolvedValueOnce(setOwnedBy(TEST_TRAINER_ID) as never)
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning).mockResolvedValueOnce([makeSet({ reps: 12 })])
    vi.mocked(db.update).mockClear()   // the setup line above counts as a call
    const res = await app.inject({ method: 'PATCH', url: `/api/v1/sets/${makeSet().id}`, headers: authHeader(), payload: { reps: 12 } })
    expect(res.statusCode).toBe(200)
    expect(db.update).toHaveBeenCalledTimes(1)
  })
})

// ── Body-supplied foreign keys (Phase 19 body-id sweep) ───────────────────────

describe('Ownership — ids in the request body', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('POST /sessions → 404 when body.clientId is not the caller\'s client, no session written', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.clients.findFirst).mockResolvedValueOnce(undefined)   // ownedClient: no row for this trainer
    const res = await app.inject({ method: 'POST', url: '/api/v1/sessions', headers: authHeader(), payload: validSessionBody })
    expect(res.statusCode).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('POST /sessions/:id/exercises → 404 when the exercise is another trainer\'s private one, no insert', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessions.findFirst).mockResolvedValueOnce(makeSession())
    vi.mocked(db.query.exercises.findFirst).mockResolvedValueOnce(undefined)   // visibleExercise: filtered out by the WHERE
    const res = await app.inject({ method: 'POST', url: `/api/v1/sessions/${TEST_SESSION_ID}/exercises`,
      headers: authHeader(), payload: { exerciseId: TEST_EXERCISE_ID, orderIndex: 0 } })
    expect(res.statusCode).toBe(404)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

// ── Circuit auto-ungroup on member delete ─────────────────────────────────────

describe('DELETE /session-exercises/:id — circuit auto-ungroup', () => {
  let app: Awaited<ReturnType<typeof buildSessionTestApp>>
  beforeAll(async () => { app = await buildSessionTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  const CID = 'cccccccc-0000-0000-0000-cccccccccccc'

  it('demotes the lone survivor when a 2-member circuit loses a member', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(seOwnedBy(TEST_TRAINER_ID, { circuitId: CID }) as never)
    vi.mocked(db.query.sessionExercises.findMany).mockResolvedValueOnce([{ id: 'survivor' }] as never)   // after delete: one left
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}`, headers: authHeader() })
    expect(res.statusCode).toBe(204)
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.delete).toHaveBeenCalledTimes(1)
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.update({} as never).set).mock.calls[0]?.[0]).toEqual({ circuitId: null })
  })

  it('leaves a 3-member circuit intact when one member is removed', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(seOwnedBy(TEST_TRAINER_ID, { circuitId: CID }) as never)
    vi.mocked(db.query.sessionExercises.findMany).mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }] as never)
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}`, headers: authHeader() })
    expect(res.statusCode).toBe(204)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('does not touch circuits when a standalone exercise is removed', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.sessionExercises.findFirst).mockResolvedValueOnce(seOwnedBy(TEST_TRAINER_ID, { circuitId: null }) as never)
    const res = await app.inject({ method: 'DELETE', url: `/api/v1/session-exercises/${TEST_SESSION_EXERCISE_ID}`, headers: authHeader() })
    expect(res.statusCode).toBe(204)
    expect(db.query.sessionExercises.findMany).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
  })
})
