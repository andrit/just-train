// ------------------------------------------------------------
// routes/client-snapshots.ts — Client Snapshot endpoints (Phase 3C)
//
// Snapshots are time-series baseline captures — the raw data behind
// "then vs. now" comparisons in reports and the dashboard.
//
// Capture timing:
//   - Start of assessment (initial baseline)
//   - Each phase transition
//   - Monthly during programming (tied to report cycle)
//   - Any notable change the trainer wants to record
//
// ALL measurement fields are nullable — capture what's available.
// Never block a snapshot because one measurement wasn't taken.
//
// Routes:
//   GET    /api/v1/clients/:clientId/snapshots        → list all snapshots
//   GET    /api/v1/clients/:clientId/snapshots/latest → most recent snapshot
//   GET    /api/v1/clients/:clientId/snapshots/:id    → single snapshot
//   POST   /api/v1/clients/:clientId/snapshots        → create snapshot
//   PATCH  /api/v1/clients/:clientId/snapshots/:id    → update snapshot
//   DELETE /api/v1/clients/:clientId/snapshots/:id    → delete snapshot
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { db, clients, clientSnapshots } from '../db'
import { eq, and, desc }                from 'drizzle-orm'
import { authenticate }                 from '../middleware/authenticate'
import {
  CreateClientSnapshotSchema,
  UpdateClientSnapshotSchema,
  ClientSnapshotResponseSchema,
  ClientSnapshotListResponseSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'
import { z } from 'zod'

export async function clientSnapshotRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('preHandler', authenticate)

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
  // GET /clients/:clientId/snapshots
  // ────────────────────────────────────────────────────────────────────────
  app.get('/clients/:clientId/snapshots', {
    schema: {
      tags: ['Client Snapshots'],
      summary: 'List all snapshots',
      description: 'Returns all snapshots for a client ordered by capturedAt descending (most recent first).',
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid() }),
      response: {
        200: ClientSnapshotListResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const trainerId    = request.trainer.trainerId

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    const snapshots = await db
      .select()
      .from(clientSnapshots)
      .where(eq(clientSnapshots.clientId, clientId))
      .orderBy(desc(clientSnapshots.capturedAt))

    return reply.send(snapshots.map(serializeSnapshot))
  })

  // ────────────────────────────────────────────────────────────────────────
  // GET /clients/:clientId/snapshots/latest
  // ────────────────────────────────────────────────────────────────────────
  app.get('/clients/:clientId/snapshots/latest', {
    schema: {
      tags: ['Client Snapshots'],
      summary: 'Get most recent snapshot',
      description: 'Returns the most recently captured snapshot. Useful for the dashboard "current state" view without fetching the full history.',
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid() }),
      response: {
        200: ClientSnapshotResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const trainerId    = request.trainer.trainerId

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    const snapshot = await db.query.clientSnapshots.findFirst({
      where:   eq(clientSnapshots.clientId, clientId),
      orderBy: desc(clientSnapshots.capturedAt),
    })

    if (!snapshot) return reply.status(404).send({ error: 'No snapshots found for this client' })

    return reply.send(serializeSnapshot(snapshot))
  })

  // ────────────────────────────────────────────────────────────────────────
  // GET /clients/:clientId/snapshots/:id
  // ────────────────────────────────────────────────────────────────────────
  app.get('/clients/:clientId/snapshots/:id', {
    schema: {
      tags: ['Client Snapshots'],
      summary: 'Get a snapshot',
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid(), id: z.string().uuid() }),
      response: {
        200: ClientSnapshotResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId, id } = request.params as { clientId: string; id: string }
    const trainerId        = request.trainer.trainerId

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    const snapshot = await db.query.clientSnapshots.findFirst({
      where: and(eq(clientSnapshots.id, id), eq(clientSnapshots.clientId, clientId)),
    })

    if (!snapshot) return reply.status(404).send({ error: 'Snapshot not found' })

    return reply.send(serializeSnapshot(snapshot))
  })

  // ────────────────────────────────────────────────────────────────────────
  // POST /clients/:clientId/snapshots
  // ────────────────────────────────────────────────────────────────────────
  app.post('/clients/:clientId/snapshots', {
    schema: {
      tags: ['Client Snapshots'],
      summary: 'Create a snapshot',
      description: `Captures a point-in-time baseline for the client.

**All measurement fields are optional** — capture what's available. A snapshot with only subjective scores is perfectly valid.

**progressionState** defaults to the client's current state if not provided.

**capturedAt** defaults to now. Can be backdated if recording a measurement taken offline.`,
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid() }),
      body:   CreateClientSnapshotSchema,
      response: {
        201: ClientSnapshotResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const trainerId    = request.trainer.trainerId
    const body         = request.body as z.infer<typeof CreateClientSnapshotSchema>

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    try {
      const [snapshot] = await db
        .insert(clientSnapshots)
        .values({
          clientId,
          capturedBy:       trainerId,
          progressionState: body.progressionState ?? client.progressionState,
          ...body,
        })
        .returning()

      if (!snapshot) return reply.status(500).send({ error: 'Failed to create snapshot' })
      return reply.status(201).send(serializeSnapshot(snapshot))
    } catch (error) {
      ;app.log.error(error)
      return reply.status(500).send({ error: 'Failed to create snapshot' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // PATCH /clients/:clientId/snapshots/:id
  // ────────────────────────────────────────────────────────────────────────
  app.patch('/clients/:clientId/snapshots/:id', {
    schema: {
      tags: ['Client Snapshots'],
      summary: 'Update a snapshot',
      description: 'Update any fields of an existing snapshot. Useful for adding measurements that weren\'t available when the snapshot was first created.',
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid(), id: z.string().uuid() }),
      body:   UpdateClientSnapshotSchema,
      response: {
        200: ClientSnapshotResponseSchema,
        404: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId, id } = request.params as { clientId: string; id: string }
    const trainerId        = request.trainer.trainerId
    const body             = request.body as z.infer<typeof UpdateClientSnapshotSchema>

    const client = await findOwnedClient(trainerId, clientId)
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    try {
      const [updated] = await db
        .update(clientSnapshots)
        .set(body as Partial<typeof clientSnapshots.$inferInsert>)
        .where(and(eq(clientSnapshots.id, id), eq(clientSnapshots.clientId, clientId)))
        .returning()

      if (!updated) return reply.status(404).send({ error: 'Snapshot not found' })

      return reply.send(serializeSnapshot(updated))
    } catch (error) {
      ;app.log.error(error)
      return reply.status(500).send({ error: 'Failed to update snapshot' })
    }
  })

  // ────────────────────────────────────────────────────────────────────────
  // DELETE /clients/:clientId/snapshots/:id
  // ────────────────────────────────────────────────────────────────────────
  app.delete('/clients/:clientId/snapshots/:id', {
    schema: {
      tags: ['Client Snapshots'],
      summary: 'Delete a snapshot',
      description: 'Deletes a snapshot. Only delete snapshots created in error — snapshots are history and are used in reports.',
      security: [{ bearerAuth: [] }],
      params: z.object({ clientId: z.string().uuid(), id: z.string().uuid() }),
      response: {
        204: z.null().describe('Snapshot deleted'),
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
      .delete(clientSnapshots)
      .where(and(eq(clientSnapshots.id, id), eq(clientSnapshots.clientId, clientId)))
      .returning()

    if (!deleted) return reply.status(404).send({ error: 'Snapshot not found' })

    return reply.status(204).send()
  })
}

// ── Serializer ────────────────────────────────────────────────────────────────
function serializeSnapshot(s: typeof clientSnapshots.$inferSelect) {
  return {
    id:               s.id,
    clientId:         s.clientId,
    capturedAt:       s.capturedAt.toISOString(),
    capturedBy:       s.capturedBy,
    progressionState: s.progressionState,

    weightLbs:         s.weightLbs         ?? null,
    heightIn:          s.heightIn          ?? null,
    bodyFatPct:        s.bodyFatPct        ?? null,
    leanMuscleMassLbs: s.leanMuscleMassLbs ?? null,
    bmi:               s.bmi               ?? null,

    waistIn:       s.waistIn       ?? null,
    hipsIn:        s.hipsIn        ?? null,
    chestIn:       s.chestIn       ?? null,
    bicepsLeftIn:  s.bicepsLeftIn  ?? null,
    bicepsRightIn: s.bicepsRightIn ?? null,
    quadsLeftIn:   s.quadsLeftIn   ?? null,
    quadsRightIn:  s.quadsRightIn  ?? null,
    calvesLeftIn:  s.calvesLeftIn  ?? null,
    calvesRightIn: s.calvesRightIn ?? null,

    restingHeartRateBpm:    s.restingHeartRateBpm    ?? null,
    bloodPressureSystolic:  s.bloodPressureSystolic  ?? null,
    bloodPressureDiastolic: s.bloodPressureDiastolic ?? null,
    vo2MaxEstimate:         s.vo2MaxEstimate         ?? null,

    maxPushUps:           s.maxPushUps           ?? null,
    maxPullUps:           s.maxPullUps           ?? null,
    plankDurationSecs:    s.plankDurationSecs    ?? null,
    mileTimeSecs:         s.mileTimeSecs         ?? null,
    sitAndReachIn:        s.sitAndReachIn        ?? null,
    gripStrengthLeftLbs:  s.gripStrengthLeftLbs  ?? null,
    gripStrengthRightLbs: s.gripStrengthRightLbs ?? null,

    energyLevel:    s.energyLevel    ?? null,
    sleepQuality:   s.sleepQuality   ?? null,
    stressLevel:    s.stressLevel    ?? null,
    mobilityFeel:   s.mobilityFeel   ?? null,
    selfImageScore: s.selfImageScore ?? null,

    trainerNotes: s.trainerNotes ?? null,
    clientNotes:  s.clientNotes  ?? null,
    createdAt:    s.createdAt.toISOString(),
  }
}
