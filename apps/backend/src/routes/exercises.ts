import { serializeDates } from '../lib/serializeDates'
import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/exercises.ts — Exercise Library endpoints
//
// Routes:
//   GET    /api/v1/body-parts              → list body parts (for filter UI)
//   GET    /api/v1/exercises               → list exercises (filterable)
//   GET    /api/v1/exercises/:id           → get exercise with all media
//   POST   /api/v1/exercises               → create full exercise in library
//   POST   /api/v1/exercises/quick-add     → minimal add mid-session (isDraft=true)
//   PATCH  /api/v1/exercises/:id           → update / enrich an exercise
//   DELETE /api/v1/exercises/:id           → delete (blocked if in use)
//
// FILTER QUERYSTRING on GET /exercises:
//   ?workoutType=resistance
//   ?bodyPartId=<uuid>
//   ?isDraft=true          (find exercises needing enrichment)
//   ?search=squat          (case-insensitive name search)
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { db, exercises, bodyParts, exerciseMedia, exerciseMuscles } from '../db'
import { eq, and, ilike, or, isNull, inArray } from 'drizzle-orm'
import { buildMuscleRows } from '../lib/exerciseMuscles'
import {
  CreateExerciseSchema,
  QuickAddExerciseSchema,
  UpdateExerciseSchema,
  ExerciseListResponseSchema,
  ExerciseDetailResponseSchema,
  ExerciseSummaryResponseSchema,
  BodyPartListResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
  MuscleEnum,
} from '@trainer-app/shared'
import { z } from 'zod'


// Querystring schema for GET /exercises filter params
const ExerciseFilterSchema = z.object({
  workoutType: z.enum(['cardio', 'stretching', 'calisthenics', 'resistance', 'cooldown'])
    .optional()
    .describe('Filter by workout type'),
  bodyPartId: z.string().uuid().optional()
    .describe('Filter by body part UUID'),
  isDraft: z.enum(['true', 'false']).optional()
    .describe('Filter to draft exercises (true) or complete exercises (false)'),
  search: z.string().optional()
    .describe('Case-insensitive search on exercise name'),
  muscle: MuscleEnum.optional()
    .describe('Filter to exercises that target this muscle (primary or secondary)'),
})

export async function exerciseRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // ----------------------------------------------------------
  // GET /body-parts — List all body parts
  // Used to populate the body part filter/picker in the UI.
  // ----------------------------------------------------------
  app.get('/body-parts', {
    schema: {
      tags: ['Exercises'],
      security: [{ bearerAuth: [] }],
      summary: 'List body parts',
      description: 'Returns all body part options ordered by display order. Used to populate body part filter and exercise creation form.',
      response: {
        200: BodyPartListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (_request, reply) => {
    try {
      const result = await db
        .select()
        .from(bodyParts)
        .orderBy(bodyParts.displayOrder)

      return reply.send(result)
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch body parts' })
    }
  })

  // ----------------------------------------------------------
  // GET /exercises — List exercises with optional filters
  // ----------------------------------------------------------
  app.get('/exercises', {
    schema: {
      tags: ['Exercises'],
      security: [{ bearerAuth: [] }],
      summary: 'List exercises',
      description: `Returns exercises from the library. Supports multiple optional filters that can be combined.

**isDraft = true** returns exercises that were quick-added mid-session and still need a description, instructions, and media added in the library.`,
      querystring: ExerciseFilterSchema,
      response: {
        200: ExerciseListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { workoutType, bodyPartId, isDraft, search, muscle } =
      request.query as z.infer<typeof ExerciseFilterSchema>

    try {
      // Return trainer's own exercises + the public library
      const ownerCondition = or(
        eq(exercises.trainerId, request.trainer.trainerId),
        isNull(exercises.trainerId),
      )
      const conditions = [ownerCondition]

      // Muscle filter: resolve the exercise ids that target the muscle first,
      // then filter by id. A two-step `inArray` (not a correlated subquery)
      // keeps this inside the typed query builder — no raw-SQL aliasing risk —
      // and the library is small enough that the extra round-trip is free.
      if (muscle) {
        const muscleRows = await db
          .select({ id: exerciseMuscles.exerciseId })
          .from(exerciseMuscles)
          .where(eq(exerciseMuscles.muscle, muscle))
        const ids = muscleRows.map((r) => r.id)
        if (ids.length === 0) return reply.send([])
        conditions.push(inArray(exercises.id, ids))
      }

      if (workoutType) conditions.push(eq(exercises.workoutType, workoutType as never))
      if (bodyPartId)  conditions.push(eq(exercises.bodyPartId, bodyPartId))
      if (isDraft !== undefined) conditions.push(eq(exercises.isDraft, isDraft === 'true'))
      if (search) conditions.push(ilike(exercises.name, `%${search}%`))

      const result = await db.query.exercises.findMany({
        where: and(...conditions),
        with: {
          bodyPart: true,
          // List view: only the primary thumbnail, not all media
          media: {
            where: eq(exerciseMedia.isPrimary, true),
            limit: 1,
          },
        },
        orderBy: exercises.name,
      })

      return reply.send(result)
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch exercises' })
    }
  })

  // ----------------------------------------------------------
  // GET /exercises/:id — Get full exercise detail with all media
  // ----------------------------------------------------------
  app.get('/exercises/:id', {
    schema: {
      tags: ['Exercises'],
      security: [{ bearerAuth: [] }],
      summary: 'Get an exercise',
      description: 'Returns a single exercise with full detail: body part, instructions, and **all** media ordered by displayOrder.',
      params: UuidParamSchema,
      response: {
        200: ExerciseDetailResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const result = await db.query.exercises.findFirst({
        where: and(
          eq(exercises.id, id),
          or(
            eq(exercises.trainerId, request.trainer.trainerId),
            isNull(exercises.trainerId),
          )
        ),
        with: {
          bodyPart: true,
          media: { orderBy: exerciseMedia.displayOrder },
          muscles: true,
        },
      })

      if (!result) {
        return reply.status(404).send({ error: 'Exercise not found' })
      }

      // Group the muscle join rows into { primary, secondary } for the map,
      // overriding the raw relation on the row. Default to [] — the relation
      // is absent on a mocked row, and empty is the right answer for
      // cardio/stretching/cooldown and un-enriched drafts.
      const muscleRows = result.muscles ?? []
      const muscles = {
        primary:   muscleRows.filter((m) => m.role === 'primary').map((m) => m.muscle),
        secondary: muscleRows.filter((m) => m.role === 'secondary').map((m) => m.muscle),
      }

      // Deep: media rows carry their own createdAt (real-DB lane finding).
      return reply.send(serializeDates({ ...result, muscles }))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch exercise' })
    }
  })

  // ----------------------------------------------------------
  // POST /exercises — Create a full exercise in the library
  // ----------------------------------------------------------
  app.post('/exercises', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    schema: {
      tags: ['Exercises'],
      security: [{ bearerAuth: [] }],
      summary: 'Create an exercise',
      description: 'Creates a fully-specified exercise in the library. For a faster mid-session add with minimal fields, use `POST /exercises/quick-add` instead.',
      body: CreateExerciseSchema,
      response: {
        201: ExerciseSummaryResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { muscles, ...body } = request.body as z.infer<typeof CreateExerciseSchema>

    try {
      const newExercise = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(exercises)
          .values({
            ...body,
            trainerId: request.trainer.trainerId,
            isDraft: false,
          })
          .returning()

        if (!created) return null

        if (muscles) {
          const rows = buildMuscleRows(created.id, muscles)
          if (rows.length > 0) await tx.insert(exerciseMuscles).values(rows)
        }
        return created
      })

      if (!newExercise) {
        return reply.status(500).send({ error: 'Failed to create exercise' })
      }

      return reply.status(201).send({
        ...newExercise,
        bodyPart: null,
        media:    [],
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to create exercise' })
    }
  })

  // ----------------------------------------------------------
  // POST /exercises/quick-add — Minimal add mid-session
  //
  // Only name, bodyPartId, and workoutType are required.
  // isDraft is set to true automatically.
  // The trainer is shown a badge in the library to enrich it later.
  // ----------------------------------------------------------
  app.post('/exercises/quick-add', {
    config: { rateLimit: { max: 50, timeWindow: '1 hour' } },
    schema: {
      tags: ['Exercises'],
      security: [{ bearerAuth: [] }],
      summary: 'Quick-add an exercise mid-session',
      description: `Adds a new exercise with minimal information so the trainer doesn't have to leave the active session.

The exercise is flagged with \`isDraft: true\`. It appears in the library with a badge reminding the trainer to add a description, instructions, and demo media.

**Required fields only:** name, bodyPartId, workoutType`,
      body: QuickAddExerciseSchema,
      response: {
        201: ExerciseSummaryResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof QuickAddExerciseSchema>

    try {
      const [newExercise] = await db
        .insert(exercises)
        .values({
          ...body,
          trainerId: request.trainer.trainerId,
          isDraft: true,
          equipment: 'none',
          difficulty: 'beginner',
        })
        .returning()

      return reply.status(201).send({
        ...newExercise,
        bodyPart: null,
        media:    [],
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to quick-add exercise' })
    }
  })

  // ----------------------------------------------------------
  // PATCH /exercises/:id — Update or enrich an exercise
  // ----------------------------------------------------------
  app.patch('/exercises/:id', {
    schema: {
      tags: ['Exercises'],
      security: [{ bearerAuth: [] }],
      summary: 'Update an exercise',
      description: 'Partially updates an exercise. Use this to enrich draft exercises with descriptions, instructions, and correct metadata. Media is managed separately via Cloudinary (Phase 3).',
      params: UuidParamSchema,
      body: UpdateExerciseSchema,
      response: {
        200: ExerciseSummaryResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const { muscles, ...body } = request.body as z.infer<typeof UpdateExerciseSchema>

    try {
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(exercises)
          .set({ ...body, updatedAt: new Date() })
          .where(
            and(
              eq(exercises.id, id),
              eq(exercises.trainerId, request.trainer.trainerId)
            )
          )
          .returning()

        if (!row) return null

        // Replace the muscle set only when the caller sent one (PATCH semantics:
        // omitted = leave existing muscles untouched). Scoped to this owned row.
        if (muscles) {
          await tx.delete(exerciseMuscles).where(eq(exerciseMuscles.exerciseId, id))
          const rows = buildMuscleRows(id, muscles)
          if (rows.length > 0) await tx.insert(exerciseMuscles).values(rows)
        }
        return row
      })

      if (!updated) {
        return reply.status(404).send({ error: 'Exercise not found' })
      }

      return reply.send(updated)
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update exercise' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /exercises/:id — Delete an exercise
  //
  // Will return 409 if the exercise is referenced in any session
  // or template (onDelete: restrict in the DB schema).
  // The UI should warn the trainer before calling this.
  // ----------------------------------------------------------
  app.delete('/exercises/:id', {
    schema: {
      tags: ['Exercises'],
      security: [{ bearerAuth: [] }],
      summary: 'Delete an exercise',
      description: `Permanently deletes an exercise from the library.

⚠️ **Returns 409 Conflict** if the exercise is referenced in any session or template. The trainer must remove it from all sessions and templates before deletion is allowed.`,
      params: UuidParamSchema,
      response: {
        204: z.null().describe('Exercise deleted successfully'),
        404: ErrorResponseSchema,
        409: ErrorResponseSchema.describe('Exercise is in use — remove from sessions and templates first'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const [deleted] = await db
        .delete(exercises)
        .where(
          and(
            eq(exercises.id, id),
            eq(exercises.trainerId, request.trainer.trainerId)
          )
        )
        .returning()

      if (!deleted) {
        return reply.status(404).send({ error: 'Exercise not found' })
      }

      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(409).send({
        error: 'Cannot delete — exercise is used in one or more sessions or templates',
      })
    }
  })
}
