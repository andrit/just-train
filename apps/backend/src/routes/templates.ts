import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/templates.ts — Template CRUD endpoints
//
// Routes:
//   GET    /api/v1/templates            → list all templates
//   GET    /api/v1/templates/:id        → full template with exercises
//   POST   /api/v1/templates            → create a template
//   PATCH  /api/v1/templates/:id        → update template metadata
//   DELETE /api/v1/templates/:id        → delete template
//   POST   /api/v1/templates/:id/fork   → deep-copy a template
//
//   POST   /api/v1/templates/:id/exercises          → add exercise to template
//   DELETE /api/v1/template-exercises/:id           → remove exercise from template
//   PATCH  /api/v1/templates/:id/exercises/reorder  → reorder exercises
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { db, templates, templateExercises, exercises } from '../db'
import { eq, and, ilike, or, exists, sql } from 'drizzle-orm'
import {
  CreateTemplateSchema,
  AddTemplateExerciseSchema,
  TemplateListResponseSchema,
  TemplateDetailResponseSchema,
  TemplateSummaryResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
} from '@trainer-app/shared'
import { z } from 'zod'


const UpdateTemplateSchema = CreateTemplateSchema.partial()

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
  // GET /templates
  // ----------------------------------------------------------
  app.get('/templates', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'List templates',
      description: 'Returns all workout templates for the trainer ordered by name. Supports ?search= for case-insensitive name/description/exercise search.',
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
              exists(
                db.select({ one: sql`1` })
                  .from(templateExercises)
                  .innerJoin(exercises, eq(exercises.id, templateExercises.exerciseId))
                  .where(
                    and(
                      eq(templateExercises.templateId, templates.id),
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
  // GET /templates/:id — Full template with exercises
  // ----------------------------------------------------------
  app.get('/templates/:id', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Get a template',
      description: 'Returns the full template with exercises ordered by orderIndex (with joined exercise details).',
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
          templateExercises: {
            orderBy: templateExercises.orderIndex,
            with: { exercise: { with: { bodyPart: true, media: true } } },
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
  // POST /templates
  // ----------------------------------------------------------
  app.post('/templates', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Create a template',
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
  // PATCH /templates/:id
  // ----------------------------------------------------------
  app.patch('/templates/:id', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Update a template',
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
        .where(and(eq(templates.id, id), eq(templates.trainerId, request.trainer.trainerId)))
        .returning()

      if (!updated) return reply.status(404).send({ error: 'Template not found' })
      return reply.send(serializeDates(updated))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update template' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /templates/:id
  // Sessions that used this template retain their exercises — templateId set to null.
  // ----------------------------------------------------------
  app.delete('/templates/:id', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Delete a template',
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
        .where(and(eq(templates.id, id), eq(templates.trainerId, request.trainer.trainerId)))
        .returning()

      if (!deleted) return reply.status(404).send({ error: 'Template not found' })
      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to delete template' })
    }
  })

  // ----------------------------------------------------------
  // POST /templates/:id/fork — Deep-copy a template
  // ----------------------------------------------------------
  app.post('/templates/:id/fork', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    schema: {
      tags:     ['Templates'],
      security: [{ bearerAuth: [] }],
      summary:  'Fork a template',
      description: 'Creates a deep copy of a template with all exercises duplicated.',
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
      const source = await db.query.templates.findFirst({
        where: eq(templates.id, id),
        with: { templateExercises: { orderBy: templateExercises.orderIndex } },
      })

      if (!source) return reply.status(404).send({ error: 'Template not found' })

      const [forked] = await db.insert(templates).values({
        trainerId:   request.trainer.trainerId,
        name:        body?.name ?? `${source.name} (copy)`,
        type:        source.type,
        description: source.description ?? null,
        notes:       source.notes ?? null,
      }).returning()

      if (!forked) return reply.status(500).send({ error: 'Failed to fork template' })

      for (const te of source.templateExercises) {
        await db.insert(templateExercises).values({
          templateId:            forked.id,
          exerciseId:            te.exerciseId,
          workoutType:           te.workoutType,
          orderIndex:            te.orderIndex,
          targetSets:            te.targetSets       ?? null,
          targetReps:            te.targetReps       ?? null,
          targetRepsPerSet:      te.targetRepsPerSet ?? null,
          targetWeight:          te.targetWeight     ?? null,
          targetWeightUnit:      te.targetWeightUnit,
          targetDurationSeconds: te.targetDurationSeconds ?? null,
          targetDistance:        te.targetDistance        ?? null,
          targetIntensity:       te.targetIntensity       ?? null,
          notes:                 te.notes                 ?? null,
        })
      }

      const result = await db.query.templates.findFirst({
        where: eq(templates.id, forked.id),
        with: {
          templateExercises: {
            orderBy: templateExercises.orderIndex,
            with: { exercise: { with: { bodyPart: true, media: true } } },
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
  // POST /templates/:id/exercises — Add exercise to template
  // workoutType is looked up from the exercise record automatically.
  // ----------------------------------------------------------
  app.post('/templates/:id/exercises', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Add an exercise to a template',
      params: UuidParamSchema,
      body: AddTemplateExerciseSchema,
      response: {
        201: z.object({ id: z.string().uuid() }),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: templateId } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as z.infer<typeof AddTemplateExerciseSchema>

    try {
      const [template, exercise] = await Promise.all([
        db.query.templates.findFirst({
          where: and(eq(templates.id, templateId), eq(templates.trainerId, request.trainer.trainerId)),
          columns: { id: true },
        }),
        db.query.exercises.findFirst({
          where: eq(exercises.id, body.exerciseId),
          columns: { workoutType: true },
        }),
      ])

      if (!template) return reply.status(404).send({ error: 'Template not found' })
      if (!exercise) return reply.status(404).send({ error: 'Exercise not found' })

      const existing = await db.query.templateExercises.findMany({
        where: eq(templateExercises.templateId, templateId),
        columns: { id: true },
      })

      const [ex] = await db.insert(templateExercises).values({
        templateId,
        exerciseId:            body.exerciseId,
        workoutType:           exercise.workoutType,
        orderIndex:            body.orderIndex ?? existing.length,
        targetSets:            body.targetSets            ?? null,
        targetReps:            body.targetReps            ?? null,
        targetRepsPerSet:      body.targetRepsPerSet      ?? null,
        targetWeight:          body.targetWeight          ?? null,
        targetWeightUnit:      body.targetWeightUnit ?? 'lbs',
        targetDurationSeconds: body.targetDurationSeconds ?? null,
        targetDistance:        body.targetDistance        ?? null,
        targetIntensity:       body.targetIntensity       ?? null,
        notes:                 body.notes                 ?? null,
      }).returning()

      if (!ex) return reply.status(500).send({ error: 'Failed to add exercise' })
      return reply.status(201).send({ id: ex.id })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to add exercise' })
    }
  })

  // ----------------------------------------------------------
  // DELETE /template-exercises/:id — Remove exercise from template
  // ----------------------------------------------------------
  app.delete('/template-exercises/:id', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Remove an exercise from a template',
      params: UuidParamSchema,
      response: {
        204: z.object({}),
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
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

  // ----------------------------------------------------------
  // PATCH /templates/:id/exercises/reorder
  // Accepts full ordered array of template exercise IDs.
  // ----------------------------------------------------------
  app.patch('/templates/:id/exercises/reorder', {
    schema: {
      tags: ['Templates'],
      security: [{ bearerAuth: [] }],
      summary: 'Reorder exercises in a template',
      params: z.object({ id: z.string().uuid() }),
      body:   z.object({ orderedIds: z.array(z.string().uuid()) }),
      response: { 204: z.object({}), 403: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { id: templateId } = request.params as { id: string }
    const { orderedIds }     = request.body as { orderedIds: string[] }
    try {
      const template = await db.query.templates.findFirst({
        where: and(eq(templates.id, templateId), eq(templates.trainerId, request.trainer.trainerId)),
        columns: { id: true },
      })
      if (!template) return reply.status(403).send({ error: 'Not authorised' })

      await Promise.all(
        orderedIds.map((exerciseId, index) =>
          db.update(templateExercises)
            .set({ orderIndex: index })
            .where(and(eq(templateExercises.id, exerciseId), eq(templateExercises.templateId, templateId)))
        )
      )
      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to reorder exercises' })
    }
  })
}
