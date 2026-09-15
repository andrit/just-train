// ------------------------------------------------------------
// services/devices.test.ts — listActiveDevices groups token rows per device
// and reports the newest row's createdAt as last activity (rotation replaces
// rows, so that IS the last refresh); revokeDevice reports whether anything
// was revoked so the route can 404 instead of pretending.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]) }
  return {
    db: { query: { refreshTokens: { findMany: vi.fn().mockResolvedValue([]) } }, update: vi.fn().mockReturnValue(chain) },
    refreshTokens: {}, trainers: {}, emailVerificationTokens: {},
  }
})

import { db } from '../../db'
import { listActiveDevices, revokeDevice } from '../../services/auth.service'

describe('listActiveDevices', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('groups rows by device, keeps the newest createdAt, sorts newest first', async () => {
    vi.mocked(db.query.refreshTokens.findMany).mockResolvedValueOnce([
      { deviceId: 'phone',  deviceName: 'UA-phone', createdAt: new Date('2026-09-10T00:00:00Z') },
      { deviceId: 'laptop', deviceName: 'UA-laptop', createdAt: new Date('2026-09-14T00:00:00Z') },
      { deviceId: 'phone',  deviceName: 'UA-phone', createdAt: new Date('2026-09-15T00:00:00Z') },   // rotated later
    ] as never)
    const devices = await listActiveDevices('t-1')
    expect(devices).toEqual([
      { deviceId: 'phone',  deviceName: 'UA-phone',  lastActiveAt: new Date('2026-09-15T00:00:00Z') },
      { deviceId: 'laptop', deviceName: 'UA-laptop', lastActiveAt: new Date('2026-09-14T00:00:00Z') },
    ])
  })

  it('keeps a known device name when the newest row has none', async () => {
    vi.mocked(db.query.refreshTokens.findMany).mockResolvedValueOnce([
      { deviceId: 'phone', deviceName: 'UA-phone', createdAt: new Date('2026-09-10T00:00:00Z') },
      { deviceId: 'phone', deviceName: null,       createdAt: new Date('2026-09-15T00:00:00Z') },
    ] as never)
    expect((await listActiveDevices('t-1'))[0]?.deviceName).toBe('UA-phone')
  })

  it('is empty with no active tokens', async () => {
    expect(await listActiveDevices('t-1')).toEqual([])
  })
})

describe('revokeDevice', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns true when at least one token was revoked', async () => {
    vi.mocked(db.update({} as never).set({} as never).where({} as never).returning).mockResolvedValueOnce([{ id: 'x' }] as never)
    expect(await revokeDevice('t-1', 'phone')).toBe(true)
  })

  it('returns false when nothing matched (unknown device, or another trainer\'s)', async () => {
    expect(await revokeDevice('t-1', 'not-mine')).toBe(false)
  })
})
