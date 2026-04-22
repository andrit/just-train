import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/challenges.ts — Coach challenge endpoints (v2.12.0)
//
// Routes:
//   GET    /api/v1/clients/:clientId/challenges → list challenges
//   POST   /api/v1/clients/:clientId/challenges → create challenge
//   PATCH  /api/v1/challenges/:id               → update challenge
//   DELETE /api/v1/challenges/:id               → cancel challenge
//
// Works identically for trainer-managed clients and self-clients.
// The authenticate + ownership check middleware handles scoping.
// No separate athlete routes needed.
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { z }                    from 'zod'
import { db, challenges, clients } from '../db'
import { eq, and, desc }        from 'drizzle-orm'
import { authenticate }         from '../middleware/authenticate'
import {
  CreateChallengeSchema,
  UpdateChallengeSchema,
  ChallengeResponseSchema,
  ChallengeListResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
} from '@trainer-app/shared'

// ── Serializer ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeExerciseSummary(ex: any) {
  if (!ex) return null
  return {
    id:          ex.id,
    name:        ex.name,
    workoutType: ex.workoutType,
    equipment:   ex.equipment,
    difficulty:  ex.difficulty,
    isDraft:     ex.isDraft,
    bodyPart:    ex.bodyPart ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media:       (ex.media ?? []).map((m: any) => ({
      ...m,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeChallenge(c: any) {
  return {
    id:           c.id,
    clientId:     c.clientId,
    trainerId:    c.trainerId,
    title:        c.title,
    description:  c.description ?? null,
    metricType:   c.metricType,
    exerciseId:   c.exerciseId ?? null,
    exercise:     serializeExerciseSummary(c.exercise),
    targetValue:  c.targetValue,
    targetUnit:   c.targetUnit ?? null,
    currentValue: c.currentValue,
    deadline:     c.deadline,
    status:       c.status,
    completedAt:  c.completedAt instanceof Date ? c.completedAt.toISOString() : c.completedAt ?? null,
    createdAt:    c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
    updatedAt:    c.updatedAt instanceof Date ? c.updatedAt.toISOString() : c.updatedAt,
  }
}

// ── Route plugin ────────────────────────────────────────────────────────────

export async function challengeRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('preHandler', authenticate)

  // Helper: verify client belongs to this trainer
  async function findOwnedClient(trainerId: string, clientId: string) {
    return db.query.clients.findFirst({
      where: and(
        eq(clients.id, clientId),
        eq(clients.trainerId, trainerId),
      ),
    })
  }

  // Helper: verify challenge belongs to this trainer
  async function findOwnedChallenge(trainerId: string, challengeId: string) {
    return db.query.challenges.findFirst({
      where: and(
        eq(challenges.id, challengeId),
        eq(challenges.trainerId, trainerId),
      ),
      with: {
        exercise: {
          with: { bodyPart: true, media: true },
        },
      },
    })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /clients/:clientId/challenges — List challenges for a client
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/clients/:clientId/challenges', {
    schema: {
      tags:     ['Challenges'],
      summary:  'List challenges for a client',
      security: [{ bearerAuth: [] }],
      description: 'Returns all challenges for a client, ordered by status (active first) then deadline. Optionally filter by status.',
      params: z.object({ clientId: z.string().uuid() }),
      querystring: z.object({
        status: z.enum(['active', 'completed', 'expired', 'cancelled']).optional(),
      }),
      response: {
        200: ChallengeListResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const { status }   = request.query as { status?: string }
    const trainerId    = request.trainer.trainerId

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    const rows = await db.query.challenges.findMany({
      where: status
        ? and(eq(challenges.clientId, clientId), eq(challenges.status, status as 'active'))
        : eq(challenges.clientId, clientId),
      with: {
        exercise: {
          with: { bodyPart: true, media: true },
        },
      },
      orderBy: [desc(challenges.createdAt)],
    })

    // Sort: active first, then by deadline
    const sorted = rows.sort((a, b) => {
      const statusOrder: Record<string, number> = { active: 0, completed: 1, expired: 2, cancelled: 3 }
      const aDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
      if (aDiff !== 0) return aDiff
      return a.deadline.localeCompare(b.deadline)
    })

    return reply.send(sorted.map((c) => serializeChallenge(c)))
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /clients/:clientId/challenges — Create a challenge
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/clients/:clientId/challenges', {
    schema: {
      tags:     ['Challenges'],
      summary:  'Create a challenge',
      security: [{ bearerAuth: [] }],
      description: `Create a measurable goal with a deadline for a client.

**metricType** determines how progress is tracked:
| Type | Auto-detected from |
|---|---|
| \`weight_lifted\` | Set logged for matched exercise — max weight |
| \`reps_achieved\` | Set logged for matched exercise — max reps |
| \`distance\` | Set logged for matched exercise — max distance |
| \`duration\` | Set logged for matched exercise — max duration |
| \`sessions_completed\` | Session completed for the client |
| \`qualitative\` | Manual progress updates only |

**exerciseId** is required for exercise-specific metric types and optional for sessions_completed/qualitative.`,
      params: z.object({ clientId: z.string().uuid() }),
      body:   CreateChallengeSchema,
      response: {
        201: ChallengeResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const trainerId    = request.trainer.trainerId
    const body         = request.body as z.infer<typeof CreateChallengeSchema>

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    // Validate: exercise-specific metrics require exerciseId
    const exerciseMetrics = ['weight_lifted', 'reps_achieved', 'distance', 'duration']
    if (exerciseMetrics.includes(body.metricType) && !body.exerciseId) {
      return reply.status(400).send({
        error: `exerciseId is required for ${body.metricType} challenges`,
      })
    }

    try {
      const [challenge] = await db
        .insert(challenges)
        .values({
          clientId,
          trainerId,
          ...body,
        })
        .returning()

      if (!challenge) return reply.status(500).send({ error: 'Failed to create challenge' })

      // Fetch with exercise join for response
      const full = await findOwnedChallenge(trainerId, challenge.id)
      if (!full) return reply.status(500).send({ error: 'Failed to create challenge' })

      return reply.status(201).send(serializeChallenge(full))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to create challenge' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /challenges/:id — Update a challenge
  // ──────────────────────────────────────────────────────────────────────────
  app.patch('/challenges/:id', {
    schema: {
      tags:     ['Challenges'],
      summary:  'Update a challenge',
      security: [{ bearerAuth: [] }],
      description: 'Update challenge fields. Use `currentValue` for manual progress updates (qualitative challenges). Use `status` to manually complete or cancel.',
      params:   UuidParamSchema,
      body:     UpdateChallengeSchema,
      response: {
        200: ChallengeResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body   = request.body as z.infer<typeof UpdateChallengeSchema>
    const trainerId = request.trainer.trainerId

    try {
      // Build update payload
      const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() }

      // If manually completing via currentValue reaching target, set status + completedAt
      if (body.currentValue != null) {
        const existing = await findOwnedChallenge(trainerId, id)
        if (!existing) return reply.status(404).send({ error: 'Challenge not found' })

        if (body.currentValue >= existing.targetValue && existing.status === 'active') {
          updateData.status      = 'completed'
          updateData.completedAt = new Date()
        }
      }

      // If explicitly setting status to completed, set completedAt
      if (body.status === 'completed') {
        updateData.completedAt = new Date()
      }

      const [updated] = await db
        .update(challenges)
        .set(updateData as Partial<typeof challenges.$inferInsert>)
        .where(and(eq(challenges.id, id), eq(challenges.trainerId, trainerId)))
        .returning()

      if (!updated) return reply.status(404).send({ error: 'Challenge not found' })

      // Fetch with exercise join
      const full = await findOwnedChallenge(trainerId, updated.id)
      if (!full) return reply.status(500).send({ error: 'Failed to update challenge' })

      return reply.send(serializeChallenge(full))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update challenge' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /challenges/:id — Cancel a challenge (soft)
  // ──────────────────────────────────────────────────────────────────────────
  app.delete('/challenges/:id', {
    schema: {
      tags:     ['Challenges'],
      summary:  'Cancel a challenge',
      security: [{ bearerAuth: [] }],
      description: 'Sets the challenge status to `cancelled`. The record is preserved for history.',
      params:   UuidParamSchema,
      response: {
        200: ChallengeResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id }    = request.params as z.infer<typeof UuidParamSchema>
    const trainerId = request.trainer.trainerId

    try {
      const [updated] = await db
        .update(challenges)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(challenges.id, id), eq(challenges.trainerId, trainerId)))
        .returning()

      if (!updated) return reply.status(404).send({ error: 'Challenge not found' })

      const full = await findOwnedChallenge(trainerId, updated.id)
      if (!full) return reply.status(500).send({ error: 'Failed to cancel challenge' })

      return reply.send(serializeChallenge(full))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to cancel challenge' })
    }
  })
}
