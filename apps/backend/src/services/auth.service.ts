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
import { emailConfig, sendTransactionalEmail, escapeHtml } from './email.service'
import { db, refreshTokens, emailVerificationTokens } from '../db'
import { eq, and, gt, desc, ne, isNull, or, lt, isNotNull } from 'drizzle-orm'
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
  } catch {
    // argon2.verify throws on malformed hash — treat as mismatch
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

  // Verify raw token against each candidate hash. Revoked rows are NOT skipped:
  // since rotation marks rather than deletes (A3), a match on a revoked row is
  // the signal that reuse detection needs — classifyPresentedToken() decides.
  for (const candidate of candidates) {
    const valid = await argon2.verify(candidate.tokenHash, params.rawToken)
    if (valid) return candidate
  }

  return null
}

// ── Reuse detection (account plan A3) ───────────────────────────────────────
//
// Rotation keeps the old row and stamps it revokedAt + lastUsedAt ("rotated
// at"). A token presented after it was rotated is one of three things:
//   grace  — the two-tabs race: the refresh cookie is shared across tabs, so a
//            second refresh already in flight carries the just-rotated token.
//            Allowed within ROTATION_GRACE_MS; the client ends up with whichever
//            cookie was set last, and the orphaned token simply expires.
//   reuse  — beyond the grace window someone still holds a token the legitimate
//            client no longer has: the token was copied. Revoke the family.
//   stale  — revoked by logout (lastUsedAt null): a device that signed out and
//            kept its cookie. Not proof of theft; plain 401.
export const ROTATION_GRACE_MS = 10_000

export type PresentedTokenStatus = 'valid' | 'grace' | 'reuse' | 'stale'

export function classifyPresentedToken(
  token: Pick<typeof refreshTokens.$inferSelect, 'revokedAt' | 'lastUsedAt'>,
  now: Date = new Date(),
): PresentedTokenStatus {
  if (!token.revokedAt) return 'valid'
  if (!token.lastUsedAt) return 'stale'
  return now.getTime() - token.lastUsedAt.getTime() <= ROTATION_GRACE_MS ? 'grace' : 'reuse'
}

/**
 * Delete rows that can no longer matter: expired tokens, and revoked tokens
 * older than the refresh TTL (a stolen copy of one of those has expired too,
 * so reuse detection no longer needs it). Run daily by the scheduler.
 */
export async function cleanupRefreshTokens(now: Date = new Date()): Promise<number> {
  const revokedCutoff = new Date(now.getTime() - REFRESH_TOKEN_TTL_MS)
  const deleted = await db
    .delete(refreshTokens)
    .where(or(
      lt(refreshTokens.expiresAt, now),
      and(isNotNull(refreshTokens.revokedAt), lt(refreshTokens.revokedAt, revokedCutoff)),
    ))
    .returning({ id: refreshTokens.id })
  return deleted.length
}

/**
 * Rotate a refresh token — mark the old one rotated, create a new one.
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

  // Mark the old token rotated (revokedAt + lastUsedAt) and insert the new one
  // in a single transaction. Marking rather than deleting is what makes a
  // later presentation of the old token detectable (classifyPresentedToken).
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(refreshTokens).set({ revokedAt: now, lastUsedAt: now }).where(eq(refreshTokens.id, params.oldTokenId))
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
 * Active devices = refresh tokens that are unexpired and not revoked, grouped
 * by device. Rotation replaces the row, so the newest row's createdAt is the
 * device's last activity. A device that logged in twice has two rows until the
 * older expires — grouping hides that.
 */
export interface ActiveDevice {
  deviceId:     string
  deviceName:   string | null
  lastActiveAt: Date
}

export async function listActiveDevices(trainerId: string): Promise<ActiveDevice[]> {
  const rows = await db.query.refreshTokens.findMany({
    where:   and(eq(refreshTokens.trainerId, trainerId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())),
    columns: { deviceId: true, deviceName: true, createdAt: true },
  })
  const byDevice = new Map<string, ActiveDevice>()
  for (const r of rows) {
    const seen = byDevice.get(r.deviceId)
    if (!seen || r.createdAt > seen.lastActiveAt) {
      byDevice.set(r.deviceId, { deviceId: r.deviceId, deviceName: r.deviceName ?? seen?.deviceName ?? null, lastActiveAt: r.createdAt })
    }
  }
  return [...byDevice.values()].sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
}

/** Revoke one device's tokens. Returns false when the trainer has no active token for that device. */
export async function revokeDevice(trainerId: string, deviceId: string): Promise<boolean> {
  const revoked = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.trainerId, trainerId), eq(refreshTokens.deviceId, deviceId), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id })
  return revoked.length > 0
}

/**
 * Revoke every refresh token for a trainer EXCEPT the given device's — used
 * after a password change so other sessions end but the one that changed the
 * password stays signed in. Pass undefined to keep nothing (same as
 * revokeAllRefreshTokens).
 */
export async function revokeRefreshTokensExceptDevice(trainerId: string, keepDeviceId: string | undefined): Promise<void> {
  const where = keepDeviceId
    ? and(eq(refreshTokens.trainerId, trainerId), ne(refreshTokens.deviceId, keepDeviceId))
    : eq(refreshTokens.trainerId, trainerId)
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(where)
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
// EMAIL VERIFICATION (Phase 10.5)
// SHA-256 is used here instead of argon2: verification tokens are
// single-use, short-lived, and high-entropy (48 random bytes). The
// deterministic SHA-256 hash lets us query by hash directly.
// ============================================================

export const EMAIL_VERIFICATION_TTL_MS       = 24 * 60 * 60 * 1000  // 24 hours
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000             // 60 seconds
const RESEND_COOLDOWN_MS = VERIFICATION_RESEND_COOLDOWN_MS

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function generateVerificationToken(): { raw: string; hash: string } {
  const raw  = crypto.randomBytes(48).toString('hex')
  const hash = sha256(raw)
  return { raw, hash }
}

export async function storeVerificationToken(trainerId: string, tokenHash: string): Promise<void> {
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)
  await db.insert(emailVerificationTokens).values({ trainerId, tokenHash, expiresAt })
}

export async function sendVerificationEmail(
  email: string,
  name:  string,
  rawToken: string,
): Promise<void> {
  // emailConfig() throws if APP_URL / REPORT_FROM_EMAIL / RESEND_API_KEY are
  // missing — there is deliberately no default origin (see email.service.ts).
  const cfg  = emailConfig()
  const link = `${cfg.appUrl}/verify-email?token=${rawToken}`
  await sendTransactionalEmail({
    to:      email,
    subject: 'Verify your Just Train email',
    config:  cfg,
    html: [
      `<p>Hi ${escapeHtml(name)},</p>`,
      `<p>Click the link below to verify your email address. The link expires in 24 hours.</p>`,
      `<p><a href="${link}">${link}</a></p>`,
      `<p>If you didn't create a Just Train account, you can safely ignore this email.</p>`,
    ].join(''),
  })
}

// verifyEmailToken moved to emailVerification.service.ts (redeemVerificationToken)
// when the change-email flow gave a token two possible meanings.

/**
 * Check whether a resend is allowed for a trainer.
 * Returns true if no token exists or the most recent one was created > 60s ago.
 */
export async function canResendVerification(trainerId: string): Promise<boolean> {
  const latest = await db.query.emailVerificationTokens.findFirst({
    where:   eq(emailVerificationTokens.trainerId, trainerId),
    orderBy: [desc(emailVerificationTokens.createdAt)],
  })

  if (!latest) return true
  return Date.now() - latest.createdAt.getTime() > RESEND_COOLDOWN_MS
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
    secure:   isProd,
    // Vercel proxies /api/* to Railway, so the cookie is first-party on the
    // app's own origin (just-train.fit since 2026-09-16). Strict: never sent on
    // a cross-site request, including top-level navigations from elsewhere —
    // safe because the path scopes it to /api/v1/auth, which only the app's
    // own fetches call. Email links (/verify-email, /reset-password) land on
    // public pages and do not need it. (G19; was 'lax' while the app lived on
    // a vercel.app origin.)
    sameSite: 'strict' as const,
    path:     '/api/v1/auth',
    maxAge:   REFRESH_TOKEN_TTL_MS / 1000,
  }
}
