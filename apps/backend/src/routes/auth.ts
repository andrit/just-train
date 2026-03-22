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

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, trainers, clients, clientGoals, refreshTokens } from '../db'
import type { Trainer } from '../db/schema/trainers'
import { eq, and, gt } from 'drizzle-orm'
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  findAndVerifyRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  refreshTokenCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from '../services/auth.service'
import { authenticate } from '../middleware/authenticate'
import { seedExerciseLibrary } from '../db/seed-exercises'
import {
  CreateTrainerSchema,
  LoginSchema,
  OnboardTrainerSchema,
  UpdateTrainerSchema,
  TrainerResponseSchema,
  ErrorResponseSchema,
} from '@trainer-app/shared'

// ── Response schemas ─────────────────────────────────────────────────────────

const AuthResponseSchema = z.object({
  accessToken: z.string()
    .describe('Short-lived JWT (15 min). Store in memory (Zustand). Attach as "Bearer <token>" on all API requests.'),
  trainer: TrainerResponseSchema,
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

function serializeTrainer(
  trainer: Trainer,
  overrides: { lastLoginAt?: string | null } = {},
): z.infer<typeof TrainerResponseSchema> {
  return {
    id:                   trainer.id,
    name:                 trainer.name,
    email:                trainer.email,
    role:                 trainer.role,
    weightUnitPreference: trainer.weightUnitPreference,
    emailVerified:        trainer.emailVerified,
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
    const { deviceId, deviceName } = extractDeviceInfo(request as any)

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

      // Seed the starter exercise library for this trainer — fire and forget,
      // don't block the registration response if it fails.
      seedExerciseLibrary(trainer.id).catch((err) => {
        ;(app.log as any).warn({ err }, 'Exercise library seed failed for new trainer')
      })

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
      ;(app.log as any).error(error)
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

**Rate limited:** 10 attempts per 15 minutes per IP. Returns 429 on excess.`,
      body: LoginSchema,
      response: {
        200: AuthResponseSchema,
        401: ErrorResponseSchema.describe('Invalid credentials'),
        429: ErrorResponseSchema.describe('Too many login attempts'),
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as z.infer<typeof LoginSchema>
    const { deviceId, deviceName } = extractDeviceInfo(request as any)

    try {
      const trainer = await db.query.trainers.findFirst({
        where: eq(trainers.email, email.toLowerCase()),
      })

      // Use the same error message whether email or password is wrong —
      // prevents email enumeration attacks
      if (!trainer) {
        return reply.status(401).send({ error: 'Invalid email or password' })
      }

      const valid = await verifyPassword(password, trainer.passwordHash)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid email or password' })
      }

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
        trainer: serializeTrainer(trainer),
      })
    } catch (error) {
      ;(app.log as any).error(error)
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
      ;(app.log as any).error(error)
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
      ;(app.log as any).error(error)
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
      ;(app.log as any).error(error)
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
      ;(app.log as any).error(error)
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
      ;(app.log as any).error(error)
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
      ;(app.log as any).error(error)
      return reply.status(500).send({ error: 'Failed to update profile' })
    }
  })
}
