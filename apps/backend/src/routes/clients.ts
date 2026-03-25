// ------------------------------------------------------------
// routes/clients.ts — Client CRUD endpoints
//
// Routes:
//   GET    /api/v1/clients/self    → get the trainer's self-client (isSelf=true)
//   GET    /api/v1/clients         → list all active external clients
//   GET    /api/v1/clients/:id     → get single client
//   POST   /api/v1/clients         → create external client
//   PATCH  /api/v1/clients/:id     → update client
//   DELETE /api/v1/clients/:id     → soft-delete (active = false)
//
// PHASE 3C ADDITIONS:
//   - GET /clients/self — returns isSelf=true client (auto-created at registration)
//   - List excludes isSelf (self accessed via /clients/self)
//   - isSelf guard on DELETE — self-client cannot be deactivated
//   - serializeClient() — consistent null-coercion for all nullable fields
//   - All new fields (primaryFocus, progressionState, etc.) handled
//
// BILLING NOTE (not yet active):
//   POST /clients will check subscriptionTier in the SaaS phase.
//   free tier → only isSelf allowed → 402 if creating external client.
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { db, clients }          from '../db'
import { eq, and }              from 'drizzle-orm'
import { authenticate }         from '../middleware/authenticate'
import {
  CreateClientSchema,
  UpdateClientSchema,
  ClientResponseSchema,
  ClientListResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
} from '@trainer-app/shared'
import { z } from 'zod'

export async function clientRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('preHandler', authenticate)

  // ────────────────────────────────────────────────────────────────────────
  // GET /clients/self
  // ────────────────────────────────────────────────────────────────────────
  app.get('/clients/self', {
    schema: {
      tags: ['Clients'],
      summary: 'Get self-client',
      description: `Returns the trainer's own client record (the "train yourself" profile). Auto-created at registration. Has \`isSelf: true\` and behaves identically to any other client — sessions, goals, snapshots, and reports all work the same.`,
      security: [{ bearerAuth: [] }],
      response: {
        200: ClientResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema.describe('Should never happen — created at registration'),
      },
    },
  }, async (request, reply) => {
    const trainerId = request.trainer.trainerId
    const self = await db.query.clients.findFirst({
      where: and(
        eq(clients.trainerId, trainerId),
        eq(clients.isSelf, true),
        eq(clients.active, true),
      ),
    })
    if (!self) {
      ;app.log.error(`Self-client not found for trainerId=${trainerId} — possible data integrity issue`)
      return reply.status(404).send({ error: 'Self-client not found. Contact support.' })
    }
    return reply.send(serializeClient(self))
  })

  // ────────────────────────────────────────────────────────────────────────
  // GET /clients
  // ────────────────────────────────────────────────────────────────────────
  app.get('/clients', {
    schema: {
      tags: ['Clients'],
      summary: 'List all clients',
      description: 'Returns all active external clients ordered by name. Self-client excluded — use GET /clients/self.',
      security: [{ bearerAuth: [] }],
      response: {
        200: ClientListResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const result = await db
        .select()
        .from(clients)
        .where(and(
          eq(clients.trainerId, request.trainer.trainerId),
          eq(clients.active, true),
          eq(clients.isSelf, false),
        ))
        .orderBy(clients.name)
      return reply.send(result.map(serializeClient))
    } catch (error) {
      ;app.log.error(error)
      return reply.status(500).send({ error: 'Failed to fetch clients' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // GET /clients/:id
  // ────────────────────────────────────────────────────────────────────────
  app.get('/clients/:id', {
    schema: {
      tags: ['Clients'],
      summary: 'Get a client',
      description: 'Returns a single client by ID. Works for both external clients and the self-client.',
      security: [{ bearerAuth: [] }],
      params: UuidParamSchema,
      response: {
        200: ClientResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    try {
      const result = await db.query.clients.findFirst({
        where: and(eq(clients.id, id), eq(clients.trainerId, request.trainer.trainerId)),
      })
      if (!result) return reply.status(404).send({ error: 'Client not found' })
      return reply.send(serializeClient(result))
    } catch (error) {
      ;app.log.error(error)
      return reply.status(500).send({ error: 'Failed to fetch client' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // POST /clients
  // BILLING GATE (deferred — not yet active):
  //   if trainer.subscriptionTier === 'free' → 402 SUBSCRIPTION_REQUIRED
  // ────────────────────────────────────────────────────────────────────────
  app.post('/clients', {
    schema: {
      tags: ['Clients'],
      summary: 'Create a client',
      description: 'Creates a new external client. Only `name` is required. Phase 3C fields: `primaryFocus`, `secondaryFocus`, `progressionState`, `startDate`, `caloricGoal`, `nutritionNotes`.',
      security: [{ bearerAuth: [] }],
      body: CreateClientSchema,
      response: {
        201: ClientResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof CreateClientSchema>
    try {
      const [newClient] = await db
        .insert(clients)
        .values({ ...body, trainerId: request.trainer.trainerId, isSelf: false })
        .returning()
      if (!newClient) return reply.status(500).send({ error: 'Failed to create client' })
      return reply.status(201).send(serializeClient(newClient))
    } catch (error) {
      ;app.log.error(error)
      return reply.status(500).send({ error: 'Failed to create client' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /clients/:id
  // ────────────────────────────────────────────────────────────────────────
  app.patch('/clients/:id', {
    schema: {
      tags: ['Clients'],
      summary: 'Update a client',
      description: 'Partially updates a client. Only provided fields are changed. Works for self-client too.',
      security: [{ bearerAuth: [] }],
      params: UuidParamSchema,
      body:   UpdateClientSchema,
      response: {
        200: ClientResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    const body   = request.body   as z.infer<typeof UpdateClientSchema>
    try {
      const [updated] = await db
        .update(clients)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(clients.id, id), eq(clients.trainerId, request.trainer.trainerId)))
        .returning()
      if (!updated) return reply.status(404).send({ error: 'Client not found' })
      return reply.send(serializeClient(updated))
    } catch (error) {
      ;app.log.error(error)
      return reply.status(500).send({ error: 'Failed to update client' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // DELETE /clients/:id — soft delete
  // Self-client is protected — cannot be deactivated.
  // ────────────────────────────────────────────────────────────────────────
  app.delete('/clients/:id', {
    schema: {
      tags: ['Clients'],
      summary: 'Deactivate a client',
      description: 'Soft-deletes a client. Session history is preserved. Self-client (`isSelf: true`) cannot be deactivated.',
      security: [{ bearerAuth: [] }],
      params: UuidParamSchema,
      response: {
        204: z.null().describe('Client successfully deactivated'),
        400: ErrorResponseSchema.describe('Cannot deactivate self-client'),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as z.infer<typeof UuidParamSchema>
    try {
      const existing = await db.query.clients.findFirst({
        where: and(eq(clients.id, id), eq(clients.trainerId, request.trainer.trainerId)),
      })
      if (!existing) return reply.status(404).send({ error: 'Client not found' })
      if (existing.isSelf) {
        return reply.status(400).send({ error: 'The self-client cannot be deactivated', code: 'SELF_CLIENT_PROTECTED' })
      }
      const [updated] = await db
        .update(clients)
        .set({ active: false, updatedAt: new Date() })
        .where(and(eq(clients.id, id), eq(clients.trainerId, request.trainer.trainerId)))
        .returning()
      if (!updated) return reply.status(404).send({ error: 'Client not found' })
      return reply.status(204).send()
    } catch (error) {
      ;app.log.error(error)
      return reply.status(500).send({ error: 'Failed to deactivate client' })
    }
  })
}

// ── Serializer ────────────────────────────────────────────────────────────────
function serializeClient(c: typeof clients.$inferSelect) {
  return {
    id:               c.id,
    trainerId:        c.trainerId,
    name:             c.name,
    email:            c.email            ?? null,
    phone:            c.phone            ?? null,
    photoUrl:         c.photoUrl         ?? null,
    dateOfBirth:      c.dateOfBirth      ?? null,
    goals:            c.goals            ?? null,
    notes:            c.notes            ?? null,
    active:           c.active,
    primaryFocus:     c.primaryFocus     ?? null,
    secondaryFocus:   c.secondaryFocus   ?? null,
    progressionState: c.progressionState,
    startDate:        c.startDate        ?? null,
    caloricGoal:      c.caloricGoal      ?? null,
    nutritionNotes:   c.nutritionNotes   ?? null,
    isSelf:           c.isSelf,
    lastActiveAt:     c.lastActiveAt?.toISOString() ?? null,
    weeklySessionTarget: c.weeklySessionTarget,
    show1rmEstimate:     c.show1rmEstimate,
    autoReport:          c.autoReport,
    lastReportSentAt:    c.lastReportSentAt?.toISOString() ?? null,
    createdAt:        c.createdAt.toISOString(),
    updatedAt:        c.updatedAt.toISOString(),
  }
}
