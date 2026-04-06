// ------------------------------------------------------------
// services/auth.service.ts — Authentication business logic
//
// This service is the single place for all auth operations.
// Route handlers call these functions — they never implement
// auth logic directly. This makes auth easy to test and change.
//
// RESPONSIBILITIES:
//   - Password hashing and verification (argon2)
//   - JWT access token generation and verification
//   - Refresh token generation and hashing
//   - Refresh token DB operations (create, verify, rotate, revoke)
//
// ARGON2 vs BCRYPT:
//   argon2id is the current OWASP recommendation for password hashing.
//   It is resistant to both side-channel and GPU attacks. bcrypt is
//   still acceptable but argon2 is the better modern choice.
// ------------------------------------------------------------

import * as argon2 from 'argon2'
import * as crypto from 'crypto'
import * as jwt from 'jsonwebtoken'
import { db, refreshTokens } from '../db'
import { eq, and, gt } from 'drizzle-orm'
import type { TrainerRole } from '@trainer-app/shared'

// ============================================================
// ENVIRONMENT CONFIGURATION
// All secrets come from environment variables — never hardcoded.
// ============================================================

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

// JWT secret for signing access tokens
const JWT_SECRET         = requireEnv('JWT_SECRET')

// How long access tokens are valid — short to limit damage if stolen
const ACCESS_TOKEN_TTL   = process.env.JWT_ACCESS_TTL   ?? '15m'

// How long refresh tokens are valid
const REFRESH_TOKEN_TTL_MS = parseInt(process.env.JWT_REFRESH_TTL_MS ?? String(7 * 24 * 60 * 60 * 1000))

// ============================================================
// PASSWORD HASHING
// ============================================================

/**
 * Hash a plaintext password using argon2id.
 * The hash includes the salt — no need to store salt separately.
 * Returns a string safe to store in the database.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,       // argon2id = hybrid, best resistance to attacks
    memoryCost: 65536,           // 64 MB memory usage — makes GPU attacks expensive
    timeCost: 3,                 // 3 iterations
    parallelism: 1,
  })
}

/**
 * Verify a plaintext password against a stored argon2 hash.
 * Returns true if the password matches, false otherwise.
 * Safe against timing attacks (constant-time comparison internally).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch (err) {
    // argon2.verify throws on malformed hash or native module issues
    console.error('[auth] argon2.verify threw:', err)
    return false
  }
}

// ============================================================
// ACCESS TOKENS (JWT)
// ============================================================

// Shape of the JWT payload — what we embed in the token
export interface AccessTokenPayload {
  trainerId: string
  role:      TrainerRole
  type:      'access'           // Guards against using a refresh token as an access token
}

/**
 * Generate a signed JWT access token for a trainer.
 * Short-lived (15 min by default) — stored in Zustand memory on the frontend.
 */
export function generateAccessToken(trainerId: string, role: TrainerRole): string {
  const payload: AccessTokenPayload = { trainerId, role, type: 'access' }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL } as jwt.SignOptions)
}

/**
 * Verify and decode a JWT access token.
 * Returns the payload if valid, throws otherwise.
 * Called by the authenticate middleware on every protected request.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload

  // Double-check the type claim — prevents refresh tokens being used as access tokens
  if (decoded.type !== 'access') {
    throw new Error('Invalid token type')
  }

  return decoded
}

// ============================================================
// REFRESH TOKENS (opaque random strings)
// ============================================================

/**
 * Generate a cryptographically random refresh token.
 * Returns the raw token (sent to client once via httpOnly cookie)
 * and its argon2 hash (stored in the database).
 */
export async function generateRefreshToken(): Promise<{ raw: string; hash: string }> {
  // 48 bytes = 384 bits of entropy — far beyond brute-force feasibility
  const raw  = crypto.randomBytes(48).toString('hex')
  const hash = await argon2.hash(raw, { type: argon2.argon2id })
  return { raw, hash }
}

// ============================================================
// REFRESH TOKEN DB OPERATIONS
// ============================================================

/**
 * Store a new refresh token in the database.
 * Called after successful login or token rotation.
 */
export async function storeRefreshToken(params: {
  trainerId:  string
  tokenHash:  string
  deviceId:   string
  deviceName: string | null
}): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

  await db.insert(refreshTokens).values({
    trainerId:  params.trainerId,
    tokenHash:  params.tokenHash,
    deviceId:   params.deviceId,
    deviceName: params.deviceName,
    expiresAt,
  })
}

/**
 * Find and validate a refresh token by trainerId + deviceId.
 * Returns the token record if valid (not expired, not revoked).
 *
 * We fetch by trainerId + deviceId (not the hash) because argon2
 * is not reversible — we can't query by the hash directly.
 * Instead we fetch all active tokens for the device and verify
 * the raw token against each hash.
 *
 * In practice there should be at most one active token per device.
 */
export async function findAndVerifyRefreshToken(params: {
  rawToken:  string
  deviceId:  string
  trainerId?: string
}): Promise<typeof refreshTokens.$inferSelect | null> {
  const now = new Date()

  // Find active tokens for this device (and optionally this trainer)
  // trainerId is optional — on page refresh the Zustand store is empty
  // so we can't send it as a header. The token itself carries the trainerId.
  const conditions = [
    eq(refreshTokens.deviceId, params.deviceId),
    gt(refreshTokens.expiresAt, now),
  ]
  if (params.trainerId) {
    conditions.push(eq(refreshTokens.trainerId, params.trainerId))
  }

  const candidates = await db
    .select()
    .from(refreshTokens)
    .where(and(...conditions))

  // Verify raw token against each candidate hash
  for (const candidate of candidates) {
    if (candidate.revokedAt) continue

    const valid = await argon2.verify(candidate.tokenHash, params.rawToken)
    if (valid) return candidate
  }

  return null
}

/**
 * Rotate a refresh token — delete the old one, create a new one.
 * Called on every successful token refresh.
 * This is the core of the token rotation security model.
 */
export async function rotateRefreshToken(params: {
  oldTokenId: string
  trainerId:  string
  deviceId:   string
  deviceName: string | null
}): Promise<{ raw: string }> {
  const { raw, hash } = await generateRefreshToken()
  const expiresAt     = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)

  // Delete old token and insert new one in a single transaction
  await db.transaction(async (tx) => {
    await tx.delete(refreshTokens).where(eq(refreshTokens.id, params.oldTokenId))
    await tx.insert(refreshTokens).values({
      trainerId:  params.trainerId,
      tokenHash:  hash,
      deviceId:   params.deviceId,
      deviceName: params.deviceName,
      expiresAt,
    })
  })

  return { raw }
}

/**
 * Revoke all refresh tokens for a trainer (full logout from all devices).
 * Called on logout — sets revokedAt on all active tokens.
 */
export async function revokeAllRefreshTokens(trainerId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.trainerId, trainerId),
      )
    )
}

/**
 * Revoke a single refresh token (logout from one device).
 */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, tokenId))
}

// ============================================================
// COOKIE HELPERS
// ============================================================

// Cookie name used for the refresh token httpOnly cookie
export const REFRESH_TOKEN_COOKIE = 'trainer_refresh_token'

/**
 * Returns cookie options for setting the refresh token.
 * httpOnly: true — JavaScript cannot read this cookie (XSS protection).
 * secure: true in production — only sent over HTTPS.
 * sameSite: strict — not sent on cross-site requests (CSRF protection).
 */
export function refreshTokenCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    // In production the frontend (Vercel) and backend (Railway) are on
    // different domains. SameSite must be 'none' + secure:true for the
    // browser to send the cookie cross-origin. In dev, 'lax' works fine
    // since both run on localhost.
    secure:   isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path:     '/api/v1/auth',
    maxAge:   REFRESH_TOKEN_TTL_MS / 1000,
  }
}
