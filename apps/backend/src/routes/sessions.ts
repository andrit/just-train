import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/sessions.ts — Sessions, SessionExercises, Sets
//
// Routes:
//   GET    /api/v1/sessions                                → list sessions
//   GET    /api/v1/sessions/:id                            → full session tree
//   POST   /api/v1/sessions                                → create session
//   PATCH  /api/v1/sessions/:id                            → update session
//   DELETE /api/v1/sessions/:id                            → discard session
//
//   POST   /api/v1/sessions/:id/exercises                  → add exercise to session
//   DELETE /api/v1/session-exercises/:id                   → remove exercise from session
//   PATCH  /api/v1/sessions/:id/exercises/reorder          → reorder exercises
//
//   POST   /api/v1/session-exercises/:id/sets              → record a set
//   PATCH  /api/v1/sets/:id                                → edit a recorded set
//   DELETE /api/v1/sets/:id                                → delete a set
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { idempotencyPreHandler, idempotencyOnSend } from '../lib/idempotency'
import { db, sessions, sessionExercises, sets, clients, exercises, templates, templateExercises } from '../db'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { createCircuitRemapper, toSessionExerciseRow } from '../lib/exerciseCopy'
import { deriveRecordSetIds, type RecordSetIds } from '../lib/prRecords'
import { updateChallengesForSet, updateChallengesForSessionComplete } from '../services/challenge.service'
import { logSyncWrite } from '../services/syncLog.service'
import {
  CreateSessionSchema,
  UpdateSessionSchema,
  AddSessionExerciseSchema,
  CreateSetSchema,
  SessionListResponseSchema,
  SessionDetailResponseSchema,
  SessionSummaryResponseSchema,
  SessionExerciseResponseSchema,
  SetResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
  SessionStatusEnum,
  UpdateSessionExerciseSchema,
  CreateCircuitSchema,
  sideReps,
} from '@trainer-app/shared'
import { randomUUID } from 'crypto'
import { z } from 'zod'


// Querystring filters for GET /sessions
const SessionFilterSchema = z.object({
  clientId: z.string().uuid().optional()
    .describe('Filter to a specific client'),
  status: SessionStatusEnum.optional()
    .describe('Filter by session status'),
})

// Serialize a session exercise row to match SessionExerciseResponseSchema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSessionExercise(se: any, records?: RecordSetIds): any {
  return {
    ...se,
    exercise: se.exercise ? {
      ...se.exercise,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      media: (se.exercise.media ?? []).map((m: any) => ({
        ...m,
        createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
      })),
    } : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sets: (se.sets ?? []).map((set: any) => ({
      ...set,
      // Derived record chips — only the current record holder is flagged (see lib/prRecords).
      isLoadRecord:   records?.loadIds.has(set.id)   ?? false,
      isVolumeRecord: records?.volumeIds.has(set.id) ?? false,
      createdAt: set.createdAt instanceof Date ? set.createdAt.toISOString() : set.createdAt,
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSession(s: any, records?: RecordSetIds): any {
  return {
    ...s,
    client:           s.client
      ? { id: s.client.id, name: s.client.name, photoUrl: s.client.photoUrl ?? null }
      : null,
    startTime:        s.startTime instanceof Date ? s.startTime.toISOString() : (s.startTime ?? null),
    endTime:          s.endTime   instanceof Date ? s.endTime.toISOString()   : (s.endTime   ?? null),
    createdAt:        s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt:        s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionExercises: (s.sessionExercises ?? []).map((se: any) => serializeSessionExercise(se, records)),
  }
}

// Fetch every resistance set for this client across the given exercises and
// derive which sets currently hold the Load / Volume records. One query, used
// only on the full-session read (detail/history) where per-set chips render.
async function computeSessionRecords(clientId: string, exerciseIds: string[]): Promise<RecordSetIds | undefined> {
  const ids = [...new Set(exerciseIds.filter(Boolean))]
  if (ids.length === 0) return undefined
  // ponytail: scans all of a client's sets for these exercises on each detail
  // read. Fine at per-client volumes. ceiling: thousands of sets/exercise.
  // upgrade: cache per (client, exercise) max rows, or precompute on write.
  const rows = await db
    .select({
      id:         sets.id,
      exerciseId: sessionExercises.exerciseId,
      weight:     sets.weight,
      reps:       sets.reps,
      perSide:    sets.perSide,
      repsLeft:   sets.repsLeft,
      repsRight:  sets.repsRight,
      createdAt:  sets.createdAt,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
    .where(and(eq(sessions.clientId, clientId), inArray(sessionExercises.exerciseId, ids)))
  return deriveRecordSetIds(rows)
}

// ── Template application — read side ───────────────────────────────────────
// template_exercises → session_exercises is flat, ordered by the template's
// orderIndex. The template must belong to the trainer (a template id is not a
// capability) — null means "not found / not yours". Per-side for rows the
// template leaves unspecified (null) is resolved from each exercise's laterality.
interface TemplatePlan {
  rows:          (typeof templateExercises.$inferSelect)[]
  unilateralIds: ReadonlySet<string>
}
const EMPTY_PLAN: TemplatePlan = { rows: [], unilateralIds: new Set() }

async function loadTemplatePlan(templateId: string, trainerId: string): Promise<TemplatePlan | null> {
  const template = await db.query.templates.findFirst({
    where:   and(eq(templates.id, templateId), eq(templates.trainerId, trainerId)),
    columns: { id: true },
  })
  if (!template) return null

  const rows = await db.query.templateExercises.findMany({
    where:   eq(templateExercises.templateId, templateId),
    orderBy: templateExercises.orderIndex,
  })

  // One laterality lookup for the whole plan, not one per row.
  const exIds = [...new Set(rows.map((te) => te.exerciseId))]
  const lateralityRows = exIds.length
    ? await db.query.exercises.findMany({
        where:   inArray(exercises.id, exIds),
        columns: { id: true, laterality: true },
      })
    : []
  const unilateralIds = new Set(
    lateralityRows.filter((e) => e.laterality === 'unilateral').map((e) => e.id),
  )
  return { rows, unilateralIds }
}

// ── Ownership through the aggregate root ────────────────────────────────────
// A session-exercise or a set has no trainer_id of its own; it belongs to
// whoever owns its session. Every route that takes one of their ids resolves
// ownership here first and returns 404 (not 403 — no existence leak) if the
// caller is not that trainer. Found in the Phase 19 ownership audit: seven
// routes mutated by bare id.
async function ownedSession(sessionId: string, trainerId: string) {
  return db.query.sessions.findFirst({
    where:   and(eq(sessions.id, sessionId), eq(sessions.trainerId, trainerId)),
    columns: { id: true, clientId: true },
  })
}

async function ownedSessionExercise(id: string, trainerId: string) {
  const row = await db.query.sessionExercises.findFirst({
    where: eq(sessionExercises.id, id),
    with:  { session: { columns: { id: true, trainerId: true, clientId: true } } },
  })
  return row && row.session.trainerId === trainerId ? row : null
}

async function ownedSet(id: string, trainerId: string) {
  const row = await db.query.sets.findFirst({
    where: eq(sets.id, id),
    with:  { sessionExercise: { with: { session: { columns: { trainerId: true } } } } },
  })
  return row && row.sessionExercise.session.trainerId === trainerId ? row : null
}

// A circuit is a group of ≥2 members. When a member is removed and only one
// remains, the survivor is demoted to a standalone exercise (read views already
// tolerate a lone member; this keeps the data honest instead of relying on that).
async function ungroupIfBelowTwo(
  tx: Pick<typeof db, 'query' | 'update'>,
  circuitId: string | null,
  sessionId: string,
): Promise<void> {
  if (!circuitId) return
  const members = await tx.query.sessionExercises.findMany({
    where:   and(eq(sessionExercises.sessionId, sessionId), eq(sessionExercises.circuitId, circuitId)),
    columns: { id: true },
  })
  if (members.length >= 2) return
  await tx.update(sessionExercises).set({ circuitId: null }).where(eq(sessionExercises.circuitId, circuitId))
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // Idempotent replay of offline-queued writes. Registered AFTER authenticate so
  // request.trainer is available. No-op unless an Idempotency-Key header is present,
  // so GETs and non-offline clients are unaffected. See lib/idempotency.ts.
  app.addHook('preHandler', idempotencyPreHandler)
  app.addHook('onSend',     idempotencyOnSend)

  // ----------------------------------------------------------
  // GET /sessions — List sessions with optional filters
  // ----------------------------------------------------------
  app.get('/sessions', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'List sessions',
      description: 'Returns sessions ordered by date (newest first). Filter by client to show a client\'s session history, or by status to see planned/active sessions.',
      querystring: SessionFilterSchema,
      response: {
        200: SessionListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId, status } = request.query as z.infer<typeof SessionFilterSchema>

    try {
      const conditions = [eq(sessions.trainerId, request.trainer.trainerId)]
      if (clientId) conditions.push(eq(sessions.clientId, clientId))
      if (status)   conditions.push(eq(sessions.status, status as never))

      const result = await db.query.sessions.findMany({
        where: and(...conditions),
        with: { client: true },
        orderBy: desc(sessions.date),
      })

      // List view has no per-set chips, so no record map is computed here.
      return reply.send(result.map((s) => serializeSession(s)))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch sessions' })
    }
  })

  // ----------------------------------------------------------
  // GET /sessions/:id — Full session with all workouts and sets
  //
  // This is the main payload loaded when the trainer opens an
  // active session. Returns the full tree:
  //   Session → Workouts → SessionExercises → Sets
  // ----------------------------------------------------------
  app.get('/sessions/:id', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Get a session',
      description: `Returns the full session tree including all workout blocks, exercises within each block, and all recorded sets.

This is the primary payload for the active workout view — loaded once when the session opens.`,
      params: UuidParamSchema,
      response: {
        200: SessionDetailResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const result = await db.query.sessions.findFirst({
        where: and(
          eq(sessions.id, id),
          eq(sessions.trainerId, request.trainer.trainerId)
        ),
        with: {
          client: true,
          sessionExercises: {
            orderBy: sessionExercises.orderIndex,
            with: {
              exercise: { with: { bodyPart: true, media: true } },
              sets: { orderBy: sets.setNumber },
            },
          },
        },
      })

      if (!result) {
        return reply.status(404).send({ error: 'Session not found' })
      }

      const records = await computeSessionRecords(
        result.clientId,
        (result.sessionExercises ?? []).map((se) => se.exerciseId),
      )
      return reply.send(serializeSession(result, records))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch session' })
    }
  })

  // ----------------------------------------------------------
  // POST /sessions — Create a new session
  // ----------------------------------------------------------
  app.post('/sessions', {
    config: { rateLimit: { max: 100, timeWindow: '1 hour' } },
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Create a session',
      description: `Creates a new training session for a client.

**Two creation modes:**
- **Planned (pre-built):** Provide a \`templateId\` (must belong to you) and the session is pre-populated with the template's exercises and targets. Status starts as \`planned\`.
- **Live (as-you-go):** Omit \`templateId\` and start with an empty session. Add exercises as the training happens.`,
      body: CreateSessionSchema,
      response: {
        201: SessionSummaryResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof CreateSessionSchema>

    try {
      // ── Resolve the template plan first (reads only) ─────────────────────
      const plan = body.templateId
        ? await loadTemplatePlan(body.templateId, request.trainer.trainerId)
        : EMPTY_PLAN
      if (!plan) return reply.status(404).send({ error: 'Template not found' })

      // ── Write session + applied plan as one unit ─────────────────────────
      // A failed row insert must not leave a session that looks planned but is
      // empty. Circuit ids are remapped so each applied session owns its groups.
      const newSession = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(sessions)
          .values({
            ...body,
            templateId: body.templateId ?? null,
            trainerId:  request.trainer.trainerId,
            status:     'planned',
            startTime:  body.startTime ? new Date(body.startTime) : null,
          })
          .returning()
        if (!created) throw new Error('Session insert returned no row')

        if (plan.rows.length) {
          const remap = createCircuitRemapper()
          await tx.insert(sessionExercises).values(
            plan.rows.map((te) => toSessionExerciseRow(te, created.id, remap, plan.unilateralIds)),
          )
        }
        return created
      })
      // ── End template application ─────────────────────────────────────────

      // Fetch the client for the response (schema requires it)
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, newSession.clientId),
        columns: { id: true, name: true, photoUrl: true },
      }).catch(() => null)

      return reply.status(201).send(serializeSession({ ...newSession, client }))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to create session' })
    }
  })

  // ----------------------------------------------------------
  // PATCH /sessions/:id — Update session metadata
  // ----------------------------------------------------------
  app.patch('/sessions/:id', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Update a session',
      description: 'Updates session metadata such as status, start/end times, and notes. Use `status: "in_progress"` when the trainer starts logging, and `status: "completed"` when done.',
      params: UuidParamSchema,
      body: UpdateSessionSchema,
      response: {
        200: SessionSummaryResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as z.infer<typeof UpdateSessionSchema>

    try {
      const [updated] = await db
        .update(sessions)
        .set({
          ...body,
          startTime:  body.startTime ? new Date(body.startTime) : undefined,
          endTime:    body.endTime   ? new Date(body.endTime)   : undefined,
          updatedAt:  new Date(),
        })
        .where(
          and(
            eq(sessions.id, id),
            eq(sessions.trainerId, request.trainer.trainerId)
          )
        )
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: 'Session not found' })
      }

      const client = await db.query.clients.findFirst({
        where: eq(clients.id, updated.clientId),
        columns: { id: true, name: true, photoUrl: true },
      }).catch(() => null)

      // ── Challenge: sessions_completed auto-progress ──────────────────
      if (body.status === 'completed') {
        updateChallengesForSessionComplete(updated.clientId)
          .catch(() => { /* challenge update failure is non-critical */ })
      }

      return reply.send(serializeSession({ ...updated, client }))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update session' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /sessions/:id — Discard a session
  //
  // Permanently deletes a session and all its workouts, exercises
  // and sets via CASCADE. Only the owning trainer can delete.
  //
  // Use cases:
  //   - Client cancelled last minute — session never started
  //   - Emergency mid-session — trainer wants no ghost record
  //   - Accidental session creation
  //
  // For sessions with logged sets the frontend should warn the
  // trainer that work will be lost. The backend deletes regardless.
  // ----------------------------------------------------------
  app.delete('/sessions/:id', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Discard a session',
      description: 'Permanently deletes a session and all associated workouts, exercises, and sets. Cannot be undone.',
      params: UuidParamSchema,
      response: {
        204: z.null().describe('Session deleted'),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const [deleted] = await db
        .delete(sessions)
        .where(
          and(
            eq(sessions.id, id),
            eq(sessions.trainerId, request.trainer.trainerId)
          )
        )
        .returning()

      if (!deleted) {
        return reply.status(404).send({ error: 'Session not found' })
      }

      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to delete session' })
    }
  })

  // ----------------------------------------------------------
  // POST /sessions/:id/exercises — Add an exercise directly to a session
  //
  // workoutType is looked up from the exercise library at add time and
  // denormalized onto the session_exercise row for display grouping.
  // ----------------------------------------------------------
  app.post('/sessions/:id/exercises', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Add exercise to a session',
      description: `Adds an exercise from the library directly to a session.

The exercise's \`workoutType\` is automatically copied from the library at add time for grouping purposes.

Optionally set target values (\`targetSets\`, \`targetReps\`, \`targetWeight\`) as goals — actuals are recorded separately in sets.

To add an exercise not in the library, first call \`POST /exercises/quick-add\` to create it, then use the returned ID here.`,
      params: UuidParamSchema,
      body: AddSessionExerciseSchema,
      response: {
        201: SessionExerciseResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: sessionId } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as z.infer<typeof AddSessionExerciseSchema>

    try {
      if (!(await ownedSession(sessionId, request.trainer.trainerId))) {
        return reply.status(404).send({ error: 'Session not found' })
      }

      // Look up workoutType + laterality from exercise library
      const exercise = await db.query.exercises.findFirst({
        where: eq(exercises.id, body.exerciseId),
        columns: { workoutType: true, laterality: true },
      })
      if (!exercise) {
        return reply.status(404).send({ error: 'Exercise not found' })
      }

      // Per-side input mode: honour an explicit choice, otherwise default it on
      // for unilateral exercises (Bulgarian split squat, single-arm row, etc.).
      const trackPerSide = body.trackPerSide ?? (exercise.laterality === 'unilateral')

      // Auto-assign orderIndex if not provided — append after existing exercises
      let { orderIndex } = body
      if (orderIndex === undefined) {
        const existing = await db.query.sessionExercises.findMany({
          where: eq(sessionExercises.sessionId, sessionId),
          columns: { orderIndex: true },
        })
        orderIndex = existing.length
      }

      const [newSE] = await db
        .insert(sessionExercises)
        .values({
          ...body,
          sessionId,
          workoutType: exercise.workoutType as never,
          trackPerSide,
          orderIndex,
        })
        .returning()

      return reply.status(201).send({
        ...newSE,
        exercise: null,
        sets:     [],
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to add exercise to session' })
    }
  })

  // ----------------------------------------------------------
  // POST /sessions/:id/circuits — Create a circuit (interwoven group)
  //
  // Adds N exercises as one group performed round-major. One shared circuitId is
  // stamped on every member; rounds becomes each member's targetSets; the shared
  // reps/weight are applied to all (still editable per exercise afterwards).
  // v1: all exercises must share a workoutType.
  // ----------------------------------------------------------
  app.post('/sessions/:id/circuits', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Create a circuit in a session',
      description: 'Groups exercises into a circuit performed round-major (interwoven). `rounds` becomes each member\'s target sets; shared reps/weight apply to all. All exercises must share a workout type (v1).',
      params: UuidParamSchema,
      body: CreateCircuitSchema,
      response: {
        201: z.array(SessionExerciseResponseSchema),
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: sessionId } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as z.infer<typeof CreateCircuitSchema>

    try {
      // Session must belong to this trainer.
      const session = await db.query.sessions.findFirst({
        where: and(eq(sessions.id, sessionId), eq(sessions.trainerId, request.trainer.trainerId)),
        columns: { id: true },
      })
      if (!session) return reply.status(404).send({ error: 'Session not found' })

      // Look up the exercises — validate existence, single workout type, laterality.
      const exRows = await db.query.exercises.findMany({
        where: inArray(exercises.id, body.exerciseIds),
        columns: { id: true, workoutType: true, laterality: true },
      })
      const found = new Map(exRows.map((e) => [e.id, e]))
      if (found.size !== new Set(body.exerciseIds).size) {
        return reply.status(400).send({ error: 'One or more exercises not found' })
      }
      const types = new Set(exRows.map((e) => e.workoutType))
      if (types.size > 1) {
        return reply.status(400).send({ error: 'Circuit exercises must share a workout type' })
      }
      const workoutType = exRows[0]?.workoutType
      if (!workoutType) return reply.status(400).send({ error: 'Circuit exercises not found' })

      // Append after existing exercises, preserving the given round order.
      const existing = await db.query.sessionExercises.findMany({
        where: eq(sessionExercises.sessionId, sessionId),
        columns: { orderIndex: true },
      })
      const startIndex = existing.length
      const circuitId = randomUUID()

      const values = body.exerciseIds.map((exId, i) => ({
        sessionId,
        exerciseId:       exId,
        circuitId,
        workoutType:      workoutType as never,
        orderIndex:       startIndex + i,
        // Per-side default inherited from each exercise's laterality (as elsewhere).
        trackPerSide:     found.get(exId)?.laterality === 'unilateral',
        targetSets:       body.rounds,
        targetReps:       body.targetReps       ?? null,
        targetWeight:     body.targetWeight      ?? null,
        targetWeightStep: body.targetWeightStep  ?? null,
        targetWeightUnit: body.targetWeightUnit,
        notes:            body.notes             ?? null,
      }))

      const inserted = await db.insert(sessionExercises).values(values).returning()

      return reply.status(201).send(inserted.map((se) => ({ ...se, exercise: null, sets: [] })))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to create circuit' })
    }
  })

  // ----------------------------------------------------------
  // PATCH /session-exercises/:id — Update a session exercise
  //
  // Used from the live session to flip the per-side input mode
  // ("Each side" ⟷ "Together") and to adjust targets in place.
  // ----------------------------------------------------------
  app.patch('/session-exercises/:id', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Update a session exercise',
      description: 'Partial update of a session exercise — flip the per-side tracking mode or adjust target values. Only provided fields change.',
      params: UuidParamSchema,
      body: UpdateSessionExerciseSchema,
      response: {
        200: SessionExerciseResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as z.infer<typeof UpdateSessionExerciseSchema>

    try {
      if (!(await ownedSessionExercise(id, request.trainer.trainerId))) {
        return reply.status(404).send({ error: 'Session exercise not found' })
      }

      const [updated] = await db
        .update(sessionExercises)
        .set(body)
        .where(eq(sessionExercises.id, id))
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: 'Session exercise not found' })
      }

      // Reload with the exercise + sets so the response matches the schema and
      // the client can re-render the row (record chips derived on the full read).
      const full = await db.query.sessionExercises.findFirst({
        where: eq(sessionExercises.id, id),
        with: {
          exercise: { with: { bodyPart: true, media: true } },
          sets:     { orderBy: (s, { asc }) => asc(s.setNumber) },
          session:  { columns: { clientId: true } },
        },
      })
      if (!full) {
        return reply.status(404).send({ error: 'Session exercise not found' })
      }

      const records = await computeSessionRecords(full.session.clientId, [full.exerciseId])
      return reply.status(200).send(serializeSessionExercise(full, records))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update session exercise' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /session-exercises/:id — Remove an exercise from a session
  // ----------------------------------------------------------
  app.delete('/session-exercises/:id', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Remove exercise from a session',
      description: 'Removes an exercise and all its recorded sets from a session.',
      params: UuidParamSchema,
      response: {
        204: z.null().describe('Exercise removed'),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const owned = await ownedSessionExercise(id, request.trainer.trainerId)
      if (!owned) {
        return reply.status(404).send({ error: 'Session exercise not found' })
      }

      // Delete + demote a now-lonely circuit survivor together, so a failure
      // between the two cannot leave a circuit of one.
      await db.transaction(async (tx) => {
        await tx.delete(sessionExercises).where(eq(sessionExercises.id, id))
        await ungroupIfBelowTwo(tx, owned.circuitId, owned.sessionId)
      })

      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to remove exercise' })
    }
  })

  // ----------------------------------------------------------
  // POST /session-exercises/:id/sets — Record a set
  //
  // The most frequently called endpoint during a live session.
  // Called every time the trainer logs a completed set.
  // Different fields are relevant depending on workout type —
  // see the Set schema description for details.
  // ----------------------------------------------------------
  app.post('/session-exercises/:id/sets', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Record a set',
      description: `Records one completed set for an exercise in the session.

**The most frequently used endpoint during live training.**

Which fields you populate depends on the workout type:
| Workout Type | Key Fields |
|---|---|
| Resistance | \`reps\`, \`weight\`, \`weightUnit\`, \`rpe\` |
| Calisthenics | \`reps\`, \`durationSeconds\`, \`rpe\` |
| Cardio | \`durationSeconds\`, \`distance\`, \`speed\`, \`intensity\` |
| Stretching | \`durationSeconds\`, \`side\` |

\`rpe\` (Rate of Perceived Exertion 1-10) applies to all types and is highly recommended for progress tracking.`,
      params: UuidParamSchema,
      body: CreateSetSchema.omit({ sessionExerciseId: true }),
      response: {
        201: SetResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: sessionExerciseId } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as Omit<z.infer<typeof CreateSetSchema>, 'sessionExerciseId'>

    try {
      // ── Fetch session exercise context ────────────────────────────────
      // Needed for both PR detection and challenge auto-progress
      // Also the ownership check: a set can only be logged onto the caller's
      // own session-exercise. (Previously this row was fetched for PR detection
      // only, and a missing row did not stop the insert.)
      const seRow = await ownedSessionExercise(sessionExerciseId, request.trainer.trainerId)
      if (!seRow) {
        return reply.status(404).send({ error: 'Session exercise not found' })
      }

      // ── Record detection (at log time — drives the live "New PR" flash) ──
      // A set becomes the current record when it strictly beats the client's
      // prior best for this exercise: Load = heaviest weight, Volume = weight ×
      // reps. The first-ever set (no prior) is a baseline and earns nothing.
      // Persistent chips are DERIVED on read (see computeSessionRecords) so the
      // marker moves off the old holder automatically; these two booleans only
      // tell the just-logged set whether to flash.
      // Per-side input mode: honour an explicit body value, else inherit the
      // session-exercise's toggle. Snapshotted onto the set so its volume is
      // self-describing and never recomputes if the toggle later changes.
      const perSide = body.perSide ?? seRow?.trackPerSide ?? false

      let isLoadRecord   = false
      let isVolumeRecord = false

      if (body.weight != null && body.reps != null && body.reps > 0 && seRow) {
        const priorSets = await db
          .select({
            weight:    sets.weight,
            reps:      sets.reps,
            perSide:   sets.perSide,
            repsLeft:  sets.repsLeft,
            repsRight: sets.repsRight,
          })
          .from(sets)
          .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
          .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
          .where(
            and(
              eq(sessions.clientId, seRow.session.clientId),
              eq(sessionExercises.exerciseId, seRow.exerciseId),
            )
          )

        let bestWeight = 0
        let bestVolume = 0
        let hadPrior   = false
        for (const row of priorSets) {
          if (row.weight != null && row.reps != null && row.reps > 0) {
            hadPrior   = true
            bestWeight = Math.max(bestWeight, row.weight)
            // Volume counts both sides for per-side sets (sideReps), not raw reps.
            bestVolume = Math.max(bestVolume, row.weight * sideReps(row))
          }
        }

        if (hadPrior) {
          const curVolume = body.weight * sideReps({
            reps:      body.reps,
            perSide,
            repsLeft:  body.repsLeft,
            repsRight: body.repsRight,
          })
          isLoadRecord   = body.weight > bestWeight
          isVolumeRecord = curVolume > bestVolume
        }
      }
      // ── End record detection ────────────────────────────────────────────

      const [newSet] = await db
        .insert(sets)
        .values({ ...body, sessionExerciseId, perSide })
        .returning()

      if (!newSet) {
        return reply.status(500).send({ error: 'Failed to record set' })
      }

      // ── Sync log ────────────────────────────────────────────────────────
      // Fire-and-forget audit entry — never blocks the set response
      logSyncWrite({
        trainerId:       request.trainer.trainerId,
        deviceId:        (request.headers['x-device-id'] as string) ?? '',
        tableName:       'sets',
        recordId:        newSet.id,
        operation:       'insert',
        payload:         newSet as Record<string, unknown>,
        localTimestamp:  request.headers['x-local-timestamp'] as string | undefined,
      }).catch(() => {})

      // ── Challenge auto-progress ─────────────────────────────────────────
      // Fire-and-forget — don't block the set response on challenge updates
      if (seRow) {
        updateChallengesForSet(
          seRow.session.clientId,
          seRow.exerciseId,
          {
            weight:          body.weight,
            reps:            body.reps,
            distance:        body.distance,
            durationSeconds: body.durationSeconds,
          },
        ).catch(() => { /* challenge update failure is non-critical */ })
      }

      return reply.status(201).send({
        ...newSet,
        isLoadRecord,
        isVolumeRecord,
        createdAt: newSet.createdAt instanceof Date ? newSet.createdAt.toISOString() : newSet.createdAt,
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to record set' })
    }
  })

  // ----------------------------------------------------------
  // PATCH /sets/:id — Edit a recorded set
  // Used to correct mistakes made during live logging.
  // ----------------------------------------------------------
  app.patch('/sets/:id', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Edit a recorded set',
      description: 'Corrects a previously recorded set. All fields are optional — only the fields provided are updated.',
      params: UuidParamSchema,
      body: CreateSetSchema.omit({ sessionExerciseId: true }).partial(),
      response: {
        200: SetResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as Partial<Omit<z.infer<typeof CreateSetSchema>, 'sessionExerciseId'>>

    try {
      if (!(await ownedSet(id, request.trainer.trainerId))) {
        return reply.status(404).send({ error: 'Set not found' })
      }

      const [updated] = await db
        .update(sets)
        .set(body as never)
        .where(eq(sets.id, id))
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: 'Set not found' })
      }

      return reply.send({
        ...updated,
        createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update set' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /sets/:id — Delete a set
  // ----------------------------------------------------------
  app.delete('/sets/:id', {
    schema: {
      tags: ['Sessions'],
      security: [{ bearerAuth: [] }],
      summary: 'Delete a set',
      description: 'Permanently removes a recorded set. Use the edit endpoint to correct mistakes rather than deleting.',
      params: UuidParamSchema,
      response: {
        204: z.null().describe('Set deleted'),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      if (!(await ownedSet(id, request.trainer.trainerId))) {
        return reply.status(404).send({ error: 'Set not found' })
      }

      const [deleted] = await db
        .delete(sets)
        .where(eq(sets.id, id))
        .returning()

      if (!deleted) {
        return reply.status(404).send({ error: 'Set not found' })
      }

      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to delete set' })
    }
  })

  // ----------------------------------------------------------
  // PATCH /sessions/:id/exercises/reorder
  // Accepts a globally-ordered array of session exercise IDs.
  // ----------------------------------------------------------
  app.patch('/sessions/:id/exercises/reorder', {
    schema: {
      tags: ['Sessions'], security: [{ bearerAuth: [] }],
      summary: 'Reorder exercises in a session',
      params: z.object({ id: z.string().uuid() }),
      body:   z.object({ orderedIds: z.array(z.string().uuid()) }),
      response: { 204: z.object({}), 403: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { id: sessionId } = request.params as { id: string }
    const { orderedIds }    = request.body as { orderedIds: string[] }
    try {
      // Verify session belongs to this trainer
      const session = await db.query.sessions.findFirst({
        where: and(eq(sessions.id, sessionId), eq(sessions.trainerId, request.trainer.trainerId)),
        columns: { id: true },
      })
      if (!session) return reply.status(403).send({ error: 'Not authorised' })

      await Promise.all(
        orderedIds.map((exId, index) =>
          db.update(sessionExercises)
            .set({ orderIndex: index })
            .where(and(eq(sessionExercises.id, exId), eq(sessionExercises.sessionId, sessionId)))
        )
      )
      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to reorder exercises' })
    }
  })
}
