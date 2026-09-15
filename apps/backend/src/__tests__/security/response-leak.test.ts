// ------------------------------------------------------------
// security/response-leak.test.ts — the password hash can never reach a response.
//
// Two independent guards: the serializer is an explicit field list (so a new
// column is not returned by accident), and the response schema strips unknown
// keys (so even a raw row could not carry the hash out). Both must hold.
// ------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../db', () => ({ db: {}, trainers: {}, clients: {}, refreshTokens: {}, emailVerificationTokens: {}, exercises: {} }))

import { TrainerResponseSchema } from '@trainer-app/shared'
import { makeTrainer } from '../helpers/factories'
import { serializeTrainer } from '../../routes/auth'

describe('response leak — passwordHash', () => {
  it('serializeTrainer never emits passwordHash (explicit field list)', () => {
    const out = serializeTrainer(makeTrainer({ passwordHash: '$argon2id$secret' }))
    expect(out).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(out)).not.toContain('argon2')
  })

  it('TrainerResponseSchema strips passwordHash even if a serializer ever leaked it', () => {
    const leaked = { ...serializeTrainer(makeTrainer()), passwordHash: '$argon2id$secret' }
    const parsed = TrainerResponseSchema.safeParse(leaked)
    expect(parsed.success).toBe(true)
    expect(parsed.data).not.toHaveProperty('passwordHash')
  })
})
