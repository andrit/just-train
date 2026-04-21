// ------------------------------------------------------------
// services/cloudinary.service.ts — Cloudinary media operations
//
// Centralises all Cloudinary API calls. Route handlers call these
// functions; they never use the Cloudinary SDK directly.
//
// UPLOAD FLOW (exercise media):
//   1. Trainer selects file in the UI
//   2. Frontend POSTs multipart form data to POST /exercises/:id/media
//   3. Fastify buffers the file (via @fastify/multipart)
//   4. uploadBuffer() streams it to Cloudinary
//   5. We store cloudinaryUrl + cloudinaryPublicId in exercise_media table
//
// DELETION:
//   Cloudinary resources must be explicitly deleted when we remove a
//   media record — orphaned files accumulate and cost money otherwise.
//
// FOLDER STRUCTURE in Cloudinary:
//   trainer-app/exercises/<exerciseId>/  — exercise demo images/videos
//
// IMAGE TRANSFORMATIONS:
//   Cloudinary transforms are applied via URL parameters, not stored.
//   getThumbnailUrl() generates an optimised 400×300 JPEG URL on the fly.
// ------------------------------------------------------------

import { v2 as cloudinary } from 'cloudinary'

// ── Configuration ─────────────────────────────────────────────────────────────
// Called once at server start — throws if any key is missing

export function configureCloudinary(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, ' +
      'CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.'
    )
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
}

// ── Folder paths ─────────────────────────────────────────────────────────────
// Centralised folder structure — all Cloudinary assets follow this pattern.

export function exerciseFolder(exerciseId: string): string {
  return `trainer-app/exercises/${exerciseId}`
}

export function snapshotFolder(clientId: string, snapshotId: string): string {
  return `trainer-app/clients/${clientId}/snapshots/${snapshotId}`
}

export function sessionExerciseFolder(clientId: string, sessionId: string, sessionExerciseId: string): string {
  return `trainer-app/clients/${clientId}/sessions/${sessionId}/${sessionExerciseId}`
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface UploadResult {
  url:       string   // Full HTTPS Cloudinary URL
  publicId:  string   // Used to reference/delete the asset in Cloudinary
  mediaType: 'image' | 'video'
  width?:    number
  height?:   number
}

/**
 * Upload a file buffer to Cloudinary.
 *
 * @param buffer   Raw file data from the multipart upload
 * @param folder   Cloudinary folder path — use exerciseFolder() or snapshotFolder()
 * @param mimeType e.g. 'image/jpeg', 'video/mp4' — determines resource_type
 */
export async function uploadBuffer(
  buffer:   Buffer,
  folder:   string,
  mimeType: string,
): Promise<UploadResult> {
  const resourceType = mimeType.startsWith('video/') ? 'video' : 'image'

  const result = await new Promise<{ secure_url: string; public_id: string; width?: number; height?: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder:        folder,
          // Auto-detect format and quality — Cloudinary picks the best compression
          format:        resourceType === 'image' ? 'webp' : undefined,
          quality:       'auto',
          // Limit maximum dimensions — no need to store originals beyond 1920px
          transformation: resourceType === 'image'
            ? [{ width: 1920, height: 1920, crop: 'limit' }]
            : undefined,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Upload failed'))
          resolve(result)
        },
      )
      stream.end(buffer)
    },
  )

  return {
    url:       result.secure_url,
    publicId:  result.public_id,
    mediaType: resourceType,
    width:     result.width,
    height:    result.height,
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a Cloudinary asset by public ID.
 * Called when the trainer removes media from an exercise.
 * Silently succeeds if the asset doesn't exist (idempotent).
 */
export async function deleteByPublicId(
  publicId:     string,
  resourceType: 'image' | 'video' = 'image',
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}

// ── URL Transforms ────────────────────────────────────────────────────────────

/**
 * Returns a Cloudinary transformation URL for a 400×300 JPEG thumbnail.
 * Used for exercise card thumbnails in list views.
 * No storage — the transform is computed by Cloudinary on first request.
 */
export function getThumbnailUrl(cloudinaryUrl: string): string {
  // Insert transformation parameters into the URL
  // Original: https://res.cloudinary.com/<cloud>/image/upload/<public_id>
  // Transformed: .../image/upload/c_fill,h_300,w_400,f_webp,q_auto/<public_id>
  return cloudinaryUrl.replace(
    '/upload/',
    '/upload/c_fill,h_300,w_400,f_webp,q_auto/',
  )
}

// ── Validation ────────────────────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const MAX_IMAGE_BYTES      = 10 * 1024 * 1024  // 10 MB
const MAX_VIDEO_BYTES      = 100 * 1024 * 1024 // 100 MB

export function validateMediaFile(mimeType: string, sizeBytes: number): string | null {
  const isImage = ALLOWED_IMAGE_TYPES.has(mimeType)
  const isVideo = ALLOWED_VIDEO_TYPES.has(mimeType)

  if (!isImage && !isVideo) {
    return `Unsupported file type: ${mimeType}. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM, MOV`
  }

  if (isImage && sizeBytes > MAX_IMAGE_BYTES) {
    return `Image too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum: 10 MB`
  }

  if (isVideo && sizeBytes > MAX_VIDEO_BYTES) {
    return `Video too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum: 100 MB`
  }

  return null // valid
}
