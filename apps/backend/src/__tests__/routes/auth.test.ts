// ------------------------------------------------------------
// routes/auth.test.ts — Auth endpoint integration tests
//
// Tests every auth route via Fastify's inject() — no real HTTP server.
// The DB and auth.service are mocked so tests are:
//   - Fast (no real argon2 in route tests — that's covered in service tests)
//   - Deterministic (no side effects, no state between tests)
//   - Focused (each test verifies one behaviour)
//
// MOCK STRATEGY:
//   - db:           mocked entirely — routes never touch a real database
//   - auth.service: mocked for hashPassword, verifyPassword, token generation,
//                   and all DB-touching functions.
//                   generateAccessToken / verifyAccessToken are NOT mocked —
//                   we use the real JWT logic so the middleware tests stay honest.
//
// Each describe block owns its own mock setup and teardown.
// vi.clearAllMocks() in beforeEach prevents state from leaking between tests.
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildAuthTestApp }  from '../helpers/buildApp'
import {
  makeTrainer, makeRefreshToken,
  validRegisterBody, validLoginBody,
  TEST_TRAINER_ID, TEST_DEVICE_ID, TEST_TOKEN_ID,
} from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'

// ── Module mocks ──────────────────────────────────────────────────────────────
// vi.mock() calls are hoisted to the top of the file by Vitest.
// They must be declared before any imports that trigger the mocked modules.

vi.mock('../../db', () => ({
  db: {
    query: {
      trainers:      { findFirst: vi.fn() },
      refreshTokens: { findFirst: vi.fn() },
    },
    insert:      vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn() }) }),
    update:      vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn() }) }) }),
    delete:      vi.fn().mockReturnValue({ where: vi.fn() }),
    transaction: vi.fn(),
  },
  trainers:     {},
  refreshTokens:{},
  clients:      {},
}))

vi.mock('../../services/auth.service', async (importOriginal) => {
  // Keep real generateAccessToken and verifyAccessToken —
  // routes issue real tokens, middleware verifies them
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return {
    ...real,
    // Mock the slow/stateful functions
    hashPassword:             vi.fn().mockResolvedValue('$argon2id$mocked-hash'),
    verifyPassword:           vi.fn().mockResolvedValue(true),
    generateRefreshToken:     vi.fn().mockResolvedValue({ raw: 'raw-refresh-token', hash: 'hashed-refresh-token' }),
    storeRefreshToken:        vi.fn().mockResolvedValue(undefined),
    findAndVerifyRefreshToken:vi.fn().mockResolvedValue({
      id: '33333333-3333-3333-3333-333333333333',
      trainerId: '11111111-1111-1111-1111-111111111111',
      tokenHash: '$argon2id$v=19$m=65536,t=3,p=1$test-token-hash',
      deviceId: '44444444-4444-4444-4444-444444444444',
      deviceName: 'Test Browser',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      lastUsedAt: null,
    }),
    rotateRefreshToken:       vi.fn().mockResolvedValue({ raw: 'new-raw-refresh-token' }),
    revokeRefreshToken:       vi.fn().mockResolvedValue(undefined),
    revokeAllRefreshTokens:   vi.fn().mockResolvedValue(undefined),
    refreshTokenCookieOptions:real.refreshTokenCookieOptions,
    REFRESH_TOKEN_COOKIE:     real.REFRESH_TOKEN_COOKIE,
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(trainerId = TEST_TRAINER_ID, role: 'trainer' | 'admin' = 'trainer') {
  return `Bearer ${generateAccessToken(trainerId, role)}`
}

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  let app: Awaited<ReturnType<typeof buildAuthTestApp>>

  beforeAll(async () => { app = await buildAuthTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 201 with accessToken and trainer on success', async () => {
    const { db }     = await import('../../db')
    const newTrainer = makeTrainer()

    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(undefined) // no duplicate
    // insert().values().returning() → return the new trainer
    const returnMock = vi.fn().mockResolvedValueOnce([newTrainer])
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValue({ returning: returnMock }),
    } as any)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/register',
      payload: validRegisterBody,
      headers: { 'x-device-id': TEST_DEVICE_ID },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body).toHaveProperty('accessToken')
    expect(body).toHaveProperty('trainer')
    expect(body.trainer.email).toBe(newTrainer.email)
    // passwordHash must never appear in the response
    expect(JSON.stringify(body)).not.toContain('passwordHash')
    expect(JSON.stringify(body)).not.toContain('password_hash')
  })

  it('returns 409 when email is already registered', async () => {
    const { db } = await import('../../db')

    // Simulate existing trainer found
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(makeTrainer())

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/register',
      payload: validRegisterBody,
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toMatch(/already exists/i)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/register',
      payload: { email: 'no-name@example.com' }, // missing name and password
    })

    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when password is too short', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/register',
      payload: { ...validRegisterBody, password: 'short' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('sets an httpOnly cookie on success', async () => {
    const { db }     = await import('../../db')
    const newTrainer = makeTrainer()

    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(undefined)
    vi.mocked(db.insert).mockReturnValueOnce({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([newTrainer]) }),
    } as any)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/register',
      payload: validRegisterBody,
      headers: { 'x-device-id': TEST_DEVICE_ID },
    })

    const setCookie = res.headers['set-cookie'] as string
    expect(setCookie).toBeDefined()
    expect(setCookie).toContain('HttpOnly')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  let app: Awaited<ReturnType<typeof buildAuthTestApp>>

  beforeAll(async () => { app = await buildAuthTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 200 with accessToken and trainer on valid credentials', async () => {
    const { db }          = await import('../../db')
    const { verifyPassword } = await import('../../services/auth.service')
    const trainer            = makeTrainer()

    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(trainer)
    vi.mocked(verifyPassword).mockResolvedValueOnce(true)
    // update().set().where().returning() for lastLoginAt
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([trainer]) }),
      }),
    } as any)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/login',
      payload: validLoginBody,
      headers: { 'x-device-id': TEST_DEVICE_ID },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('accessToken')
    expect(body.trainer.id).toBe(TEST_TRAINER_ID)
    expect(JSON.stringify(body)).not.toContain('passwordHash')
  })

  it('returns 401 when email is not found', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/login',
      payload: validLoginBody,
    })

    expect(res.statusCode).toBe(401)
    // Same message for unknown email and wrong password — prevents enumeration
    expect(res.json().error).toMatch(/invalid email or password/i)
  })

  it('returns 401 when password is wrong', async () => {
    const { db }          = await import('../../db')
    const { verifyPassword } = await import('../../services/auth.service')

    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(makeTrainer())
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/login',
      payload: { ...validLoginBody, password: 'wrongpassword' },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toMatch(/invalid email or password/i)
  })

  it('uses the same error message for unknown email and wrong password (prevents enumeration)', async () => {
    const { db }          = await import('../../db')
    const { verifyPassword } = await import('../../services/auth.service')

    // Unknown email
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(undefined)
    const notFoundRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login', payload: validLoginBody,
    })

    // Wrong password
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(makeTrainer())
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    const wrongPassRes = await app.inject({
      method: 'POST', url: '/api/v1/auth/login', payload: validLoginBody,
    })

    expect(notFoundRes.json().error).toBe(wrongPassRes.json().error)
  })

  it('returns 400 when body is missing required fields', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/login',
      payload: { email: 'only@email.com' }, // missing password
    })

    expect(res.statusCode).toBe(400)
  })

  it('sets an httpOnly cookie on successful login', async () => {
    const { db }          = await import('../../db')
    const { verifyPassword } = await import('../../services/auth.service')

    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(makeTrainer())
    vi.mocked(verifyPassword).mockResolvedValueOnce(true)
    vi.mocked(db.update).mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValueOnce([makeTrainer()]) }),
      }),
    } as any)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/login',
      payload: validLoginBody,
      headers: { 'x-device-id': TEST_DEVICE_ID },
    })

    const setCookie = res.headers['set-cookie'] as string
    expect(setCookie).toBeDefined()
    expect(setCookie).toContain('HttpOnly')
  })

  it('returns 400 when email is not a valid email format', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/login',
      payload: { email: 'not-an-email', password: 'password123' },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/refresh', () => {
  let app: Awaited<ReturnType<typeof buildAuthTestApp>>

  beforeAll(async () => { app = await buildAuthTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 when no refresh cookie is present', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/refresh',
      headers: { 'x-trainer-id': TEST_TRAINER_ID, 'x-device-id': TEST_DEVICE_ID },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toMatch(/missing/i)
  })

  it('returns 401 when X-Trainer-ID or X-Device-ID headers are missing', async () => {
    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/refresh',
      cookies: { trainer_refresh_token: 'some-raw-token' },
      // No x-trainer-id or x-device-id headers
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 when refresh token is not found or invalid', async () => {
    const { findAndVerifyRefreshToken } = await import('../../services/auth.service')
    vi.mocked(findAndVerifyRefreshToken).mockResolvedValueOnce(null)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/refresh',
      cookies: { trainer_refresh_token: 'invalid-token' },
      headers: { 'x-trainer-id': TEST_TRAINER_ID, 'x-device-id': TEST_DEVICE_ID },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toMatch(/invalid or expired/i)
  })

  it('returns 200 with a new accessToken on a valid refresh', async () => {
    const { db }                      = await import('../../db')
    const { findAndVerifyRefreshToken } = await import('../../services/auth.service')
    const trainer                       = makeTrainer()

    vi.mocked(findAndVerifyRefreshToken).mockResolvedValueOnce(makeRefreshToken())
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(trainer)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/refresh',
      cookies: { trainer_refresh_token: 'valid-raw-token' },
      headers: { 'x-trainer-id': TEST_TRAINER_ID, 'x-device-id': TEST_DEVICE_ID },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('accessToken')
    expect(body.trainer.id).toBe(TEST_TRAINER_ID)
  })

  it('rotates the refresh token — calls rotateRefreshToken on success', async () => {
    const { db }                      = await import('../../db')
    const { findAndVerifyRefreshToken, rotateRefreshToken } = await import('../../services/auth.service')

    vi.mocked(findAndVerifyRefreshToken).mockResolvedValueOnce(makeRefreshToken())
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(makeTrainer())

    await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/refresh',
      cookies: { trainer_refresh_token: 'valid-raw-token' },
      headers: { 'x-trainer-id': TEST_TRAINER_ID, 'x-device-id': TEST_DEVICE_ID },
    })

    expect(rotateRefreshToken).toHaveBeenCalledOnce()
    expect(vi.mocked(rotateRefreshToken)).toHaveBeenCalledWith(
      expect.objectContaining({ oldTokenId: TEST_TOKEN_ID, trainerId: TEST_TRAINER_ID }),
    )
  })

  it('sets a new httpOnly cookie on successful refresh', async () => {
    const { db }                      = await import('../../db')
    const { findAndVerifyRefreshToken } = await import('../../services/auth.service')

    vi.mocked(findAndVerifyRefreshToken).mockResolvedValueOnce(makeRefreshToken())
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(makeTrainer())

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/refresh',
      cookies: { trainer_refresh_token: 'valid-raw-token' },
      headers: { 'x-trainer-id': TEST_TRAINER_ID, 'x-device-id': TEST_DEVICE_ID },
    })

    const setCookie = res.headers['set-cookie'] as string
    expect(setCookie).toBeDefined()
    expect(setCookie).toContain('HttpOnly')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  let app: Awaited<ReturnType<typeof buildAuthTestApp>>

  beforeAll(async () => { app = await buildAuthTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without a valid access token', async () => {
    const res = await app.inject({
      method: 'POST',
      url:    '/api/v1/auth/logout',
      // No Authorization header
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 200 and clears the cookie when authenticated', async () => {
    const { findAndVerifyRefreshToken, revokeRefreshToken } = await import('../../services/auth.service')

    vi.mocked(findAndVerifyRefreshToken).mockResolvedValueOnce(makeRefreshToken())
    vi.mocked(revokeRefreshToken).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/logout',
      headers: {
        authorization: authHeader(),
        'x-device-id': TEST_DEVICE_ID,
      },
      cookies: { trainer_refresh_token: 'raw-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ message: expect.any(String) })
  })

  it('calls revokeRefreshToken when a valid cookie is present', async () => {
    const { findAndVerifyRefreshToken, revokeRefreshToken } = await import('../../services/auth.service')

    vi.mocked(findAndVerifyRefreshToken).mockResolvedValueOnce(makeRefreshToken())

    await app.inject({
      method:  'POST',
      url:     '/api/v1/auth/logout',
      headers: { authorization: authHeader(), 'x-device-id': TEST_DEVICE_ID },
      cookies: { trainer_refresh_token: 'raw-token' },
    })

    expect(revokeRefreshToken).toHaveBeenCalledWith(TEST_TOKEN_ID)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  let app: Awaited<ReturnType<typeof buildAuthTestApp>>

  beforeAll(async () => { app = await buildAuthTestApp() })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' })
    expect(res.statusCode).toBe(401)
  })

  it('returns the trainer profile for an authenticated request', async () => {
    const { db }  = await import('../../db')
    const trainer = makeTrainer()

    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(trainer)

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/auth/me',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.id).toBe(TEST_TRAINER_ID)
    expect(body.email).toBe('trainer@example.com')
    expect(JSON.stringify(body)).not.toContain('passwordHash')
  })

  it('returns 404 if the trainer record no longer exists', async () => {
    const { db } = await import('../../db')
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(undefined)

    const res = await app.inject({
      method:  'GET',
      url:     '/api/v1/auth/me',
      headers: { authorization: authHeader() },
    })

    expect(res.statusCode).toBe(404)
  })
})
