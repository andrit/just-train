import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/snapshot-media.ts — Progress photo endpoints (v2.12.0)
//
// Routes:
//   POST   /api/v1/snapshots/:id/media          → upload progress photo
//   PATCH  /api/v1/snapshot-media/:id            → update caption/shareable
//   DELETE /api/v1/snapshot-media/:id            → delete a photo
//   GET    /api/v1/clients/:clientId/progress-photos → all photos grouped by snapshot date
//
// UPLOAD FLOW:
//   Same as exercise media — multipart form POST →
//   @fastify/multipart buffers → validateMediaFile() →
//   uploadBuffer() to Cloudinary → DB insert into snapshot_media
//
// OWNERSHIP:
//   All routes verify the snapshot/client belongs to the requesting
//   trainer via the snapshot → client → trainer chain.
//
// OPT-OUT:
//   If client.progressPhotosOptedOut = true, upload is rejected with
//   a 403. The frontend should hide the photo capture UI, but the
//   backend enforces it as a safety net.
// ------------------------------------------------------------

import '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import { z }                    from 'zod'
import { db, clientSnapshots, snapshotMedia, clients } from '../db'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { authenticate }         from '../middleware/authenticate'
import {
  SnapshotMediaResponseSchema,
  ProgressPhotoGroupListResponseSchema,
  UpdateSnapshotMediaSchema,
  ErrorResponseSchema,
  UuidParamSchema,
} from '@trainer-app/shared'
import {
  uploadBuffer,
  deleteByPublicId,
  validateMediaFile,
  snapshotFolder,
} from '../services/cloudinary.service'

// ── Serializer ──────────────────────────────────────────────────────────────

function serializeSnapshotMedia(m: typeof snapshotMedia.$inferSelect) {
  return {
    id:                 m.id,
    snapshotId:         m.snapshotId,
    pose:               m.pose,
    cloudinaryUrl:      m.cloudinaryUrl,
    cloudinaryPublicId: m.cloudinaryPublicId,
    width:              m.width  ?? null,
    height:             m.height ?? null,
    caption:            m.caption ?? null,
    shareable:          m.shareable,
    orderIndex:         m.orderIndex,
    createdAt:          m.createdAt.toISOString(),
  }
}

// ── Route plugin ────────────────────────────────────────────────────────────

export async function snapshotMediaRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('preHandler', authenticate)

  // Helper: verify snapshot belongs to this trainer, return snapshot + client
  async function findOwnedSnapshot(trainerId: string, snapshotId: string) {
    const snapshot = await db.query.clientSnapshots.findFirst({
      where: eq(clientSnapshots.id, snapshotId),
      with:  { client: true },
    })
    if (!snapshot || snapshot.client?.trainerId !== trainerId) return null
    return snapshot
  }

  // Helper: verify snapshot media belongs to this trainer
  async function findOwnedMedia(trainerId: string, mediaId: string) {
    const media = await db.query.snapshotMedia.findFirst({
      where: eq(snapshotMedia.id, mediaId),
      with:  { snapshot: { with: { client: true } } },
    })
    if (!media || media.snapshot?.client?.trainerId !== trainerId) return null
    return media
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /snapshots/:id/media — Upload a progress photo
  //
  // Accepts: multipart/form-data with a single file field named "file"
  // Query params: pose (required), caption (optional)
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/snapshots/:id/media', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    schema: {
      tags:     ['Snapshot Media'],
      summary:  'Upload a progress photo',
      security: [{ bearerAuth: [] }],
      description: `Upload a progress photo for a client snapshot.

**Images only** — video is for form check clips (session exercise media), not progress photos.

**Pose** is required as a query parameter: \`front\`, \`side_left\`, \`side_right\`, \`back\`, or \`custom\`.

**Opt-out**: If the client has opted out of progress photos, this returns 403.`,
      params:   UuidParamSchema,
      response: {
        201: SnapshotMediaResponseSchema,
        400: ErrorResponseSchema.describe('Invalid file type, size, or missing pose'),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema.describe('Client has opted out of progress photos'),
        404: ErrorResponseSchema.describe('Snapshot not found'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: snapshotId } = request.params as z.infer<typeof UuidParamSchema>
    const query = request.query as Record<string, string>
    const pose = query['pose']

    // Validate pose
    const poseValues = ['front', 'side_left', 'side_right', 'back', 'custom'] as const
    if (!pose || !poseValues.includes(pose as typeof poseValues[number])) {
      return reply.status(400).send({
        error: `Missing or invalid pose. Must be one of: ${poseValues.join(', ')}`,
      })
    }

    // Verify ownership
    const snapshot = await findOwnedSnapshot(request.trainer.trainerId, snapshotId)
    if (!snapshot) {
      return reply.status(404).send({ error: 'Snapshot not found' })
    }

    // Check client opt-out
    if (snapshot.client?.progressPhotosOptedOut) {
      return reply.status(403).send({ error: 'Client has opted out of progress photos' })
    }

    // Parse multipart upload
    let fileBuffer: Buffer
    let mimeType:   string
    let fileSize:   number

    try {
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({ error: 'No file provided. Send a multipart/form-data request with a "file" field.' })
      }
      fileBuffer = await data.toBuffer()
      mimeType   = data.mimetype
      fileSize   = fileBuffer.length
    } catch {
      return reply.status(400).send({ error: 'Failed to parse upload. Ensure the request is multipart/form-data.' })
    }

    // Progress photos are images only
    if (mimeType.startsWith('video/')) {
      return reply.status(400).send({ error: 'Progress photos must be images. Video is for form check clips (session exercise media).' })
    }

    // Validate file
    const validationError = validateMediaFile(mimeType, fileSize)
    if (validationError) {
      return reply.status(400).send({ error: validationError })
    }

    try {
      const clientId = snapshot.client?.id ?? snapshot.clientId
      const uploaded = await uploadBuffer(
        fileBuffer,
        snapshotFolder(clientId, snapshotId),
        mimeType,
      )

      // Count existing media for orderIndex
      const existing = await db
        .select()
        .from(snapshotMedia)
        .where(eq(snapshotMedia.snapshotId, snapshotId))

      const [media] = await db
        .insert(snapshotMedia)
        .values({
          snapshotId,
          pose:               pose as typeof poseValues[number],
          cloudinaryUrl:      uploaded.url,
          cloudinaryPublicId: uploaded.publicId,
          width:              uploaded.width,
          height:             uploaded.height,
          caption:            query['caption'] ?? null,
          shareable:          false,
          orderIndex:         existing.length,
        })
        .returning()

      if (!media) return reply.status(500).send({ error: 'Upload failed' })

      return reply.status(201).send(serializeSnapshotMedia(media))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Upload failed' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /snapshot-media/:id — Update caption or shareable flag
  // ──────────────────────────────────────────────────────────────────────────
  app.patch('/snapshot-media/:id', {
    schema: {
      tags:     ['Snapshot Media'],
      summary:  'Update progress photo',
      security: [{ bearerAuth: [] }],
      description: 'Update caption, shareable flag, or pose on a progress photo.',
      params:   UuidParamSchema,
      body:     UpdateSnapshotMediaSchema,
      response: {
        200: SnapshotMediaResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: mediaId } = request.params as z.infer<typeof UuidParamSchema>
    const body = request.body as z.infer<typeof UpdateSnapshotMediaSchema>

    const media = await findOwnedMedia(request.trainer.trainerId, mediaId)
    if (!media) {
      return reply.status(404).send({ error: 'Media not found' })
    }

    try {
      const [updated] = await db
        .update(snapshotMedia)
        .set(body as Partial<typeof snapshotMedia.$inferInsert>)
        .where(eq(snapshotMedia.id, mediaId))
        .returning()

      if (!updated) return reply.status(404).send({ error: 'Media not found' })

      return reply.send(serializeSnapshotMedia(updated))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update media' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /snapshot-media/:id — Delete from Cloudinary + DB
  // ──────────────────────────────────────────────────────────────────────────
  app.delete('/snapshot-media/:id', {
    schema: {
      tags:     ['Snapshot Media'],
      summary:  'Delete a progress photo',
      security: [{ bearerAuth: [] }],
      description: 'Deletes a progress photo from both Cloudinary and the database.',
      params:   UuidParamSchema,
      response: {
        204: z.null().describe('Photo deleted'),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: mediaId } = request.params as z.infer<typeof UuidParamSchema>

    const media = await findOwnedMedia(request.trainer.trainerId, mediaId)
    if (!media) {
      return reply.status(404).send({ error: 'Media not found' })
    }

    try {
      // Delete from Cloudinary first
      await deleteByPublicId(media.cloudinaryPublicId, 'image')

      // Delete from DB
      await db
        .delete(snapshotMedia)
        .where(eq(snapshotMedia.id, mediaId))

      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to delete media' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /clients/:clientId/progress-photos — All photos grouped by snapshot
  //
  // Returns photos bucketed by snapshot date so the comparison UI
  // doesn't need to load full body comp data per snapshot.
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/clients/:clientId/progress-photos', {
    schema: {
      tags:     ['Snapshot Media'],
      summary:  'List progress photos by snapshot',
      security: [{ bearerAuth: [] }],
      description: `Returns all progress photos for a client, grouped by snapshot date (most recent first). Each group contains the snapshot ID, capture date, and photo array. Powers the comparison timeline without loading full body comp data.`,
      params: z.object({ clientId: z.string().uuid() }),
      response: {
        200: ProgressPhotoGroupListResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { clientId } = request.params as { clientId: string }
    const trainerId    = request.trainer.trainerId

    // Verify client ownership
    const client = await db.query.clients.findFirst({
      where: and(
        eq(clients.id, clientId),
        eq(clients.trainerId, trainerId),
      ),
    })
    if (!client) return reply.status(404).send({ error: 'Client not found' })

    // Fetch all snapshots for this client (ordered most recent first)
    const snapshots = await db
      .select()
      .from(clientSnapshots)
      .where(eq(clientSnapshots.clientId, clientId))
      .orderBy(desc(clientSnapshots.capturedAt))

    const snapshotIds = snapshots.map(s => s.id)
    if (snapshotIds.length === 0) return reply.send([])

    // Fetch all media for all snapshots in one query
    const allMedia = await db
      .select()
      .from(snapshotMedia)
      .where(inArray(snapshotMedia.snapshotId, snapshotIds))

    // Group by snapshot — preserve snapshot date order
    const mediaBySnapshot = new Map<string, (typeof allMedia)[number][]>()
    for (const m of allMedia) {
      const list = mediaBySnapshot.get(m.snapshotId) ?? []
      list.push(m)
      mediaBySnapshot.set(m.snapshotId, list)
    }

    // Build response — only include snapshots that have photos
    const groups = snapshots
      .filter(s => mediaBySnapshot.has(s.id))
      .map(s => ({
        snapshotId: s.id,
        capturedAt: s.capturedAt.toISOString(),
        photos:     (mediaBySnapshot.get(s.id) ?? []).map(serializeSnapshotMedia),
      }))

    return reply.send(groups)
  })
}
