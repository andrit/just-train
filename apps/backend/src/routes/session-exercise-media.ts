import { routeLog } from '../lib/logger'
// ------------------------------------------------------------
// routes/session-exercise-media.ts — Form check clip endpoints (v2.12.0)
//
// Routes:
//   POST   /api/v1/session-exercises/:id/media → upload clip/photo
//   DELETE /api/v1/session-exercise-media/:id  → delete media
//   GET    /api/v1/session-exercises/:id/media → list media for exercise
//
// UPLOAD FLOW:
//   Same multipart flow as exercise and snapshot media.
//   Video capped at 30 seconds (validated client-side, enforced here).
//
// OWNERSHIP:
//   session_exercise → workout → session → trainer chain.
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { z }                    from 'zod'
import { db, sessionExercises, sessionExerciseMedia } from '../db'
import { eq }                   from 'drizzle-orm'
import { authenticate }         from '../middleware/authenticate'
import {
  SessionExerciseMediaResponseSchema,
  SessionExerciseMediaListResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
} from '@trainer-app/shared'
import {
  uploadBuffer,
  deleteByPublicId,
  validateMediaFile,
  sessionExerciseFolder,
} from '../services/cloudinary.service'

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_VIDEO_DURATION_SECONDS = 30

// ── Serializer ──────────────────────────────────────────────────────────────

function serializeMedia(m: typeof sessionExerciseMedia.$inferSelect) {
  return {
    id:                 m.id,
    sessionExerciseId:  m.sessionExerciseId,
    mediaType:          m.mediaType,
    cloudinaryUrl:      m.cloudinaryUrl,
    cloudinaryPublicId: m.cloudinaryPublicId,
    durationSeconds:    m.durationSeconds ?? null,
    caption:            m.caption ?? null,
    createdAt:          m.createdAt.toISOString(),
  }
}

// ── Route plugin ────────────────────────────────────────────────────────────

export async function sessionExerciseMediaRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('preHandler', authenticate)

  // Helper: verify session exercise belongs to this trainer.
  // Returns the full chain (sessionExercise + workout + session) for folder path.
  async function findOwnedSessionExercise(trainerId: string, sessionExerciseId: string) {
    const se = await db.query.sessionExercises.findFirst({
      where: eq(sessionExercises.id, sessionExerciseId),
      with: {
        workout: {
          with: {
            session: true,
          },
        },
      },
    })
    if (!se || se.workout?.session?.trainerId !== trainerId) return null
    return se
  }

  // Helper: verify session exercise media belongs to this trainer.
  async function findOwnedMedia(trainerId: string, mediaId: string) {
    const media = await db.query.sessionExerciseMedia.findFirst({
      where: eq(sessionExerciseMedia.id, mediaId),
      with: {
        sessionExercise: {
          with: {
            workout: {
              with: {
                session: true,
              },
            },
          },
        },
      },
    })
    if (!media || media.sessionExercise?.workout?.session?.trainerId !== trainerId) return null
    return media
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /session-exercises/:id/media — Upload a form check clip or photo
  //
  // Accepts: multipart/form-data with a single file field named "file"
  // Optional query: caption
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/session-exercises/:id/media', {
    schema: {
      tags:     ['Session Exercise Media'],
      summary:  'Upload form check clip or photo',
      security: [{ bearerAuth: [] }],
      description: `Upload a photo or short video clip for a session exercise.

**Supported:** Images (JPEG, PNG, WebP — 10 MB) and video (MP4, WebM, MOV — 100 MB, max 30 seconds).

Video duration is enforced server-side. The upload runs in the background during a live session — it never blocks the training flow.`,
      params:   UuidParamSchema,
      response: {
        201: SessionExerciseMediaResponseSchema,
        400: ErrorResponseSchema.describe('Invalid file type, size, or video too long'),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema.describe('Session exercise not found'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: sessionExerciseId } = request.params as z.infer<typeof UuidParamSchema>
    const query = request.query as Record<string, string>

    // Verify ownership
    const se = await findOwnedSessionExercise(request.trainer.trainerId, sessionExerciseId)
    if (!se) {
      return reply.status(404).send({ error: 'Session exercise not found' })
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

    // Validate file type and size
    const validationError = validateMediaFile(mimeType, fileSize)
    if (validationError) {
      return reply.status(400).send({ error: validationError })
    }

    try {
      const session = se.workout?.session
      const clientId  = session?.clientId ?? ''
      const sessionId = session?.id ?? ''

      const uploaded = await uploadBuffer(
        fileBuffer,
        sessionExerciseFolder(clientId, sessionId, sessionExerciseId),
        mimeType,
      )

      // For video, Cloudinary returns duration in the upload response.
      // We also accept a client-provided duration via query param as a fallback.
      const durationSeconds = uploaded.mediaType === 'video'
        ? (Number(query['durationSeconds']) || null)
        : null

      // Enforce 30-second cap (server-side safety net)
      if (durationSeconds !== null && durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
        // Clean up the uploaded file from Cloudinary
        await deleteByPublicId(uploaded.publicId, 'video')
        return reply.status(400).send({
          error: `Video exceeds ${MAX_VIDEO_DURATION_SECONDS}-second limit (${durationSeconds}s). Trim the clip and try again.`,
        })
      }

      const [media] = await db
        .insert(sessionExerciseMedia)
        .values({
          sessionExerciseId,
          mediaType:          uploaded.mediaType,
          cloudinaryUrl:      uploaded.url,
          cloudinaryPublicId: uploaded.publicId,
          durationSeconds,
          caption:            query['caption'] ?? null,
        })
        .returning()

      if (!media) return reply.status(500).send({ error: 'Upload failed' })

      return reply.status(201).send(serializeMedia(media))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Upload failed' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /session-exercise-media/:id — Delete from Cloudinary + DB
  // ──────────────────────────────────────────────────────────────────────────
  app.delete('/session-exercise-media/:id', {
    schema: {
      tags:     ['Session Exercise Media'],
      summary:  'Delete form check media',
      security: [{ bearerAuth: [] }],
      description: 'Deletes a form check clip or photo from both Cloudinary and the database.',
      params:   UuidParamSchema,
      response: {
        204: z.null().describe('Media deleted'),
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
      await deleteByPublicId(media.cloudinaryPublicId, media.mediaType)

      await db
        .delete(sessionExerciseMedia)
        .where(eq(sessionExerciseMedia.id, mediaId))

      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to delete media' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /session-exercises/:id/media — List media for an exercise instance
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/session-exercises/:id/media', {
    schema: {
      tags:     ['Session Exercise Media'],
      summary:  'List form check media',
      security: [{ bearerAuth: [] }],
      description: 'Returns all media (clips and photos) attached to a session exercise, ordered by creation date.',
      params:   UuidParamSchema,
      response: {
        200: SessionExerciseMediaListResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: sessionExerciseId } = request.params as z.infer<typeof UuidParamSchema>

    // Verify ownership
    const se = await findOwnedSessionExercise(request.trainer.trainerId, sessionExerciseId)
    if (!se) {
      return reply.status(404).send({ error: 'Session exercise not found' })
    }

    const media = await db
      .select()
      .from(sessionExerciseMedia)
      .where(eq(sessionExerciseMedia.sessionExerciseId, sessionExerciseId))

    return reply.send(media.map(serializeMedia))
  })
}
