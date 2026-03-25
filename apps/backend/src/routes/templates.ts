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
import { db, templates, templateWorkouts, templateExercises } from '../db'
import { eq, and } from 'drizzle-orm'
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
      description: 'Returns all workout templates for the trainer ordered by name. Use templates to pre-build session structures that can be applied to any client.',
      response: {
        200: TemplateListResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const result = await db.query.templates.findMany({
        where: eq(templates.trainerId, request.trainer.trainerId),
        orderBy: templates.name,
      })

      return reply.send(result)
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
                with: { exercise: { with: { bodyPart: true } } },
              },
            },
          },
        },
      })

      if (!result) {
        return reply.status(404).send({ error: 'Template not found' })
      }

      return reply.send(result)
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

      return reply.status(201).send(newTemplate)
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

      return reply.send(updated)
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
}
