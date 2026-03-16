// ------------------------------------------------------------
// routes/media.ts — Exercise media upload and delete (Phase 3)
//
// Routes:
//   POST   /api/v1/exercises/:id/media         → upload image or video
//   DELETE /api/v1/exercises/:id/media/:mediaId → delete one media item
//   PATCH  /api/v1/exercises/:id/media/:mediaId/primary → set as primary
//
// UPLOAD FLOW:
//   Multipart form POST → @fastify/multipart buffers the file →
//   validateMediaFile() checks type and size →
//   uploadBuffer() streams to Cloudinary →
//   DB insert into exercise_media →
//   Return media record with Cloudinary URL
//
// OWNERSHIP:
//   All routes verify the exercise belongs to request.trainer.trainerId
//   before touching any media. A trainer cannot modify another trainer's
//   exercise media even if they know the exercise and media IDs.
// ------------------------------------------------------------

import type { FastifyInstance } from 'fastify'
import { z }                    from 'zod'
import { db, exercises, exerciseMedia } from '../db'
import { eq, and }              from 'drizzle-orm'
import { authenticate }         from '../middleware/authenticate'
import {
  ExerciseMediaResponseSchema,
  ErrorResponseSchema,
  UuidParamSchema,
} from '@trainer-app/shared'
import {
  uploadBuffer,
  deleteByPublicId,
  validateMediaFile,
} from '../services/cloudinary.service'

// ── Params schema ─────────────────────────────────────────────────────────────

const ExerciseMediaParamSchema = z.object({
  id:      z.string().uuid().describe('Exercise UUID'),
  mediaId: z.string().uuid().describe('Media record UUID'),
})

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function mediaRoutes(app: FastifyInstance): Promise<void> {

  app.addHook('preHandler', authenticate)

  // ──────────────────────────────────────────────────────────────────────────
  // POST /exercises/:id/media — Upload a file to Cloudinary
  //
  // Accepts: multipart/form-data with a single file field named "file"
  // Optional: isPrimary=true query param to mark as thumbnail immediately
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/exercises/:id/media', {
    schema: {
      tags:     ['Exercises'],
      summary:  'Upload exercise media',
      security: [{ bearerAuth: [] }],
      description: `Upload an image or video for an exercise. Accepts \`multipart/form-data\` with a single \`file\` field.

**Supported types:** JPEG, PNG, WebP, GIF (max 10 MB) · MP4, WebM, MOV (max 100 MB)

The file is uploaded to Cloudinary and the URL is stored. The original file is not kept on the server.`,
      params:   UuidParamSchema,
      response: {
        201: ExerciseMediaResponseSchema,
        400: ErrorResponseSchema.describe('Invalid file type or size'),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema.describe('Exercise not found'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: exerciseId } = request.params as z.infer<typeof UuidParamSchema>
    const isPrimary = (request.query as Record<string, string>)['isPrimary'] === 'true'

    // Verify exercise belongs to this trainer
    const exercise = await db.query.exercises.findFirst({
      where: and(
        eq(exercises.id, exerciseId),
        eq(exercises.trainerId, request.trainer.trainerId),
      ),
    })
    if (!exercise) {
      return reply.status(404).send({ error: 'Exercise not found' })
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

    // Validate file before uploading to Cloudinary
    const validationError = validateMediaFile(mimeType, fileSize)
    if (validationError) {
      return reply.status(400).send({ error: validationError })
    }

    try {
      // Upload to Cloudinary
      const uploaded = await uploadBuffer(fileBuffer, exerciseId, mimeType)

      // If this is the first media or isPrimary was requested,
      // unset any existing primary flag first
      if (isPrimary) {
        await db
          .update(exerciseMedia)
          .set({ isPrimary: false })
          .where(eq(exerciseMedia.exerciseId, exerciseId))
      }

      // Insert media record into DB
      const [media] = await db
        .insert(exerciseMedia)
        .values({
          exerciseId,
          mediaType:          uploaded.mediaType,
          cloudinaryUrl:      uploaded.url,
          cloudinaryPublicId: uploaded.publicId,
          isPrimary:          isPrimary,
          displayOrder:       0,
        })
        .returning()

      return reply.status(201).send({
        ...media,
        createdAt: media.createdAt.toISOString(),
      })
    } catch (error) {
      ;(app.log as any).error(error)
      return reply.status(500).send({ error: 'Upload failed' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /exercises/:id/media/:mediaId — Delete media from Cloudinary + DB
  // ──────────────────────────────────────────────────────────────────────────
  app.delete('/exercises/:id/media/:mediaId', {
    schema: {
      tags:     ['Exercises'],
      summary:  'Delete exercise media',
      security: [{ bearerAuth: [] }],
      description: 'Deletes a media item from both the database and Cloudinary. If the deleted item was the primary thumbnail, no replacement is set automatically — the trainer should set a new primary via the PATCH endpoint.',
      params: ExerciseMediaParamSchema,
      response: {
        204: z.null().describe('Media deleted successfully'),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: exerciseId, mediaId } = request.params as z.infer<typeof ExerciseMediaParamSchema>

    // Fetch the media record — verify the exercise belongs to this trainer
    const media = await db.query.exerciseMedia.findFirst({
      where: eq(exerciseMedia.id, mediaId),
      with:  { exercise: true },
    } as any)

    if (!media || (media as any).exercise?.trainerId !== request.trainer.trainerId) {
      return reply.status(404).send({ error: 'Media not found' })
    }

    try {
      // Delete from Cloudinary first — if DB delete fails, Cloudinary stays clean
      await deleteByPublicId(
        (media as any).cloudinaryPublicId,
        (media as any).mediaType,
      )

      // Delete from DB
      await db
        .delete(exerciseMedia)
        .where(and(
          eq(exerciseMedia.id, mediaId),
          eq(exerciseMedia.exerciseId, exerciseId),
        ))

      return reply.status(204).send()
    } catch (error) {
      ;(app.log as any).error(error)
      return reply.status(500).send({ error: 'Failed to delete media' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /exercises/:id/media/:mediaId/primary — Set primary thumbnail
  // ──────────────────────────────────────────────────────────────────────────
  app.patch('/exercises/:id/media/:mediaId/primary', {
    schema: {
      tags:     ['Exercises'],
      summary:  'Set primary thumbnail',
      security: [{ bearerAuth: [] }],
      description: 'Marks a media item as the primary thumbnail shown in exercise list cards. Unsets any existing primary flag first.',
      params: ExerciseMediaParamSchema,
      response: {
        200: ExerciseMediaResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id: exerciseId, mediaId } = request.params as z.infer<typeof ExerciseMediaParamSchema>

    // Verify ownership
    const exercise = await db.query.exercises.findFirst({
      where: and(
        eq(exercises.id, exerciseId),
        eq(exercises.trainerId, request.trainer.trainerId),
      ),
    })
    if (!exercise) {
      return reply.status(404).send({ error: 'Exercise not found' })
    }

    try {
      // Unset all primaries for this exercise
      await db
        .update(exerciseMedia)
        .set({ isPrimary: false })
        .where(eq(exerciseMedia.exerciseId, exerciseId))

      // Set the new primary
      const [updated] = await db
        .update(exerciseMedia)
        .set({ isPrimary: true })
        .where(and(
          eq(exerciseMedia.id, mediaId),
          eq(exerciseMedia.exerciseId, exerciseId),
        ))
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: 'Media not found' })
      }

      return reply.send({
        ...updated,
        createdAt: updated.createdAt.toISOString(),
      })
    } catch (error) {
      ;(app.log as any).error(error)
      return reply.status(500).send({ error: 'Failed to update primary media' })
    }
  })
}
