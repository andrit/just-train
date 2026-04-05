import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/templates.ts — Template CRUD endpoints
//
// Routes:
//   GET    /api/v1/templates       → list all templates
//   GET    /api/v1/templates/:id   → full template with workouts and exercises
//   POST   /api/v1/templates       → create a template
//   PATCH  /api/v1/templates/:id   → update template metadata
//   DELETE /api/v1/templates/:id   → delete template (sessions using it are preserved)
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { db, templates, templateWorkouts, templateExercises, exercises } from '../db'
import { eq, and, ilike, or, exists, sql } from 'drizzle-orm'
import {
  CreateTemplateSchema,
  TemplateListResponseSchema,
  TemplateDetailResponseSchema,
  TemplateSummaryResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
} from '@trainer-app/shared'
import { z } from 'zod'


// Partial schema for PATCH — all fields optional
const UpdateTemplateSchema = CreateTemplateSchema.partial()

// Serialize dates to ISO strings for all template responses
function serializeDates<T extends { createdAt: Date | string; updatedAt: Date | string }>(row: T): T {
  return {
    ...row,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }
}

export async function templateRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // ----------------------------------------------------------
  // GET /templates — List all templates
  // ----------------------------------------------------------
  app.get('/templates', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'List templates',
      description: 'Returns all workout templates for the trainer ordered by name. Supports ?search= for case-insensitive search across name, description and notes.',
      querystring: z.object({ search: z.string().optional() }),
      response: {
        200: TemplateListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { search } = request.query as { search?: string }
    try {
      const baseCondition = eq(templates.trainerId, request.trainer.trainerId)
      const whereCondition = search
        ? and(
            baseCondition,
            or(
              ilike(templates.name,        `%${search}%`),
              ilike(templates.description, `%${search}%`),
              ilike(templates.notes,       `%${search}%`),
              // Search exercise names within the template's blocks
              exists(
                db.select({ one: sql`1` })
                  .from(templateWorkouts)
                  .innerJoin(templateExercises, eq(templateExercises.templateWorkoutId, templateWorkouts.id))
                  .innerJoin(exercises, eq(exercises.id, templateExercises.exerciseId))
                  .where(
                    and(
                      eq(templateWorkouts.templateId, templates.id),
                      ilike(exercises.name, `%${search}%`),
                    )
                  )
              ),
            )
          )
        : baseCondition

      const result = await db.query.templates.findMany({
        where:   whereCondition,
        orderBy: templates.name,
      })

      return reply.send(result.map(serializeDates))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch templates' })
    }
  })

  // ----------------------------------------------------------
  // GET /templates/:id — Full template with workouts and exercises
  // ----------------------------------------------------------
  app.get('/templates/:id', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Get a template',
      description: `Returns the full template tree:

\`Template → TemplateWorkouts → TemplateExercises (with joined exercise details)\`

Use this to display the template builder/editor and to preview what a session will look like before applying the template.`,
      params: UuidParamSchema,
      response: {
        200: TemplateDetailResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const result = await db.query.templates.findFirst({
        where: and(
          eq(templates.id, id),
          eq(templates.trainerId, request.trainer.trainerId)
        ),
        with: {
          templateWorkouts: {
            orderBy: templateWorkouts.orderIndex,
            with: {
              templateExercises: {
                orderBy: templateExercises.orderIndex,
                with: { exercise: { with: { bodyPart: true, media: true } } },
              },
            },
          },
        },
      })

      if (!result) {
        return reply.status(404).send({ error: 'Template not found' })
      }

      return reply.send(serializeDates(result))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch template' })
    }
  })

  // ----------------------------------------------------------
  // POST /templates — Create a new template
  // ----------------------------------------------------------
  app.post('/templates', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Create a template',
      description: `Creates a new workout template.

After creation, add workout blocks via the template workout endpoints (Phase 3), then add exercises to each block.

To apply a template to a session, include its \`id\` as \`templateId\` when calling \`POST /sessions\`.`,
      body: CreateTemplateSchema,
      response: {
        201: TemplateSummaryResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof CreateTemplateSchema>

    try {
      const [newTemplate] = await db
        .insert(templates)
        .values({ ...body, trainerId: request.trainer.trainerId })
        .returning()

      if (!newTemplate) return reply.status(500).send({ error: 'Failed to create template' })

      return reply.status(201).send(serializeDates(newTemplate))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to create template' })
    }
  })

  // ----------------------------------------------------------
  // PATCH /templates/:id — Update template metadata
  // ----------------------------------------------------------
  app.patch('/templates/:id', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Update a template',
      description: 'Updates template name, description, or notes. To modify the workout structure, use the template workout and exercise endpoints (Phase 3).',
      params: UuidParamSchema,
      body: UpdateTemplateSchema,
      response: {
        200: TemplateSummaryResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as z.infer<typeof UpdateTemplateSchema>

    try {
      const [updated] = await db
        .update(templates)
        .set({ ...body, updatedAt: new Date() })
        .where(
          and(
            eq(templates.id, id),
            eq(templates.trainerId, request.trainer.trainerId)
          )
        )
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: 'Template not found' })
      }

      return reply.send(serializeDates(updated))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update template' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /templates/:id — Delete a template
  //
  // Sessions created from this template are NOT deleted.
  // The sessions.templateId is set to null via onDelete: SET NULL
  // in the DB schema — session history is always preserved.
  // ----------------------------------------------------------
  app.delete('/templates/:id', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Delete a template',
      description: `Permanently deletes a template.

**Sessions are not affected.** Any sessions previously created from this template retain their full workout and set history — their \`templateId\` field is simply set to \`null\`.`,
      params: UuidParamSchema,
      response: {
        204: z.null().describe('Template deleted'),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>

    try {
      const [deleted] = await db
        .delete(templates)
        .where(
          and(
            eq(templates.id, id),
            eq(templates.trainerId, request.trainer.trainerId)
          )
        )
        .returning()

      if (!deleted) {
        return reply.status(404).send({ error: 'Template not found' })
      }

      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to delete template' })
    }
  })

  // ----------------------------------------------------------
  // POST /templates/:id/fork — Deep-copy a template
  // Creates a new template owned by the requesting trainer with
  // all workout blocks and exercises duplicated. The original
  // template may belong to any trainer (enables sharing defaults).
  // ----------------------------------------------------------
  app.post('/templates/:id/fork', {
    schema: {
      tags:     ['Templates'],
      security: [{ bearerAuth: [] }],
      summary:  'Fork a template',
      description: 'Creates a deep copy of a template owned by the requesting trainer. All workout blocks and exercises are duplicated. Use this to create a modified version of an existing template.',
      params:   UuidParamSchema,
      body:     z.object({ name: z.string().min(1).optional() }).optional(),
      response: {
        201: TemplateDetailResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as { name?: string } | undefined

    try {
      // Load source template
      const source = await db.query.templates.findFirst({
        where: eq(templates.id, id),
        with: {
          templateWorkouts: {
            orderBy: templateWorkouts.orderIndex,
            with: { templateExercises: { orderBy: templateExercises.orderIndex } },
          },
        },
      })

      if (!source) return reply.status(404).send({ error: 'Template not found' })

      // Create new template
      const [forked] = await db.insert(templates).values({
        trainerId:   request.trainer.trainerId,
        name:        body?.name ?? `${source.name} (copy)`,
        description: source.description ?? null,
        notes:       source.notes ?? null,
      }).returning()

      if (!forked) return reply.status(500).send({ error: 'Failed to fork template' })

      // Deep-copy workout blocks and exercises
      for (const tw of source.templateWorkouts) {
        const [newWorkout] = await db.insert(templateWorkouts).values({
          templateId:  forked.id,
          workoutType: tw.workoutType,
          orderIndex:  tw.orderIndex,
          notes:       tw.notes ?? null,
        }).returning()

        if (!newWorkout) continue

        for (const te of tw.templateExercises) {
          await db.insert(templateExercises).values({
            templateWorkoutId:     newWorkout.id,
            exerciseId:            te.exerciseId,
            orderIndex:            te.orderIndex,
            targetSets:            te.targetSets            ?? null,
            targetReps:            te.targetReps            ?? null,
            targetWeight:          te.targetWeight          ?? null,
            targetWeightUnit:      te.targetWeightUnit,
            targetDurationSeconds: te.targetDurationSeconds ?? null,
            targetDistance:        te.targetDistance        ?? null,
            targetIntensity:       te.targetIntensity       ?? null,
            notes:                 te.notes                 ?? null,
          })
        }
      }

      // Return full detail of forked template
      const result = await db.query.templates.findFirst({
        where: eq(templates.id, forked.id),
        with: {
          templateWorkouts: {
            orderBy: templateWorkouts.orderIndex,
            with: {
              templateExercises: {
                orderBy: templateExercises.orderIndex,
                with: { exercise: { with: { bodyPart: true, media: true } } },
              },
            },
          },
        },
      })

      return reply.status(201).send(result)
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fork template' })
    }
  })

  // ----------------------------------------------------------
  // POST /templates/:id/workouts — Add a workout block
  // ----------------------------------------------------------
  app.post('/templates/:id/workouts', {
    schema: {
      tags: ['Templates'], security: [{ bearerAuth: [] }],
      summary: 'Add a workout block to a template',
      params: UuidParamSchema,
      body: z.object({
        workoutType: z.string(),
        orderIndex:  z.number().int().optional(),
        notes:       z.string().optional(),
      }),
      response: { 201: z.object({ id: z.string().uuid() }), 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body   = request.body as { workoutType: string; orderIndex?: number; notes?: string }

    try {
      const template = await db.query.templates.findFirst({
        where: and(eq(templates.id, id), eq(templates.trainerId, request.trainer.trainerId)),
        columns: { id: true },
      })
      if (!template) return reply.status(404).send({ error: 'Template not found' })

      const existing = await db.query.templateWorkouts.findMany({
        where: eq(templateWorkouts.templateId, id),
        columns: { id: true },
      })

      const [block] = await db.insert(templateWorkouts).values({
        templateId:  id,
        workoutType: body.workoutType as never,
        orderIndex:  body.orderIndex ?? existing.length,
        notes:       body.notes ?? null,
      }).returning()

      if (!block) return reply.status(500).send({ error: "Failed to create block" })
      return reply.status(201).send({ id: block.id })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to add workout block' })
    }
  })

  // ----------------------------------------------------------
  // PATCH /templates/:id/workouts/reorder
  // Accepts an ordered array of template workout IDs and updates
  // their orderIndex values. Used by drag-to-reorder in builder.
  // ----------------------------------------------------------
  app.patch('/templates/:id/workouts/reorder', {
    schema: {
      tags: ['Templates'], security: [{ bearerAuth: [] }],
      summary: 'Reorder workout blocks in a template',
      params: z.object({ id: z.string().uuid() }),
      body:   z.object({ orderedIds: z.array(z.string().uuid()) }),
      response: { 204: z.object({}), 403: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { id: templateId } = request.params as { id: string }
    const { orderedIds }     = request.body as { orderedIds: string[] }
    try {
      // Verify template belongs to this trainer
      const template = await db.query.templates.findFirst({
        where: and(eq(templates.id, templateId), eq(templates.trainerId, request.trainer.trainerId)),
        columns: { id: true },
      })
      if (!template) return reply.status(403).send({ error: 'Not authorised' })

      // Update each workout block's orderIndex in parallel
      await Promise.all(
        orderedIds.map((workoutId, index) =>
          db.update(templateWorkouts)
            .set({ orderIndex: index })
            .where(and(eq(templateWorkouts.id, workoutId), eq(templateWorkouts.templateId, templateId)))
        )
      )
      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to reorder workout blocks' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /template-workouts/:id — Remove a workout block
  // ----------------------------------------------------------
  app.delete('/template-workouts/:id', {
    schema: {
      tags: ['Templates'], security: [{ bearerAuth: [] }],
      summary: 'Remove a workout block from a template',
      params: UuidParamSchema,
      response: { 204: z.object({}), 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    try {
      await db.delete(templateWorkouts).where(eq(templateWorkouts.id, id))
      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to remove workout block' })
    }
  })

  // ----------------------------------------------------------
  // POST /template-workouts/:id/exercises — Add an exercise
  // ----------------------------------------------------------
  app.post('/template-workouts/:id/exercises', {
    schema: {
      tags: ['Templates'], security: [{ bearerAuth: [] }],
      summary: 'Add an exercise to a template workout block',
      params: UuidParamSchema,
      body: z.object({
        exerciseId:            z.string().uuid(),
        orderIndex:            z.number().int().optional(),
        targetSets:            z.number().int().optional(),
        targetReps:            z.number().int().optional(),
        targetWeight:          z.number().optional(),
        targetDurationSeconds: z.number().int().optional(),
        targetDistance:        z.number().optional(),
        notes:                 z.string().optional(),
      }),
      response: { 201: z.object({ id: z.string().uuid() }), 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { id: templateWorkoutId } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as {
      exerciseId: string; orderIndex?: number
      targetSets?: number; targetReps?: number; targetWeight?: number
      targetDurationSeconds?: number; targetDistance?: number; notes?: string
    }

    try {
      const existing = await db.query.templateExercises.findMany({
        where: eq(templateExercises.templateWorkoutId, templateWorkoutId),
        columns: { id: true },
      })

      const [ex] = await db.insert(templateExercises).values({
        templateWorkoutId,
        exerciseId:            body.exerciseId,
        orderIndex:            body.orderIndex ?? existing.length,
        targetSets:            body.targetSets            ?? null,
        targetReps:            body.targetReps            ?? null,
        targetWeight:          body.targetWeight          ?? null,
        targetWeightUnit:      'lbs',
        targetDurationSeconds: body.targetDurationSeconds ?? null,
        targetDistance:        body.targetDistance        ?? null,
        notes:                 body.notes                 ?? null,
      }).returning()

      if (!ex) return reply.status(500).send({ error: "Failed to add exercise" })
      return reply.status(201).send({ id: ex.id })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to add exercise' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /template-exercises/:id — Remove an exercise
  // ----------------------------------------------------------
  app.delete('/template-exercises/:id', {
    schema: {
      tags: ['Templates'], security: [{ bearerAuth: [] }],
      summary: 'Remove an exercise from a template workout block',
      params: UuidParamSchema,
      response: { 204: z.object({}), 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    try {
      await db.delete(templateExercises).where(eq(templateExercises.id, id))
      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to remove exercise' })
    }
  })
}
