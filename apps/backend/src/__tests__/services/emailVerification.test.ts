// ------------------------------------------------------------
// services/emailVerification.test.ts — change-email + redeem (account plan B7)
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined), values: vi.fn().mockResolvedValue(undefined) }
  const db: Record<string, unknown> = {
    query: {
      trainers:                { findFirst: vi.fn().mockResolvedValue(undefined) },
      emailVerificationTokens: { findFirst: vi.fn().mockResolvedValue(undefined) },
    },
    update: vi.fn().mockReturnValue(chain), insert: vi.fn().mockReturnValue(chain),
  }
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
  return { db, trainers: {}, emailVerificationTokens: {}, refreshTokens: {}, passwordResetTokens: {} }
})
vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real, verifyPassword: vi.fn().mockResolvedValue(true) }
})
vi.mock('../../services/email.service', () => ({
  emailConfig:            vi.fn().mockReturnValue({ apiKey: 'k', fromEmail: 'no-reply@just-train.fit', appUrl: 'https://just-train.fit' }),
  sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
  escapeHtml:             (s: string) => s,
}))

import { db } from '../../db'
import { verifyPassword, sha256 } from '../../services/auth.service'
import { sendTransactionalEmail } from '../../services/email.service'
import { requestEmailChange, cancelEmailChange, redeemVerificationToken } from '../../services/emailVerification.service'

const NOW     = new Date('2026-09-15T12:00:00Z')
const TRAINER = { id: 't-1', name: 'A', email: 'old@x.io', passwordHash: '$argon2id$h' }

type Call = Record<string, unknown>
const setCalls = (): Call[] => vi.mocked(db.update({} as never).set).mock.calls.map((c) => c[0] as Call)
const mailCalls = (): { to: string; subject: string; html: string }[] =>
  vi.mocked(sendTransactionalEmail).mock.calls.map((c) => c[0] as { to: string; subject: string; html: string })

describe('requestEmailChange', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('refuses a wrong password before touching anything', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(TRAINER as never)
    vi.mocked(verifyPassword).mockResolvedValueOnce(false)
    expect((await requestEmailChange('t-1', 'new@x.io', 'bad', NOW)).outcome).toBe('wrong_password')
    expect(db.transaction).not.toHaveBeenCalled()
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('rejects the current address (case-insensitively)', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(TRAINER as never)
    expect((await requestEmailChange('t-1', ' OLD@x.io ', 'pw', NOW)).outcome).toBe('same_email')
  })

  it('reports taken when another account holds the address', async () => {
    vi.mocked(db.query.trainers.findFirst)
      .mockResolvedValueOnce(TRAINER as never)
      .mockResolvedValueOnce({ id: 't-2' } as never)
    expect((await requestEmailChange('t-1', 'new@x.io', 'pw', NOW)).outcome).toBe('taken')
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('applies the 60 s cooldown across the trainer\'s tokens', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(TRAINER as never).mockResolvedValueOnce(undefined)
    vi.mocked(db.query.emailVerificationTokens.findFirst).mockResolvedValueOnce({ createdAt: new Date(NOW.getTime() - 30_000) } as never)
    expect((await requestEmailChange('t-1', 'new@x.io', 'pw', NOW)).outcome).toBe('cooldown')
  })

  it('consumes earlier tokens, stores a change token bound to the new address, sets pendingEmail, mails the NEW address', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(TRAINER as never).mockResolvedValueOnce(undefined)
    const res = await requestEmailChange('t-1', 'New@X.io', 'pw', NOW)
    expect(res).toEqual({ outcome: 'sent', pendingEmail: 'new@x.io' })

    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(setCalls()[0]).toEqual({ usedAt: NOW })                              // older tokens die
    const stored = vi.mocked(db.insert({} as never).values).mock.calls[0]?.[0] as unknown as { newEmail: string; tokenHash: string }
    expect(stored.newEmail).toBe('new@x.io')                                    // the token carries the target
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(setCalls()[1]).toEqual({ pendingEmail: 'new@x.io', updatedAt: NOW })

    const [mail] = mailCalls()
    expect(mail?.to).toBe('new@x.io')
    expect(mail?.html).toContain('https://just-train.fit/verify-email?token=')
    expect(mail?.html).not.toContain(stored.tokenHash)
  })

  it('reports send_failed but keeps the pending change so it can be retried', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(TRAINER as never).mockResolvedValueOnce(undefined)
    vi.mocked(sendTransactionalEmail).mockRejectedValueOnce(new Error('resend down'))
    expect(await requestEmailChange('t-1', 'new@x.io', 'pw', NOW)).toEqual({ outcome: 'send_failed', pendingEmail: 'new@x.io' })
    expect(db.transaction).toHaveBeenCalledTimes(1)
  })
})

describe('cancelEmailChange', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('consumes open tokens and clears pendingEmail in one transaction', async () => {
    await cancelEmailChange('t-1', NOW)
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(setCalls()).toEqual([{ usedAt: NOW }, { pendingEmail: null, updatedAt: NOW }])
  })
})

describe('redeemVerificationToken', () => {
  beforeEach(() => { vi.clearAllMocks() })
  const raw  = 'a'.repeat(96)
  const live = { id: 'tok', trainerId: 't-1', tokenHash: sha256(raw), usedAt: null, expiresAt: new Date(NOW.getTime() + 60_000) }

  it('not_found / used / expired', async () => {
    expect((await redeemVerificationToken(raw, NOW)).outcome).toBe('not_found')
    vi.mocked(db.query.emailVerificationTokens.findFirst).mockResolvedValueOnce({ ...live, usedAt: NOW } as never)
    expect((await redeemVerificationToken(raw, NOW)).outcome).toBe('used')
    vi.mocked(db.query.emailVerificationTokens.findFirst).mockResolvedValueOnce({ ...live, expiresAt: NOW } as never)
    expect((await redeemVerificationToken(raw, NOW)).outcome).toBe('expired')
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('a plain token verifies the current address and never changes it', async () => {
    vi.mocked(db.query.emailVerificationTokens.findFirst).mockResolvedValueOnce({ ...live, newEmail: null } as never)
    expect(await redeemVerificationToken(raw, NOW)).toEqual({ outcome: 'ok' })
    expect(setCalls()).toEqual([{ usedAt: NOW }, { emailVerified: true, updatedAt: NOW }])
    expect(sendTransactionalEmail).not.toHaveBeenCalled()
  })

  it('a change token swaps the sign-in email, clears pending, marks verified, and notifies the OLD address', async () => {
    vi.mocked(db.query.emailVerificationTokens.findFirst).mockResolvedValueOnce({ ...live, newEmail: 'new@x.io' } as never)
    vi.mocked(db.query.trainers.findFirst)
      .mockResolvedValueOnce(undefined)                                          // nobody holds new@x.io
      .mockResolvedValueOnce({ name: 'A', email: 'old@x.io' } as never)
    expect(await redeemVerificationToken(raw, NOW)).toEqual({ outcome: 'ok', changedTo: 'new@x.io' })
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(setCalls()).toEqual([
      { usedAt: NOW },
      { email: 'new@x.io', pendingEmail: null, emailVerified: true, updatedAt: NOW },
    ])
    const [notice] = mailCalls()
    expect(notice?.to).toBe('old@x.io')
    expect(notice?.html).toContain('new@x.io')
    expect(notice?.html).toContain('/forgot-password')
  })

  it('a failed notice does not undo the swap', async () => {
    vi.mocked(db.query.emailVerificationTokens.findFirst).mockResolvedValueOnce({ ...live, newEmail: 'new@x.io' } as never)
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ name: 'A', email: 'old@x.io' } as never)
    vi.mocked(sendTransactionalEmail).mockRejectedValueOnce(new Error('resend down'))
    expect(await redeemVerificationToken(raw, NOW)).toEqual({ outcome: 'ok', changedTo: 'new@x.io' })
  })

  it('taken: the address was registered meanwhile — token consumed, nothing swapped', async () => {
    vi.mocked(db.query.emailVerificationTokens.findFirst).mockResolvedValueOnce({ ...live, newEmail: 'new@x.io' } as never)
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce({ id: 't-2' } as never)
    expect(await redeemVerificationToken(raw, NOW)).toEqual({ outcome: 'taken' })
    expect(db.transaction).not.toHaveBeenCalled()
    expect(setCalls()).toEqual([{ usedAt: NOW }])
  })
})
