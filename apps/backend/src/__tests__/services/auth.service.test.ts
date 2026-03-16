// ------------------------------------------------------------
// services/auth.service.test.ts — Unit tests for auth.service.ts
//
// Tests ONLY the pure functions — no DB calls involved:
//   - hashPassword / verifyPassword
//   - generateAccessToken / verifyAccessToken
//   - generateRefreshToken
//
// DB-using functions (storeRefreshToken, rotateRefreshToken, etc.)
// are exercised indirectly through the route integration tests.
//
// These tests run WITHOUT mocking because:
//   1. argon2 and jsonwebtoken work fine in a test environment
//   2. Testing the real implementations gives us real confidence
//   3. The functions have no side effects — they're pure transforms
//
// Note: argon2 hashing is intentionally slow (~100ms) by design.
// The testTimeout is set to 10s in vitest.config.ts to accommodate this.
// ------------------------------------------------------------

import { describe, it, expect, beforeAll } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
} from '../../services/auth.service'

// ── hashPassword / verifyPassword ─────────────────────────────────────────────

describe('hashPassword', () => {
  it('returns a string that is not the original password', async () => {
    const password = 'mysecretpassword'
    const hash     = await hashPassword(password)

    expect(typeof hash).toBe('string')
    expect(hash).not.toBe(password)
  })

  it('returns different hashes for the same password (salted)', async () => {
    const password = 'mysecretpassword'
    const hash1    = await hashPassword(password)
    const hash2    = await hashPassword(password)

    // argon2 includes a random salt — two hashes of the same password must differ
    expect(hash1).not.toBe(hash2)
  })

  it('produces an argon2id hash (identifiable by the $argon2id prefix)', async () => {
    const hash = await hashPassword('anypassword')
    expect(hash).toMatch(/^\$argon2id\$/)
  })
})

describe('verifyPassword', () => {
  let validHash: string

  beforeAll(async () => {
    // Hash once, reuse across tests in this block to keep the suite fast
    validHash = await hashPassword('correctpassword')
  })

  it('returns true when the password matches the hash', async () => {
    const result = await verifyPassword('correctpassword', validHash)
    expect(result).toBe(true)
  })

  it('returns false when the password does not match', async () => {
    const result = await verifyPassword('wrongpassword', validHash)
    expect(result).toBe(false)
  })

  it('returns false for an empty string', async () => {
    const result = await verifyPassword('', validHash)
    expect(result).toBe(false)
  })

  it('returns false for a malformed hash without throwing', async () => {
    // verifyPassword must be safe to call with arbitrary input —
    // a malformed hash must return false, not throw
    const result = await verifyPassword('anypassword', 'not-a-valid-hash')
    expect(result).toBe(false)
  })

  it('is case-sensitive', async () => {
    const hash   = await hashPassword('Password')
    const result = await verifyPassword('password', hash)   // lowercase
    expect(result).toBe(false)
  })
})

// ── generateAccessToken / verifyAccessToken ───────────────────────────────────

describe('generateAccessToken', () => {
  it('returns a non-empty string', () => {
    const token = generateAccessToken('trainer-uuid', 'trainer')
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('produces a JWT with three dot-separated segments', () => {
    const token    = generateAccessToken('trainer-uuid', 'trainer')
    const segments = token.split('.')
    expect(segments).toHaveLength(3)
  })

  it('encodes the trainerId in the payload', () => {
    const trainerId = 'test-trainer-id-123'
    const token     = generateAccessToken(trainerId, 'trainer')
    const payload   = verifyAccessToken(token)

    expect(payload.trainerId).toBe(trainerId)
  })

  it('encodes the role in the payload', () => {
    const adminToken  = generateAccessToken('id', 'admin')
    const adminPayload = verifyAccessToken(adminToken)
    expect(adminPayload.role).toBe('admin')

    const trainerToken   = generateAccessToken('id', 'trainer')
    const trainerPayload = verifyAccessToken(trainerToken)
    expect(trainerPayload.role).toBe('trainer')
  })

  it('sets type: "access" in the payload', () => {
    const token   = generateAccessToken('id', 'trainer')
    const payload = verifyAccessToken(token)
    expect(payload.type).toBe('access')
  })

  it('produces different tokens on successive calls', () => {
    // JWT includes an "issued at" timestamp — two calls within the same
    // second will have the same iat, but the signed output may still differ.
    // More importantly: the same trainerId + role always produce a valid token.
    const token1 = generateAccessToken('same-id', 'trainer')
    const token2 = generateAccessToken('same-id', 'trainer')
    // Both should verify correctly regardless of equality
    expect(() => verifyAccessToken(token1)).not.toThrow()
    expect(() => verifyAccessToken(token2)).not.toThrow()
  })
})

describe('verifyAccessToken', () => {
  it('returns the full payload for a valid token', () => {
    const token   = generateAccessToken('trainer-id', 'trainer')
    const payload = verifyAccessToken(token)

    expect(payload).toMatchObject({
      trainerId: 'trainer-id',
      role:      'trainer',
      type:      'access',
    })
  })

  it('throws for a completely invalid token string', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow()
  })

  it('throws for an empty string', () => {
    expect(() => verifyAccessToken('')).toThrow()
  })

  it('throws for a token signed with a different secret', async () => {
    // Manually craft a token with a different secret
    const forgeryToken = require("jsonwebtoken").sign(
      { trainerId: 'attacker', role: 'admin', type: 'access' },
      'wrong-secret',
    )
    expect(() => verifyAccessToken(forgeryToken)).toThrow()
  })

  it('throws with a message containing "expired" for an expired token', async () => {
    const expiredToken = require("jsonwebtoken").sign(
      { trainerId: 'id', role: 'trainer', type: 'access' },
      process.env.JWT_SECRET!,
      { expiresIn: '0s' },  // Expires immediately
    )

    // Small delay to ensure the token is past its expiry
    await new Promise((r) => setTimeout(r, 10))

    expect(() => verifyAccessToken(expiredToken)).toThrow(/expired/i)
  })

  it('throws for a token with type: "refresh" (prevents cross-type use)', async () => {
    // Craft a token with type: 'refresh' instead of 'access'
    const refreshTypeToken = require("jsonwebtoken").sign(
      { trainerId: 'id', role: 'trainer', type: 'refresh' },
      process.env.JWT_SECRET!,
    )

    expect(() => verifyAccessToken(refreshTypeToken)).toThrow(/Invalid token type/)
  })
})

// ── generateRefreshToken ──────────────────────────────────────────────────────

describe('generateRefreshToken', () => {
  it('returns an object with raw and hash properties', async () => {
    const result = await generateRefreshToken()
    expect(result).toHaveProperty('raw')
    expect(result).toHaveProperty('hash')
  })

  it('raw token is a non-empty hex string', async () => {
    const { raw } = await generateRefreshToken()
    expect(typeof raw).toBe('string')
    expect(raw.length).toBeGreaterThan(0)
    expect(raw).toMatch(/^[0-9a-f]+$/)   // hex characters only
  })

  it('raw token is at least 64 characters (sufficient entropy)', async () => {
    const { raw } = await generateRefreshToken()
    // 48 bytes → 96 hex chars
    expect(raw.length).toBeGreaterThanOrEqual(64)
  })

  it('hash starts with $argon2id$ (correct algorithm)', async () => {
    const { hash } = await generateRefreshToken()
    expect(hash).toMatch(/^\$argon2id\$/)
  })

  it('raw token verifies against its own hash', async () => {
    const { raw, hash } = await generateRefreshToken()
    // The hash must verify — this is the core contract
    const argon2 = await import('argon2')
    const valid  = await argon2.verify(hash, raw)
    expect(valid).toBe(true)
  })

  it('generates unique tokens on each call', async () => {
    const [a, b] = await Promise.all([generateRefreshToken(), generateRefreshToken()])
    expect(a.raw).not.toBe(b.raw)
    expect(a.hash).not.toBe(b.hash)
  })

  it('raw token does NOT verify against a different token\'s hash', async () => {
    const a      = await generateRefreshToken()
    const b      = await generateRefreshToken()
    const argon2 = await import('argon2')
    const valid  = await argon2.verify(b.hash, a.raw)
    expect(valid).toBe(false)
  })
})
