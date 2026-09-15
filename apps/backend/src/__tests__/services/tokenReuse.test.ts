// ------------------------------------------------------------
// services/tokenReuse.test.ts — the pure classifier behind reuse detection
// (account plan A3), plus rotate-by-marking and the cleanup query shape.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]) }
  const db: Record<string, unknown> = {
    query: { refreshTokens: { findMany: vi.fn().mockResolvedValue([]) } },
    update: vi.fn().mockReturnValue(chain), insert: vi.fn().mockReturnValue(chain), delete: vi.fn().mockReturnValue(chain),
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  }
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
  return { db, refreshTokens: {}, trainers: {}, emailVerificationTokens: {}, chain }
})

import { db } from '../../db'
import { classifyPresentedToken, rotateRefreshToken, cleanupRefreshTokens, ROTATION_GRACE_MS } from '../../services/auth.service'

const NOW = new Date('2026-09-15T12:00:00Z')
const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000)

describe('classifyPresentedToken', () => {
  it('valid: not revoked', () => {
    expect(classifyPresentedToken({ revokedAt: null, lastUsedAt: null }, NOW)).toBe('valid')
  })
  it('grace: rotated within the window (the two-tabs race)', () => {
    expect(classifyPresentedToken({ revokedAt: secondsAgo(3), lastUsedAt: secondsAgo(3) }, NOW)).toBe('grace')
    expect(classifyPresentedToken({ revokedAt: secondsAgo(10), lastUsedAt: secondsAgo(10) }, NOW)).toBe('grace')   // boundary inclusive
  })
  it('reuse: rotated beyond the window — the token was copied', () => {
    expect(classifyPresentedToken({ revokedAt: secondsAgo(11), lastUsedAt: secondsAgo(11) }, NOW)).toBe('reuse')
    expect(classifyPresentedToken({ revokedAt: secondsAgo(86_400), lastUsedAt: secondsAgo(86_400) }, NOW)).toBe('reuse')
  })
  it('stale: revoked by logout (never rotated) — not proof of theft', () => {
    expect(classifyPresentedToken({ revokedAt: secondsAgo(500), lastUsedAt: null }, NOW)).toBe('stale')
  })
  it('the grace window is short', () => {
    expect(ROTATION_GRACE_MS).toBeLessThanOrEqual(15_000)
  })
})

describe('rotateRefreshToken marks rather than deletes', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('stamps revokedAt + lastUsedAt on the old row and inserts the replacement in one transaction', async () => {
    await rotateRefreshToken({ oldTokenId: 'old', trainerId: 't-1', deviceId: 'dev', deviceName: null })
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.delete).not.toHaveBeenCalled()
    const marked = vi.mocked(db.update({} as never).set).mock.calls[0]?.[0] as { revokedAt: Date; lastUsedAt: Date }
    expect(marked.revokedAt).toBeInstanceOf(Date)
    expect(marked.lastUsedAt).toEqual(marked.revokedAt)
    expect(db.insert).toHaveBeenCalledTimes(1)
  })
})

describe('cleanupRefreshTokens', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('issues one delete and reports how many rows went', async () => {
    vi.mocked(db.delete({} as never).where({} as never).returning).mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }] as never)
    vi.mocked(db.delete).mockClear()   // the setup line above called db.delete once
    expect(await cleanupRefreshTokens(NOW)).toBe(2)
    expect(db.delete).toHaveBeenCalledTimes(1)
  })
})
