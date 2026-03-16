// ------------------------------------------------------------
// middleware/authenticate.test.ts
//
// Tests the authenticate preHandler in isolation using a minimal
// Fastify app with a single test route behind the middleware.
//
// We test the middleware's own logic — not the routes it protects.
// That means: header parsing, token format checks, expired token
// detection, valid token → request.trainer population.
//
// The db module is mocked because authenticate.ts imports
// auth.service.ts which in turn imports db at module level.
// The middleware itself never calls the DB, but the import chain
// requires the mock to exist.
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { generateAccessToken } from '../../services/auth.service'
import { authenticate }        from '../../middleware/authenticate'

// Mock db — authenticate never uses it, but the import chain needs it
vi.mock('../../db', () => ({
  db:           { query: { trainers: { findFirst: vi.fn() } } },
  trainers:     {},
  refreshTokens:{},
  clients:      {},
}))

// ── Minimal test app ──────────────────────────────────────────────────────────

// A single protected route that echoes back what authenticate put on request.trainer
async function buildMiddlewareTestApp() {
  const app = Fastify({ logger: false })
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.get('/protected', { preHandler: [authenticate] }, async (request) => {
    return { trainer: request.trainer }
  })

  await app.ready()
  return app
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  let app: Awaited<ReturnType<typeof buildMiddlewareTestApp>>

  beforeAll(async () => { app = await buildMiddlewareTestApp() })
  afterAll(async ()  => { await app.close() })

  // ── Missing / malformed header ───────────────────────────────────────────

  it('returns 401 when Authorization header is absent', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'Authorization header required' })
  })

  it('returns 401 when Authorization header does not start with "Bearer "', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toMatch(/Bearer/i)
  })

  it('returns 401 when token string is present but completely invalid', async () => {
    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: 'Bearer this.is.garbage' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 with code TOKEN_EXPIRED for an expired token', async () => {
    const expired = require("jsonwebtoken").sign(
      { trainerId: 'id', role: 'trainer', type: 'access' },
      process.env.JWT_SECRET!,
      { expiresIn: '0s' },
    )
    await new Promise((r) => setTimeout(r, 10))

    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: `Bearer ${expired}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({
      error: 'Token expired',
      code:  'TOKEN_EXPIRED',
    })
  })

  it('returns 401 for a token signed with a different secret', async () => {
    const forgeryToken = require("jsonwebtoken").sign(
      { trainerId: 'id', role: 'trainer', type: 'access' },
      'completely-wrong-secret',
    )

    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: `Bearer ${forgeryToken}` },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ error: 'Invalid token' })
  })

  it('returns 401 for a token with type "refresh" used as access token', async () => {
    const wrongType = require("jsonwebtoken").sign(
      { trainerId: 'id', role: 'trainer', type: 'refresh' },
      process.env.JWT_SECRET!,
    )

    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: `Bearer ${wrongType}` },
    })

    expect(res.statusCode).toBe(401)
    // Invalid token type is caught by verifyAccessToken
    expect(res.json().error).toBeDefined()
  })

  // ── Valid token ───────────────────────────────────────────────────────────

  it('calls the route handler and returns 200 for a valid token', async () => {
    const token = generateAccessToken('trainer-id-abc', 'trainer')

    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
  })

  it('populates request.trainer with the correct trainerId from the token', async () => {
    const trainerId = 'trainer-uuid-999'
    const token     = generateAccessToken(trainerId, 'trainer')

    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().trainer.trainerId).toBe(trainerId)
  })

  it('populates request.trainer with the correct role', async () => {
    const token = generateAccessToken('some-id', 'admin')

    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.json().trainer.role).toBe('admin')
  })

  it('populates request.trainer.type as "access"', async () => {
    const token = generateAccessToken('some-id', 'trainer')

    const res = await app.inject({
      method:  'GET',
      url:     '/protected',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.json().trainer.type).toBe('access')
  })
})
