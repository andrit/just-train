// ------------------------------------------------------------
// services/passwordReset.test.ts — forgot/reset lifecycle (account plan B6)
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined), values: vi.fn().mockResolvedValue(undefined) }
  const db: Record<string, unknown> = {
    query: {
      trainers:            { findFirst: vi.fn().mockResolvedValue(undefined) },
      passwordResetTokens: { findFirst: vi.fn().mockResolvedValue(undefined) },
    },
    update: vi.fn().mockReturnValue(chain), insert: vi.fn().mockReturnValue(chain),
  }
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
  return { db, trainers: {}, passwordResetTokens: {}, refreshTokens: {}, emailVerificationTokens: {} }
})
vi.mock('../../services/auth.service', () => ({
  hashPassword:           vi.fn().mockResolvedValue('$argon2id$new'),
  revokeAllRefreshTokens: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../services/email.service', () => ({
  emailConfig:            vi.fn().mockReturnValue({ apiKey: 'k', fromEmail: 'no-reply@just-train.fit', appUrl: 'https://just-train.fit' }),
  sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
  escapeHtml:             (s: string) => s,
}))

import { db } from '../../db'
import { hashPassword, revokeAllRefreshTokens } from '../../services/auth.service'
import { sendTransactionalEmail, emailConfig } from '../../services/email.service'
import { requestPasswordReset, resetPasswordWithToken, generateResetToken, RESET_TOKEN_TTL_MS } from '../../services/passwordReset.service'

const NOW = new Date('2026-09-15T12:00:00Z')

describe('requestPasswordReset', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('reports no_account and sends nothing for an unknown email', async () => {
    expect(await requestPasswordReset('nobody@x.io', NOW)).toBe('no_account')
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('invalidates earlier tokens, stores a hashed one with a 1h TTL, and emails a link on the app origin', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce({ id: 't-1', email: 'a@b.co', name: 'A' } as never)
    expect(await requestPasswordReset('A@B.co', NOW)).toBe('sent')
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(vi.mocked(db.update({} as never).set).mock.calls[0]?.[0]).toEqual({ usedAt: NOW })   // older tokens die
    const stored = vi.mocked(db.insert({} as never).values).mock.calls[0]?.[0] as unknown as { trainerId: string; tokenHash: string; expiresAt: Date }
    expect(stored.trainerId).toBe('t-1')
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/)                       // sha256 hex, never the raw token
    expect(stored.expiresAt).toEqual(new Date(NOW.getTime() + RESET_TOKEN_TTL_MS))
    const mail = vi.mocked(sendTransactionalEmail).mock.calls[0]?.[0] as { to: string; html: string }
    expect(mail.to).toBe('a@b.co')
    expect(mail.html).toContain('https://just-train.fit/reset-password?token=')
    expect(mail.html).not.toContain(stored.tokenHash)                        // the link carries the raw token, not the hash
  })

  it('applies a per-account cooldown', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce({ id: 't-1', email: 'a@b.co', name: 'A' } as never)
    vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValueOnce({ createdAt: new Date(NOW.getTime() - 20_000) } as never)
    expect(await requestPasswordReset('a@b.co', NOW)).toBe('cooldown')
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('reports send_failed (token stored, nothing thrown) when the sender is not configured', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce({ id: 't-1', email: 'a@b.co', name: 'A' } as never)
    vi.mocked(emailConfig).mockImplementationOnce(() => { throw new Error('APP_URL is not set') })
    expect(await requestPasswordReset('a@b.co', NOW)).toBe('send_failed')
  })
})

describe('resetPasswordWithToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('not_found / used / expired, each without touching the password', async () => {
    expect((await resetPasswordWithToken('x', 'new-password-1', NOW)).outcome).toBe('not_found')
    vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValueOnce({ id: 'r', trainerId: 't-1', usedAt: NOW, expiresAt: new Date(NOW.getTime() + 1000) } as never)
    expect((await resetPasswordWithToken('x', 'new-password-1', NOW)).outcome).toBe('used')
    vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValueOnce({ id: 'r', trainerId: 't-1', usedAt: null, expiresAt: new Date(NOW.getTime() - 1) } as never)
    expect((await resetPasswordWithToken('x', 'new-password-1', NOW)).outcome).toBe('expired')
    expect(hashPassword).not.toHaveBeenCalled()
    expect(revokeAllRefreshTokens).not.toHaveBeenCalled()
  })

  it('ok: marks the token used, stores the new hash, signs out every device', async () => {
    vi.mocked(db.query.passwordResetTokens.findFirst).mockResolvedValueOnce({ id: 'r', trainerId: 't-1', usedAt: null, expiresAt: new Date(NOW.getTime() + 1000) } as never)
    const result = await resetPasswordWithToken('raw', 'new-password-1', NOW)
    expect(result).toEqual({ outcome: 'ok', trainerId: 't-1' })
    expect(hashPassword).toHaveBeenCalledWith('new-password-1')
    const sets = vi.mocked(db.update({} as never).set).mock.calls.map((c) => c[0])
    expect(sets).toEqual([{ usedAt: NOW }, { passwordHash: '$argon2id$new', updatedAt: NOW }])
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('t-1')
  })
})

describe('generateResetToken', () => {
  it('is 48 random bytes with a sha256 hash', () => {
    const { raw, hash } = generateResetToken()
    expect(raw).toMatch(/^[0-9a-f]{96}$/)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(generateResetToken().raw).not.toBe(raw)
  })
})
