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
//   trainer-app/exercises/<exerciseId>/  — exercise demo images/videos (public)
//   trainer-app/clients/<clientId>/…     — progress photos, form-check clips
//
// ACCESS (security gate G16):
//   Library media is `public` (Cloudinary type `upload`, plain URLs). Client
//   media is `authenticated` — Cloudinary refuses to deliver it without a
//   signature only this backend can produce. Every client-media URL is
//   generated at read time by mediaDeliveryUrl(); the stored cloudinary_url
//   column is not trusted for delivery. A signed URL is deterministic for
//   (public_id, transformation) — the service worker's CacheFirst on
//   res.cloudinary.com keeps working — and it does NOT expire: a URL that has
//   legitimately loaded and then leaked stays valid until the asset is deleted
//   or CLOUDINARY_API_SECRET is rotated (which invalidates every signature).
//
// IMAGE TRANSFORMATIONS:
//   Cloudinary transforms are applied via URL parameters, not stored.
//   getThumbnailUrl() generates an optimised 400×300 JPEG URL on the fly.
// ------------------------------------------------------------

import { sniffMediaType, type SniffedMediaType } from '../lib/magicBytes'
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
/** Who may fetch an asset: library media is public; client media needs a signed URL. */
export type MediaAccess = 'public' | 'authenticated'

const CLOUDINARY_TYPE: Record<MediaAccess, 'upload' | 'authenticated'> = {
  public:        'upload',
  authenticated: 'authenticated',
}

export async function uploadBuffer(
  buffer:   Buffer,
  folder:   string,
  mimeType: string,
  access:   MediaAccess = 'public',
): Promise<UploadResult> {
  const resourceType = mimeType.startsWith('video/') ? 'video' : 'image'

  const result = await new Promise<{ secure_url: string; public_id: string; width?: number; height?: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          type:          CLOUDINARY_TYPE[access],
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
  access:       MediaAccess = 'public',
): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: CLOUDINARY_TYPE[access] })
}

/**
 * Delete everything under a folder prefix — images, then videos, then the
 * folder itself. Used by the account purge job. Cloudinary limits each call
 * to ~1000 resources; loop until nothing is left. Best-effort by design: the
 * caller logs failures and proceeds with the DB delete.
 */
export async function deleteByPrefix(prefix: string, access: MediaAccess = 'public'): Promise<void> {
  // `type` matters: the admin API scopes deletion to one delivery type, so a
  // purge that forgets it deletes nothing under an authenticated folder.
  const type = CLOUDINARY_TYPE[access]
  for (const resourceType of ['image', 'video'] as const) {
    let remaining = true
    while (remaining) {
      const result = await cloudinary.api.delete_resources_by_prefix(prefix, { resource_type: resourceType, type }) as { deleted?: Record<string, string> }
      remaining = Object.keys(result.deleted ?? {}).length >= 1000
    }
  }
  try {
    await cloudinary.api.delete_folder(prefix)
  } catch {
    // Folder may not exist (no uploads ever) or may already be gone — either is fine.
  }
}

// ── Delivery URLs ─────────────────────────────────────────────────────────────

/**
 * The URL a client renders for an asset. Public media: a plain URL. Client
 * media: signed for Cloudinary's `authenticated` type — the SDK computes the
 * `s--…--` signature from the API secret, so only this backend can mint one.
 *
 * Deterministic for (publicId, transformation): the same asset always yields
 * the same URL, which is what keeps the service worker's CacheFirst valid.
 * No expiry — see the file header. Images are stored as webp (uploadBuffer
 * forces the format); videos keep their original container.
 */
export function mediaDeliveryUrl(
  publicId:       string,
  resourceType:   'image' | 'video',
  access:         MediaAccess,
  transformation?: Record<string, string | number>,
): string {
  return cloudinary.url(publicId, {
    secure:        true,
    resource_type: resourceType,
    type:          CLOUDINARY_TYPE[access],
    sign_url:      access === 'authenticated',
    ...(resourceType === 'image' ? { format: 'webp' } : {}),
    ...(transformation ? { transformation: [transformation] } : {}),
  })
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

const MAX_IMAGE_BYTES = 10 * 1024 * 1024  // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024 // 100 MB

export type MediaValidation =
  | { ok: true;  mimeType: SniffedMediaType }
  | { ok: false; error: string }

/**
 * Decide what an upload is from its bytes (security gate G17) and check the
 * size for that class. The client's declared Content-Type is not consulted —
 * a mislabelled file is rejected or corrected here, before Cloudinary sees it.
 */
export function validateMediaFile(file: Buffer): MediaValidation {
  const mimeType = sniffMediaType(file)
  if (!mimeType) {
    return { ok: false, error: 'Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, MP4, WebM, MOV' }
  }
  const sizeBytes = file.length
  if (mimeType.startsWith('image/') && sizeBytes > MAX_IMAGE_BYTES) {
    return { ok: false, error: `Image too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum: 10 MB` }
  }
  if (mimeType.startsWith('video/') && sizeBytes > MAX_VIDEO_BYTES) {
    return { ok: false, error: `Video too large (${(sizeBytes / 1024 / 1024).toFixed(1)} MB). Maximum: 100 MB` }
  }
  return { ok: true, mimeType }
}
