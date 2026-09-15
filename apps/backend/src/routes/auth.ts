import { routeLog } from '../lib/logger'
import { captureSecurityEvent } from '../lib/sentry'
import { deactivateTrainer, restoreTrainer, isRestorable, buildExport, PURGE_AFTER_DAYS } from '../services/account.service'
import { requestPasswordReset, resetPasswordWithToken } from '../services/passwordReset.service'
import { requestEmailChange, cancelEmailChange, redeemVerificationToken } from '../services/emailVerification.service'
import { loginLockout, sendLockoutNotice } from '../services/lockout.service'
import { clientIp } from '../lib/clientIp'
import { createHash } from 'node:crypto'
// ------------------------------------------------------------
// routes/auth.ts — Authentication endpoints
//
// Routes:
//   POST /api/v1/auth/register  → create trainer account
//   POST /api/v1/auth/login     → exchange credentials for tokens
//   POST /api/v1/auth/refresh   → exchange refresh cookie for new access token
//   POST /api/v1/auth/logout    → revoke current device's refresh token
//   POST /api/v1/auth/logout-all → revoke ALL devices' refresh tokens
//   GET  /api/v1/auth/me        → get current trainer profile
//
// TOKEN FLOW:
//   Login  → returns access token (JSON body) + refresh token (httpOnly cookie)
//   Refresh → reads httpOnly cookie, returns new access token + rotates cookie
//   Logout  → clears cookie, revokes refresh token in DB
//
// RATE LIMITING:
//   @fastify/rate-limit is applied to /login and /register at the
//   server level (see index.ts) — 10 attempts per 15 minutes per IP.
//   Route-level schemas document the 429 response for Swagger.
//
// DATA FLOW:
//   HTTP → Rate limit check → Zod validation → auth.service → DB → response
// ------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { db, trainers, clients } from '../db'
import type { Trainer } from '../db/schema/trainers'
import { eq } from 'drizzle-orm'
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  findAndVerifyRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshTokensExceptDevice,
  listActiveDevices,
  revokeDevice,
  classifyPresentedToken,
  revokeRefreshToken,
  refreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
  generateVerificationToken,
  storeVerificationToken,
  sendVerificationEmail,
  canResendVerification,
} from '../services/auth.service'
import { authenticate } from '../middleware/authenticate'
import { seedDefaultTemplates } from '../db/seeds/defaultTemplates'
import {
  CreateTrainerSchema,
  LoginSchema,
  OnboardTrainerSchema,
  UpdateTrainerSchema,
  ChangePasswordSchema,
  ChangeEmailSchema,
  DeactivateAccountSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  DeviceListResponseSchema,
  TrainerResponseSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'

// ── Response schemas ─────────────────────────────────────────────────────────

const AuthResponseSchema = z.object({
  accessToken: z.string()
    .describe('Short-lived JWT (15 min). Store in memory (Zustand). Attach as "Bearer <token>" on all API requests.'),
  trainer: TrainerResponseSchema,
  restored: z.boolean().optional()
    .describe('True when this sign-in restored a deactivated account (account plan A5)'),
})

const MessageResponseSchema = z.object({
  message: z.string(),
})

// ── Trainer serialiser ────────────────────────────────────────────────────────
// Pure function — converts a raw Drizzle Trainer row to the TrainerResponse
// shape. Called at every auth response point so the shape is defined once.
//
// Note: lastLoginAt is passed separately because the register route returns
// null (just created) while login returns the updated value.

/** First 12 hex chars of SHA-256(email) — enough to correlate log lines, never the address itself. */
const LockedResponseSchema = ErrorResponseSchema.extend({
  retryAfterSeconds: z.number().int().positive(),
})

function sendLocked(reply: FastifyReply, scope: 'email' | 'ip', retryAfterSeconds: number) {
  const status = scope === 'email' ? 423 : 429
  reply.header('Retry-After', String(retryAfterSeconds))
  return reply.status(status).send({
    error: scope === 'email'
      ? 'Too many failed sign-in attempts. Try again later.'
      : 'Too many failed sign-in attempts from this network. Try again later.',
    code:  scope === 'email' ? 'ACCOUNT_LOCKED' : 'TOO_MANY_FAILURES',
    retryAfterSeconds,
  })
}

function sha256Short(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 12)
}

export function serializeTrainer(
  trainer: Trainer,
  overrides: { lastLoginAt?: string | null } = {},
): z.infer<typeof TrainerResponseSchema> {
  // ⚠️  When adding a new trainer column, this function MUST be updated.
  //     Also update: TrainerResponseSchema, usePreferences.ts, makeTrainer() in factories.ts
  //     See CONTRIBUTING.md — "Adding a new column to an existing table"
  return {
    id:                   trainer.id,
    name:                 trainer.name,
    email:                trainer.email,
    role:                 trainer.role,
    weightUnitPreference: trainer.weightUnitPreference,
    emailVerified:        trainer.emailVerified,
    pendingEmail:         trainer.pendingEmail ?? null,
    lastLoginAt:          overrides.lastLoginAt !== undefined
                            ? overrides.lastLoginAt
                            : trainer.lastLoginAt?.toISOString() ?? null,
    subscriptionTier:     trainer.subscriptionTier,
    subscriptionStatus:   trainer.subscriptionStatus,
    onboardedAt:          trainer.onboardedAt?.toISOString()  ?? null,
    trainerMode:          trainer.trainerMode,
    reportsSentCount:     trainer.reportsSentCount,
    lastActiveAt:         trainer.lastActiveAt?.toISOString() ?? null,
    ctaLabel:             trainer.ctaLabel,
    alertsEnabled:        trainer.alertsEnabled,
    widgetProgression:    trainer.widgetProgression ?? null,
    alertColorScheme:     trainer.alertColorScheme as 'amber' | 'red' | 'blue' | 'green',
    alertTone:            trainer.alertTone        as 'clinical' | 'motivating' | 'firm',
    sessionLayout:        trainer.sessionLayout    as 'horizontal' | 'vertical',
    weeklySessionTarget:  trainer.weeklySessionTarget,
    show1rmEstimate:      trainer.show1rmEstimate,
    autoReportEnabled:    trainer.autoReportEnabled,
    timezone:             trainer.timezone,
    prNotifyType:         (trainer.prNotifyType ?? '1rm') as '1rm' | 'volume' | 'both',
    restDurationSeconds:  trainer.restDurationSeconds ?? 90,
    photoSharingPreference: (trainer.photoSharingPreference ?? 'private') as 'private' | 'share_selected' | 'share_all',
    createdAt:            trainer.createdAt.toISOString(),
    updatedAt:            trainer.updatedAt.toISOString(),
  }
}

// ── Device header extraction ──────────────────────────────────────────────────

function extractDeviceInfo(request: { headers: Record<string, string | string[] | undefined> }): {
  deviceId:   string
  deviceName: string | null
} {
  // Client sends X-Device-ID — a UUID stored in localStorage (generated on first app load)
  // Falls back to a random ID if not provided (e.g. direct API access)
  const deviceId = (request.headers['x-device-id'] as string) ?? crypto.randomUUID()

  // Parse a human-readable device name from User-Agent for the "active sessions" page (future)
  const ua = request.headers['user-agent'] as string | undefined
  const deviceName = ua ? ua.substring(0, 255) : null

  return { deviceId, deviceName }
}

// ── Route plugin ─────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/register — Create trainer account
  //
  // Phase 3C: After creating the trainer, automatically creates an isSelf=true
  // client record so the trainer can immediately track their own training.
  // This self-client is the foundation of "train yourself" mode.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/register', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      summary: 'Register a trainer account',
      description: `Creates a new trainer account and returns tokens immediately (no separate login step required).

**Phase 3C:** Also auto-creates a self-client (\`isSelf: true\`) so the trainer can log their own training immediately.

**Password requirements:** minimum 8 characters.

**Email verification:** not enforced in Phase 2 — \`emailVerified\` is set to \`false\` but not checked. See DEFERRED_ITEMS.md.`,
      body: CreateTrainerSchema,
      response: {
        201: AuthResponseSchema,
        409: ErrorResponseSchema.describe('Email already registered'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { name, email, password } = request.body as z.infer<typeof CreateTrainerSchema>
    const { deviceId, deviceName } = extractDeviceInfo(request as FastifyRequest)

    // Check for duplicate email
    const existing = await db.query.trainers.findFirst({
      where: eq(trainers.email, email.toLowerCase()),
    })
    if (existing) {
      return reply.status(409).send({ error: 'An account with this email already exists' })
    }

    try {
      const passwordHash = await hashPassword(password)

      const [trainer] = await db
        .insert(trainers)
        .values({
          name,
          email: email.toLowerCase(),
          passwordHash,
          emailVerified: false,
        })
        .returning()

      if (!trainer) {
        return reply.status(500).send({ error: 'Failed to create account' })
      }

      // Phase 3C: Auto-create self-client so trainer can track their own training immediately.
      // isSelf=true distinguishes this from external clients.
      // This record is owned by the trainer just like any other client —
      // all session/workout/snapshot routes work identically for it.
      await db.insert(clients).values({
        trainerId:        trainer.id,
        name:             trainer.name,
        email:            trainer.email,
        isSelf:           true,
        progressionState: 'assessment',
        startDate:        new Date().toISOString().split('T')[0],
      })

      // Seed the trainer's default templates — fire and forget, don't block the
      // registration response if it fails. Exercises are no longer copied per
      // trainer: the library is a single shared set of public rows (trainerId
      // IS NULL), visible to every trainer via the exercises visibility query.
      // seedDefaultTemplates resolves exercise names against those public rows.
      seedDefaultTemplates(trainer.id).catch((err) => {
        ;routeLog(app).warn({ err }, 'Default template seed failed for new trainer')
      })

      // Send verification email — fire and forget, don't block registration.
      ;(async () => {
        try {
          const { raw, hash } = generateVerificationToken()
          await storeVerificationToken(trainer.id, hash)
          await sendVerificationEmail(trainer.email, trainer.name, raw)
        } catch (err) {
          routeLog(app).warn({ err }, 'Verification email failed to send on registration')
        }
      })()

      // Issue tokens immediately
      const accessToken = generateAccessToken(trainer.id, trainer.role)
      const { raw, hash } = await generateRefreshToken()
      await storeRefreshToken({ trainerId: trainer.id, tokenHash: hash, deviceId, deviceName })
      reply.setCookie(REFRESH_TOKEN_COOKIE, raw, refreshTokenCookieOptions())

      return reply.status(201).send({
        accessToken,
        trainer: serializeTrainer(trainer, { lastLoginAt: null }),
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to create account' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/login — Exchange credentials for tokens
  //
  // Rate limited: 10 attempts per 15 minutes per IP (configured in index.ts).
  // Returns access token in body + refresh token in httpOnly cookie.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      summary: 'Login',
      description: `Exchange email + password for tokens.

**Access token:** returned in JSON body. Store in memory (Zustand). Attach as \`Authorization: Bearer <token>\` on all API requests. Expires in 15 minutes.

**Refresh token:** set as an \`httpOnly\` cookie. JavaScript cannot read it. Automatically sent to \`/api/v1/auth/refresh\` by the browser. Expires in 7 days.

**Rate limited:** 10 attempts per 15 minutes per IP. Returns 429 on excess.

**Lockout:** 5 consecutive failures for an email → \`423\` with \`retryAfterSeconds\` for the rest of a 15-minute window (unknown emails lock identically); 20 failures from one IP → \`429\` likewise. A correct sign-in clears the email counter.`,
      body: LoginSchema,
      response: {
        200: AuthResponseSchema,
        401: ErrorResponseSchema.describe('Invalid credentials'),
        423: LockedResponseSchema.describe('Too many failed attempts for this email'),
        429: LockedResponseSchema.describe('Too many failed attempts from this address, or the per-route rate limit'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as z.infer<typeof LoginSchema>
    const { deviceId, deviceName } = extractDeviceInfo(request as FastifyRequest)
    const ip = clientIp(request)

    // Lockout runs BEFORE the lookup so a locked unknown address answers the
    // same as a locked real one. Every 401 below counts as a failure.
    const lock = loginLockout.check(email, ip)
    if (lock.locked) return sendLocked(reply, lock.scope, lock.retryAfterSeconds)

    const fail = (trainer?: { email: string; name: string }): ReturnType<typeof reply.send> => {
      const { justLockedEmail, emailFailures, ipFailures } = loginLockout.recordFailure(email, ip)
      routeLog(app).warn({ email: sha256Short(email), ip, emailFailures, ipFailures, known: !!trainer }, 'Sign-in failed')
      if (justLockedEmail) {
        routeLog(app).warn({ email: sha256Short(email), ip }, 'Sign-in locked for this email')
        if (trainer) sendLockoutNotice(trainer.email, trainer.name).catch((err: unknown) => routeLog(app).warn({ err }, 'Lockout notice not sent'))
      }
      // Same message whether the email or the password is wrong — no enumeration.
      return reply.status(401).send({ error: 'Invalid email or password' })
    }

    try {
      const trainer = await db.query.trainers.findFirst({
        where: eq(trainers.email, email.toLowerCase()),
      })
      if (!trainer) return fail()

      const valid = await verifyPassword(password, trainer.passwordHash)
      if (!valid) return fail(trainer)

      // Soft-deleted account (account plan A5). Within the purge window a
      // correct sign-in restores it; past the window it is treated exactly
      // like an unknown account (the purge job removes the row soon anyway,
      // and a distinct message would confirm the email once existed).
      let restored = false
      if (trainer.deactivatedAt) {
        if (!isRestorable(trainer.deactivatedAt)) return fail()
        await restoreTrainer(trainer.id)
        routeLog(app).warn({ trainerId: trainer.id }, 'Account restored by sign-in')
        restored = true
      }

      loginLockout.recordSuccess(email)

      // Update last login timestamp for audit trail
      await db
        .update(trainers)
        .set({ lastLoginAt: new Date() })
        .where(eq(trainers.id, trainer.id))

      const accessToken = generateAccessToken(trainer.id, trainer.role)
      const { raw, hash } = await generateRefreshToken()

      await storeRefreshToken({ trainerId: trainer.id, tokenHash: hash, deviceId, deviceName })

      reply.setCookie(REFRESH_TOKEN_COOKIE, raw, refreshTokenCookieOptions())

      return reply.send({
        accessToken,
        trainer: serializeTrainer({ ...trainer, deactivatedAt: null }),
        ...(restored ? { restored: true } : {}),
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Login failed' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/refresh — Silently exchange refresh cookie for new access token
  //
  // Called automatically by the frontend when an API call returns 401 TOKEN_EXPIRED.
  // Rotates the refresh token on every call (old token deleted, new one issued).
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      description: `Exchange the httpOnly refresh token cookie for a new access token.

The refresh token is **rotated** on every call — the old cookie is replaced with a new one. This means a stolen refresh token can only be used once before the legitimate user's next refresh invalidates it.

**Requires:** valid \`${REFRESH_TOKEN_COOKIE}\` cookie and \`X-Trainer-ID\` + \`X-Device-ID\` headers (set by the frontend automatically).

Returns 401 if the refresh token is expired, revoked, or missing.`,
      response: {
        200: AuthResponseSchema,
        401: ErrorResponseSchema.describe('Missing, expired, or revoked refresh token'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const rawToken = (request.cookies as Record<string, string>)[REFRESH_TOKEN_COOKIE]

    if (!rawToken) {
      return reply.status(401).send({ error: 'Refresh token missing' })
    }

    // deviceId still needed to find the right token for this device
    const deviceId  = request.headers['x-device-id'] as string | undefined

    if (!deviceId) {
      return reply.status(401).send({ error: 'X-Device-ID header required' })
    }

    try {
      // Look up the token by raw value — trainerId is on the record itself,
      // so we don't need X-Trainer-ID header (which breaks refresh-on-reload
      // because the Zustand store is empty after a page refresh)
      const tokenRecord = await findAndVerifyRefreshToken({ rawToken, deviceId })

      if (!tokenRecord) {
        reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' })
        return reply.status(401).send({ error: 'Invalid or expired refresh token' })
      }

      // Reuse detection (account plan A3). A token that was rotated more than
      // the grace window ago and is presented again was copied: end every
      // session for this trainer, not just this one.
      const status = classifyPresentedToken(tokenRecord)
      if (status === 'reuse') {
        await revokeAllRefreshTokens(tokenRecord.trainerId)
        reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' })
        routeLog(app).warn({ trainerId: tokenRecord.trainerId, deviceId }, 'Refresh token reuse detected — all sessions revoked')
        captureSecurityEvent('Refresh token reuse detected', { trainerId: tokenRecord.trainerId })
        return reply.status(401).send({ error: 'Session ended for security reasons. Please sign in again.', code: 'TOKEN_REUSE' })
      }
      if (status === 'stale') {
        reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' })
        return reply.status(401).send({ error: 'Invalid or expired refresh token' })
      }
      // 'valid' and 'grace' both proceed to rotate.

      // trainerId comes from the token record — don't rely on the header
      const trainer = await db.query.trainers.findFirst({
        where: eq(trainers.id, tokenRecord.trainerId),
      })

      if (!trainer) {
        return reply.status(401).send({ error: 'Trainer not found' })
      }

      // Rotate — invalidate old token, issue new one
      const { raw: newRaw } = await rotateRefreshToken({
        oldTokenId: tokenRecord.id,
        trainerId:  trainer.id,
        deviceId,
        deviceName: tokenRecord.deviceName,
      })

      const accessToken = generateAccessToken(trainer.id, trainer.role)

      reply.setCookie(REFRESH_TOKEN_COOKIE, newRaw, refreshTokenCookieOptions())

      return reply.send({
        accessToken,
        trainer: serializeTrainer(trainer),
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Token refresh failed' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/logout — Logout from current device
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/logout', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Logout (current device)',
      description: 'Revokes the refresh token for the current device and clears the cookie. The access token will expire naturally (within 15 minutes). For immediate full invalidation, use logout-all.',
      response: {
        200: MessageResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const rawToken = (request.cookies as Record<string, string>)[REFRESH_TOKEN_COOKIE]
    const deviceId = request.headers['x-device-id'] as string | undefined

    try {
      if (rawToken && deviceId) {
        const tokenRecord = await findAndVerifyRefreshToken({
          rawToken,
          trainerId: request.trainer.trainerId,
          deviceId,
        })
        if (tokenRecord) {
          await revokeRefreshToken(tokenRecord.id)
        }
      }

      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' })
      return reply.send({ message: 'Logged out successfully' })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Logout failed' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/logout-all — Logout from all devices
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/logout-all', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Logout (all devices)',
      description: 'Revokes ALL refresh tokens for this trainer — every device will need to log in again. Useful when a device is lost or a security breach is suspected.',
      response: {
        200: MessageResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      await revokeAllRefreshTokens(request.trainer.trainerId)
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' })
      return reply.send({ message: 'Logged out from all devices' })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Logout failed' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /auth/me — Get current trainer profile
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/auth/me', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Get current trainer',
      description: 'Returns the full profile for the authenticated trainer. Used on app load to verify the token is still valid and restore session state.',
      response: {
        200: TrainerResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const trainer = await db.query.trainers.findFirst({
        where: eq(trainers.id, request.trainer.trainerId),
      })

      if (!trainer) {
        return reply.status(404).send({ error: 'Trainer not found' })
      }

      return reply.send({
        ...serializeTrainer(trainer),
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to fetch trainer profile' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/onboard — Set trainer mode (called once after registration)
  //
  // Sets trainerMode and marks onboardedAt. Called from the onboarding
  // screen shown immediately after registration. Idempotent — calling it
  // again updates the mode (allows switching before first real usage).
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/onboard', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Complete onboarding — set trainer mode',
      description: `Sets the trainer's product mode and marks onboarding as complete.

**trainerMode options:**
- \`athlete\` — tracking own training only. Simplified nav, no client roster shown.
- \`trainer\` — managing clients + optional self-training. Full nav and dashboard.

Called once from the onboarding screen after registration. Can be called again to switch mode before the trainer has meaningful data.`,
      security: [{ bearerAuth: [] }],
      body: OnboardTrainerSchema,
      response: {
        200: TrainerResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { trainerMode } = request.body as z.infer<typeof OnboardTrainerSchema>
    const trainerId = request.trainer.trainerId

    try {
      const [updated] = await db
        .update(trainers)
        .set({
          trainerMode,
          onboardedAt: new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(trainers.id, trainerId))
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: 'Trainer not found' })
      }

      return reply.send({
        ...serializeTrainer(updated),
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to complete onboarding' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /auth/me — Update trainer profile
  //
  // Updates mutable profile fields: name, weightUnitPreference.
  // Email and password changes are separate flows (deferred).
  // ──────────────────────────────────────────────────────────────────────────
  app.patch('/auth/me', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Update trainer profile',
      description: 'Updates trainer name and/or weight unit preference. Only provided fields are changed.',
      security: [{ bearerAuth: [] }],
      body: UpdateTrainerSchema,
      response: {
        200: TrainerResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body      = request.body as z.infer<typeof UpdateTrainerSchema>
    const trainerId = request.trainer.trainerId

    try {
      const [updated] = await db
        .update(trainers)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(trainers.id, trainerId))
        .returning()

      if (!updated) {
        return reply.status(404).send({ error: 'Trainer not found' })
      }

      return reply.send({
        ...serializeTrainer(updated),
      })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to update profile' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /auth/password — Change password (account plan A1)
  //
  // Re-proves the current password, stores the new hash, and signs out every
  // OTHER device: a password change is the recovery move after a suspected
  // compromise, so sessions the owner cannot see must end. The device that
  // made the change keeps its refresh token.
  // ──────────────────────────────────────────────────────────────────────────
  app.patch('/auth/password', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Change password',
      description: 'Requires the current password. On success every other device is signed out; this device stays signed in.',
      body: ChangePasswordSchema,
      response: {
        200: MessageResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof ChangePasswordSchema>
    const trainerId = request.trainer.trainerId

    try {
      const trainer = await db.query.trainers.findFirst({
        where:   eq(trainers.id, trainerId),
        columns: { id: true, passwordHash: true },
      })
      if (!trainer) return reply.status(404).send({ error: 'Trainer not found' })

      const ok = await verifyPassword(body.currentPassword, trainer.passwordHash)
      if (!ok) return reply.status(400).send({ error: 'Current password is incorrect' })

      if (body.newPassword === body.currentPassword) {
        return reply.status(400).send({ error: 'New password must be different from the current password' })
      }

      const passwordHash = await hashPassword(body.newPassword)
      await db.update(trainers).set({ passwordHash, updatedAt: new Date() }).where(eq(trainers.id, trainerId))

      // Sign out everywhere else. X-Device-ID identifies this device's refresh token.
      const deviceId = request.headers['x-device-id'] as string | undefined
      await revokeRefreshTokensExceptDevice(trainerId, deviceId)

      routeLog(app).warn({ trainerId }, 'Password changed; other devices signed out')
      return reply.send({ message: 'Password changed. Other devices have been signed out.' })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to change password' })
    }
  })


  // ──────────────────────────────────────────────────────────────────────────
  // GET /auth/devices — Signed-in devices (account plan A2)
  // DELETE /auth/devices/:deviceId — Sign out one device
  //
  // A device is a refresh-token family keyed by the client's X-Device-ID.
  // Revoking your own device is allowed and behaves like logout.
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/auth/devices', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'List signed-in devices',
      response: { 200: DeviceListResponseSchema, 401: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      const current = request.headers['x-device-id'] as string | undefined
      const devices = await listActiveDevices(request.trainer.trainerId)
      return reply.send(devices.map((d) => ({
        deviceId:     d.deviceId,
        deviceName:   d.deviceName,
        lastActiveAt: d.lastActiveAt.toISOString(),
        current:      d.deviceId === current,
      })))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to list devices' })
    }
  })

  app.delete('/auth/devices/:deviceId', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Sign out one device',
      params: z.object({ deviceId: z.string().min(1).max(200) }),
      response: { 204: z.null(), 401: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { deviceId } = request.params as { deviceId: string }
    try {
      const revoked = await revokeDevice(request.trainer.trainerId, deviceId)
      if (!revoked) return reply.status(404).send({ error: 'Device not found' })
      if (deviceId === request.headers['x-device-id']) {
        reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' })
      }
      routeLog(app).warn({ trainerId: request.trainer.trainerId, deviceId }, 'Device signed out')
      return reply.status(204).send()
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to sign out device' })
    }
  })


  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /auth/me — Deactivate account (account plan A5, soft delete)
  //
  // Re-proves the password, stamps deactivated_at, revokes every device,
  // clears the cookie. Data stays for PURGE_AFTER_DAYS so a sign-in can
  // restore it; the daily purge job hard-deletes after that.
  // ──────────────────────────────────────────────────────────────────────────
  app.delete('/auth/me', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Deactivate account',
      description: `Soft delete. The account is hidden and every device signed out; signing in within ${PURGE_AFTER_DAYS} days restores it, after which all data and media are permanently deleted.`,
      body: DeactivateAccountSchema,
      response: {
        200: MessageResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { password } = request.body as z.infer<typeof DeactivateAccountSchema>
    const trainerId = request.trainer.trainerId

    try {
      const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, trainerId), columns: { id: true, passwordHash: true } })
      if (!trainer) return reply.status(404).send({ error: 'Trainer not found' })

      const ok = await verifyPassword(password, trainer.passwordHash)
      if (!ok) return reply.status(400).send({ error: 'Password is incorrect' })

      await deactivateTrainer(trainerId)
      reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' })
      routeLog(app).warn({ trainerId }, 'Account deactivated')
      return reply.send({ message: `Account deactivated. Sign in within ${PURGE_AFTER_DAYS} days to restore it.` })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to deactivate account' })
    }
  })


  // ──────────────────────────────────────────────────────────────────────────
  // GET /auth/export — Download my data (account plan A4, portability)
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/auth/export', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
    schema: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Export all of my data as JSON',
      description: 'Every row the account owns, grouped by table, as a downloadable JSON file. Media are included as their URLs. Never includes the password hash or tokens.',
      response: { 401: ErrorResponseSchema, 404: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    try {
      const data = await buildExport(request.trainer.trainerId)
      if (!data) return reply.status(404).send({ error: 'Trainer not found' })
      const stamp = data.exportedAt.slice(0, 10)
      routeLog(app).warn({ trainerId: request.trainer.trainerId }, 'Data export downloaded')
      return reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="just-train-export-${stamp}.json"`)
        .send(JSON.stringify(data, null, 2))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to build export' })
    }
  })


  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/forgot-password — Request a reset link (account plan B6)
  // POST /auth/reset-password  — Redeem it
  //
  // Both PUBLIC. forgot-password answers 202 no matter what (no account,
  // cooldown, send failure) — the email is the only signal, so the endpoint
  // cannot be used to enumerate accounts. The outcome is logged.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/forgot-password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      summary: 'Request a password reset link',
      description: 'Always answers 202. If an account exists for the email, a one-hour single-use link is sent.',
      body: ForgotPasswordSchema,
      response: { 202: MessageResponseSchema, 400: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { email } = request.body as z.infer<typeof ForgotPasswordSchema>
    try {
      const outcome = await requestPasswordReset(email)
      routeLog(app).warn({ outcome, emailHash: sha256Short(email) }, 'Password reset requested')
      if (outcome === 'send_failed') captureSecurityEvent('Password reset email failed to send', { outcome })
      return reply.status(202).send({ message: 'If an account exists for that email, a reset link is on its way.' })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Could not process the request' })
    }
  })

  app.post('/auth/reset-password', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      summary: 'Set a new password with a reset token',
      description: 'Consumes the token, sets the password, and signs out every device.',
      body: ResetPasswordSchema,
      response: { 200: MessageResponseSchema, 400: ErrorResponseSchema, 500: ErrorResponseSchema },
    },
  }, async (request, reply) => {
    const { token, newPassword } = request.body as z.infer<typeof ResetPasswordSchema>
    try {
      const { outcome, trainerId } = await resetPasswordWithToken(token, newPassword)
      if (outcome !== 'ok') {
        const reason = outcome === 'expired' ? 'This reset link has expired. Request a new one.'
                     : outcome === 'used'    ? 'This reset link was already used. Request a new one.'
                     :                         'This reset link is not valid.'
        return reply.status(400).send({ error: reason, code: `RESET_${outcome.toUpperCase()}` })
      }
      routeLog(app).warn({ trainerId }, 'Password reset via emailed link; all devices signed out')
      return reply.send({ message: 'Password updated. Sign in with your new password.' })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Could not reset the password' })
    }
  })


  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /auth/email — Start a sign-in email change (account plan B7)
  //
  // Re-proves the password, records the pending address, and mails a
  // confirmation link to the NEW address. Nothing changes until that link is
  // redeemed (GET /auth/verify-email) — the old address keeps working, so a
  // typo cannot lock anyone out. Returns the trainer with `pendingEmail` set.
  // ──────────────────────────────────────────────────────────────────────────
  app.patch('/auth/email', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    schema: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Change sign-in email (verified by link before it takes effect)',
      body: ChangeEmailSchema,
      response: {
        200: TrainerResponseSchema,
        400: ErrorResponseSchema.describe('Wrong password, same address, or resend cooldown'),
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema.describe('Address already used by another account'),
        500: ErrorResponseSchema,
        503: ErrorResponseSchema.describe('Pending change recorded but the confirmation email could not be sent'),
      },
    },
  }, async (request, reply) => {
    const body = request.body as z.infer<typeof ChangeEmailSchema>
    const trainerId = request.trainer.trainerId

    try {
      const { outcome } = await requestEmailChange(trainerId, body.newEmail, body.password)
      switch (outcome) {
        case 'not_found':      return reply.status(404).send({ error: 'Trainer not found' })
        case 'wrong_password': return reply.status(400).send({ error: 'Password is incorrect' })
        case 'same_email':     return reply.status(400).send({ error: 'That is already your sign-in email' })
        case 'taken':          return reply.status(409).send({ error: 'That email address is already in use' })
        case 'cooldown':       return reply.status(400).send({ error: 'Please wait 60 seconds before requesting another confirmation email' })
        case 'send_failed':
          routeLog(app).error({ trainerId }, 'Change-email confirmation could not be sent')
          return reply.status(503).send({ error: 'Could not send the confirmation email. Try again in a minute.' })
        case 'sent': break
      }

      const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, trainerId) })
      if (!trainer) return reply.status(404).send({ error: 'Trainer not found' })
      routeLog(app).warn({ trainerId }, 'Email change requested; confirmation sent to the new address')
      return reply.send(serializeTrainer(trainer))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to change email' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /auth/email/pending — Cancel a pending email change
  // ──────────────────────────────────────────────────────────────────────────
  app.delete('/auth/email/pending', {
    preHandler: [authenticate],
    schema: {
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
      summary: 'Cancel a pending sign-in email change',
      response: {
        200: TrainerResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const trainerId = request.trainer.trainerId
    try {
      await cancelEmailChange(trainerId)
      const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, trainerId) })
      if (!trainer) return reply.status(404).send({ error: 'Trainer not found' })
      return reply.send(serializeTrainer(trainer))
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to cancel the email change' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /auth/send-verification — Generate and send a verification email
  //
  // Protected. Generates a fresh token, stores its SHA-256 hash, and emails
  // the raw token as a link. Caller must be authenticated (access token).
  // Called once automatically after registration; also available for
  // manual re-trigger from the unverified banner.
  // ──────────────────────────────────────────────────────────────────────────
  app.post('/auth/send-verification', {
    preHandler: [authenticate],
    config:     { rateLimit: { max: 5, timeWindow: '1 hour' } },
    schema: {
      tags:     ['Auth'],
      security: [{ bearerAuth: [] }],
      summary:  'Send or resend verification email',
      response: {
        200: MessageResponseSchema,
        400: ErrorResponseSchema.describe('Too soon — resend cooldown (60s) not elapsed'),
        409: ErrorResponseSchema.describe('Email already verified'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const trainerId = request.trainer.trainerId

    try {
      const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, trainerId) })
      if (!trainer) return reply.status(404).send({ error: 'Trainer not found' })

      if (trainer.emailVerified) {
        return reply.status(409).send({ error: 'Email is already verified' })
      }

      const allowed = await canResendVerification(trainerId)
      if (!allowed) {
        return reply.status(400).send({ error: 'Please wait 60 seconds before requesting another verification email' })
      }

      const { raw, hash } = generateVerificationToken()
      await storeVerificationToken(trainerId, hash)
      await sendVerificationEmail(trainer.email, trainer.name, raw)

      return reply.send({ message: 'Verification email sent' })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to send verification email' })
    }
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /auth/verify-email?token=<raw> — Verify email token from link
  //
  // Public (no auth required). Called by the frontend /verify-email page
  // after the user clicks the link in the verification email.
  // ──────────────────────────────────────────────────────────────────────────
  app.get('/auth/verify-email', {
    schema: {
      tags:    ['Auth'],
      summary: 'Verify email token',
      querystring: z.object({ token: z.string().min(1) }),
      response: {
        200: MessageResponseSchema,
        400: ErrorResponseSchema.describe('Token expired, already used, or not found'),
        409: ErrorResponseSchema.describe('Change-email token, but the address was registered by someone else meanwhile'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { token } = request.query as { token: string }

    try {
      const { outcome, changedTo } = await redeemVerificationToken(token)

      if (outcome === 'ok') {
        if (changedTo) routeLog(app).warn({ email: sha256Short(changedTo) }, 'Sign-in email changed via verification link')
        return reply.send({ message: changedTo ? `Your sign-in email is now ${changedTo}` : 'Email verified successfully' })
      }
      if (outcome === 'taken') {
        return reply.status(409).send({ error: 'That email address is now used by another account. Cancel the change and pick a different one.' })
      }

      const messages: Record<string, string> = {
        expired:   'This verification link has expired. Please request a new one.',
        used:      'This verification link has already been used.',
        not_found: 'Invalid verification link.',
      }
      return reply.status(400).send({ error: messages[outcome] ?? 'Verification failed' })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Verification failed' })
    }
  })

  // ----------------------------------------------------------
  // POST /auth/seed-templates — Seed default templates
  // Seeds the 20 default templates for the logged-in trainer.
  // Idempotent — skips if trainer already has templates.
  // Called automatically when the templates page loads empty.
  // ----------------------------------------------------------
  app.post('/auth/seed-templates', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    schema: {
      tags:     ['Auth'],
      security: [{ bearerAuth: [] }],
      summary:  'Seed default templates for the current trainer',
      response: {
        200: z.object({ seeded: z.boolean() }),
        500: ErrorResponseSchema,
      },
    },
    preHandler: [authenticate],
  }, async (request, reply) => {
    try {
      await seedDefaultTemplates(request.trainer.trainerId)
      return reply.send({ seeded: true })
    } catch (error) {
      ;routeLog(app).error(error)
      return reply.status(500).send({ error: 'Failed to seed templates' })
    }
  })
}
