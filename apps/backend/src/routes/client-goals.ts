// ------------------------------------------------------------
// routes/client-goals.ts — Client Goal endpoints (Phase 3C)
//
// Goals are tracked as a timestamped history, not a single field.
// This enables: goal arc narratives in reports, phase-aware filtering,
// and the "then vs. now" progression story.
//
// Routes:
//   GET    /api/v1/clients/:clientId/goals           → list all goals
//   POST   /api/v1/clients/:clientId/goals           → create a goal
//   PATCH  /api/v1/clients/:clientId/goals/:id       → update / mark achieved
//   DELETE /api/v1/clients/:clientId/goals/:id       → hard-delete (rare — goals are history)
//
// Ownership: clientId must belong to the authenticated trainer.
// All queries include trainerId via client join to prevent cross-trainer access.
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { db, clients, clientGoals } from '../db'
import { eq, and, desc }            from 'drizzle-orm'
import { authenticate }             from '../middleware/authenticate'
import {
  CreateClientGoalSchema,
  UpdateClientGoalSchema,
  ClientGoalResponseSchema,
  ClientGoalListResponseSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'
import { z } from 'zod'

export async function clientGoalRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate)

  // ── Shared ownership check helper ─────────────────────────────────────────
  // Verifies the clientId param belongs to the authenticated trainer.
  // Returns the client row or null if not found / not owned.
  async function findOwnedClient(trainerId: string, clientId: string) {
    return db.query.clients.findFirst({
      where: and(
        eq(clients.id, clientId),
        eq(clients.trainerId, trainerId),
        eq(clients.active, true),
      ),
    })
  }

  // ────────────────────────────────────────────────────────────────────────
  // GET /clients/:clientId/goals
  // ────────────────────────────────────────────────────────────────────────
  app.get('/clients/:clientId/goals', {
    schema: {
      tags: ['Client Goals'],
      summary: 'List client goals',
      description: 'Returns all goals for a client ordered by setAt descending (most recent first). Includes achieved and in-progress goals.',
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid() }),
      response: {
        200: ClientGoalListResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const trainerId    = request.trainer.trainerId

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    const goals = await db
      .select()
      .from(clientGoals)
      .where(eq(clientGoals.clientId, clientId))
      .orderBy(desc(clientGoals.setAt))

    return reply.send(goals.map(serializeGoal))
  })

  // ────────────────────────────────────────────────────────────────────────
  // POST /clients/:clientId/goals
  // ────────────────────────────────────────────────────────────────────────
  app.post('/clients/:clientId/goals', {
    schema: {
      tags: ['Client Goals'],
      summary: 'Create a client goal',
      description: `Records a new goal for the client. Goals are timestamped history — previous goals are preserved when a client changes direction.

**progressionState** defaults to the client's current state if not provided.`,
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid() }),
      body:   CreateClientGoalSchema,
      response: {
        201: ClientGoalResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const trainerId    = request.trainer.trainerId
    const body         = request.body as z.infer<typeof CreateClientGoalSchema>

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    try {
      const [goal] = await db
        .insert(clientGoals)
        .values({
          clientId,
          goal:             body.goal,
          // Default to the client's current progressionState if caller didn't specify
          progressionState: body.progressionState ?? client.progressionState,
          setAt:            new Date(),
        })
        .returning()

      if (!goal) return reply.status(500).send({ error: 'Failed to create goal' })
      return reply.status(201).send(serializeGoal(goal))
    } catch (error) {
      ;app.log.error(error instanceof Error ? error.message : String(error))
      return reply.status(500).send({ error: 'Failed to create goal' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /clients/:clientId/goals/:id
  // ────────────────────────────────────────────────────────────────────────
  app.patch('/clients/:clientId/goals/:id', {
    schema: {
      tags: ['Client Goals'],
      summary: 'Update a goal',
      description: `Update a goal's text or mark it as achieved.

**achievedAt:** Set to an ISO datetime to mark achieved. Set to \`null\` to un-achieve (e.g. goal needs to be revised).`,
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid(), id: z.string().uuid() }),
      body:   UpdateClientGoalSchema,
      response: {
        200: ClientGoalResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId, id } = request.params as { clientId: string; id: string }
    const trainerId        = request.trainer.trainerId
    const body             = request.body as z.infer<typeof UpdateClientGoalSchema>

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    try {
      const updates: Partial<typeof clientGoals.$inferInsert> = {}
      if (body.goal       !== undefined) updates.goal       = body.goal
      if (body.achievedAt !== undefined) {
        updates.achievedAt = body.achievedAt ? new Date(body.achievedAt) : null
      }

      const [updated] = await db
        .update(clientGoals)
        .set(updates)
        .where(and(eq(clientGoals.id, id), eq(clientGoals.clientId, clientId)))
        .returning()

      if (!updated) return reply.status(404).send({ error: 'Goal not found' })

      return reply.send(serializeGoal(updated))
    } catch (error) {
      ;app.log.error(error instanceof Error ? error.message : String(error))
      return reply.status(500).send({ error: 'Failed to update goal' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // DELETE /clients/:clientId/goals/:id
  // ────────────────────────────────────────────────────────────────────────
  app.delete('/clients/:clientId/goals/:id', {
    schema: {
      tags: ['Client Goals'],
      summary: 'Delete a goal',
      description: 'Hard-deletes a goal. Prefer marking as achieved over deletion — goals are part of the client history used in reports. Only delete goals created in error.',
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid(), id: z.string().uuid() }),
      response: {
        204: z.null().describe('Goal deleted'),
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId, id } = request.params as { clientId: string; id: string }
    const trainerId        = request.trainer.trainerId

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    const [deleted] = await db
      .delete(clientGoals)
      .where(and(eq(clientGoals.id, id), eq(clientGoals.clientId, clientId)))
      .returning()

    if (!deleted) return reply.status(404).send({ error: 'Goal not found' })

    return reply.status(204).send()
  })
}

// ── Serializer ────────────────────────────────────────────────────────────────
function serializeGoal(g: typeof clientGoals.$inferSelect) {
  return {
    id:               g.id,
    clientId:         g.clientId,
    goal:             g.goal,
    progressionState: g.progressionState,
    setAt:            g.setAt.toISOString(),
    achievedAt:       g.achievedAt?.toISOString() ?? null,
    createdAt:        g.createdAt.toISOString(),
  }
}
