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
import { db, sessions, sessionExercises, sets, clients, exercises, templateExercises } from '../db'
import { eq, and, desc } from 'drizzle-orm'
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
} from '@trainer-app/shared'
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
function serializeSessionExercise(se: any): any {
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
      createdAt: set.createdAt instanceof Date ? set.createdAt.toISOString() : set.createdAt,
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeSession(s: any): any {
  return {
    ...s,
    client:           s.client
      ? { id: s.client.id, name: s.client.name, photoUrl: s.client.photoUrl ?? null }
      : null,
    startTime:        s.startTime instanceof Date ? s.startTime.toISOString() : (s.startTime ?? null),
    endTime:          s.endTime   instanceof Date ? s.endTime.toISOString()   : (s.endTime   ?? null),
    createdAt:        s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    updatedAt:        s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    sessionExercises: (s.sessionExercises ?? []).map(serializeSessionExercise),
  }
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

      return reply.send(result.map(serializeSession))
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

      return reply.send(serializeSession(result))
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
- **Planned (pre-built):** Provide a \`templateId\` and the session is pre-populated with workouts and exercises from the template. Status starts as \`planned\`.
- **Live (as-you-go):** Omit \`templateId\` and start with an empty session. Add workouts and exercises as the training happens.`,
      body: CreateSessionSchema,
      response: {
        201: SessionSummaryResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof CreateSessionSchema>

    try {
      const [newSession] = await db
        .insert(sessions)
        .values({
          ...body,
          templateId: body.templateId ?? null,
          trainerId:  request.trainer.trainerId,
          status:     'planned',
          startTime:  body.startTime ? new Date(body.startTime) : null,
        })
        .returning()

      if (!newSession) {
        return reply.status(500).send({ error: 'Failed to create session' })
      }

      // ── Apply template if provided ───────────────────────────────────────
      // template_exercises → session_exercises (flat, ordered by template orderIndex)
      // workoutType is copied from the template exercise record at add time.
      if (body.templateId) {
        const templateData = await db.query.templateExercises.findMany({
          where:   eq(templateExercises.templateId, body.templateId),
          orderBy: templateExercises.orderIndex,
        })

        for (const te of templateData) {
          await db.insert(sessionExercises).values({
            sessionId:             newSession.id,
            exerciseId:            te.exerciseId,
            workoutType:           te.workoutType as never,
            orderIndex:            te.orderIndex,
            targetSets:            te.targetSets            ?? null,
            targetReps:            te.targetReps            ?? null,
            targetRepsPerSet:      te.targetRepsPerSet      ?? null,
            targetWeight:          te.targetWeight          ?? null,
            targetWeightUnit:      te.targetWeightUnit,
            targetDurationSeconds: te.targetDurationSeconds ?? null,
            targetDistance:        te.targetDistance        ?? null,
            targetIntensity:       te.targetIntensity       ?? null,
            notes:                 te.notes                 ?? null,
          })
        }
      }
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
      // Look up workoutType from exercise library
      const exercise = await db.query.exercises.findFirst({
        where: eq(exercises.id, body.exerciseId),
        columns: { workoutType: true },
      })
      if (!exercise) {
        return reply.status(404).send({ error: 'Exercise not found' })
      }

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
      const [deleted] = await db
        .delete(sessionExercises)
        .where(eq(sessionExercises.id, id))
        .returning()

      if (!deleted) {
        return reply.status(404).send({ error: 'Session exercise not found' })
      }

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
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: sessionExerciseId } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as Omit<z.infer<typeof CreateSetSchema>, 'sessionExerciseId'>

    try {
      // ── Fetch session exercise context ────────────────────────────────
      // Needed for both PR detection and challenge auto-progress
      const seRow = await db.query.sessionExercises.findFirst({
        where: eq(sessionExercises.id, sessionExerciseId),
        with: {
          session: {
            columns: { clientId: true },
          },
        },
      })

      // ── PR detection ────────────────────────────────────────────────────
      // Only meaningful for resistance sets with both weight and reps
      let isPR       = false
      let isPRVolume = false

      if (body.weight != null && body.reps != null && body.reps > 0) {
        const epley = (w: number, r: number): number => w * (1 + r / 30)
        const newEpley  = epley(body.weight, body.reps)
        const newVolume = body.weight * body.reps

        if (seRow) {
          const clientId    = seRow.session.clientId
          const exerciseId  = seRow.exerciseId

          // Query all historical sets for this client + exercise
          const historicalSets = await db
            .select({ weight: sets.weight, reps: sets.reps })
            .from(sets)
            .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
            .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
            .where(
              and(
                eq(sessions.clientId, clientId),
                eq(sessionExercises.exerciseId, exerciseId),
              )
            )

          let bestEpley  = 0
          let bestVolume = 0
          for (const row of historicalSets) {
            if (row.weight != null && row.reps != null && row.reps > 0) {
              bestEpley  = Math.max(bestEpley,  epley(row.weight, row.reps))
              bestVolume = Math.max(bestVolume, row.weight * row.reps)
            }
          }

          isPR       = newEpley  > bestEpley
          isPRVolume = newVolume > bestVolume
        }
      }
      // ── End PR detection ────────────────────────────────────────────────

      const [newSet] = await db
        .insert(sets)
        .values({ ...body, sessionExerciseId, isPR, isPRVolume })
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
