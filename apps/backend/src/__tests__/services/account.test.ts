// ------------------------------------------------------------
// services/account.test.ts — soft delete / restore window / the ORDER of the
// hard purge (account plan A5).
//
// The purge order is the whole point: two RESTRICT foreign keys make a bare
// cascade order-dependent. Tables are mocked as named sentinels so the
// sequence of db.delete() calls can be asserted.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => {
  const chain = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined), values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]) }
  const t = (name: string) => ({ __table: name, id: `${name}.id`, trainerId: `${name}.trainerId`, exerciseId: `${name}.exerciseId`, deactivatedAt: `${name}.deactivatedAt` })
  const db: Record<string, unknown> = {
    query: {
      clients:           { findMany: vi.fn().mockResolvedValue([]) },
      exercises:         { findMany: vi.fn().mockResolvedValue([]) },
      sessionExercises:  { findMany: vi.fn().mockResolvedValue([]) },
      templateExercises: { findMany: vi.fn().mockResolvedValue([]) },
      challenges:        { findMany: vi.fn().mockResolvedValue([]) },
      trainers:          { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(undefined) },
      clientGoals:       { findMany: vi.fn().mockResolvedValue([]) },
      clientSnapshots:   { findMany: vi.fn().mockResolvedValue([]) },
      sessions:          { findMany: vi.fn().mockResolvedValue([]) },
      templates:         { findMany: vi.fn().mockResolvedValue([]) },
      snapshotMedia:     { findMany: vi.fn().mockResolvedValue([]) },
      sessionExerciseMedia: { findMany: vi.fn().mockResolvedValue([]) },
      clientEvents:      { findMany: vi.fn().mockResolvedValue([]) },
    },
    update: vi.fn().mockReturnValue(chain), delete: vi.fn().mockReturnValue(chain), insert: vi.fn().mockReturnValue(chain),
  }
  db.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(db))
  return {
    db,
    trainers: t('trainers'), clients: t('clients'), sessions: t('sessions'), templates: t('templates'), challenges: t('challenges'),
    exercises: t('exercises'), sessionExercises: t('sessionExercises'), templateExercises: t('templateExercises'),
    refreshTokens: t('refreshTokens'), emailVerificationTokens: t('emailVerificationTokens'), clientEvents: t('clientEvents'), idempotencyKeys: t('idempotencyKeys'),
    clientGoals: t('clientGoals'), clientSnapshots: t('clientSnapshots'), snapshotMedia: t('snapshotMedia'), sessionExerciseMedia: t('sessionExerciseMedia'),
  }
})
vi.mock('../../services/auth.service', () => ({ revokeAllRefreshTokens: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../services/cloudinary.service', () => ({
  deleteByPrefix:   vi.fn().mockResolvedValue(undefined),
  mediaDeliveryUrl: vi.fn((publicId: string) => `https://res.cloudinary.com/x/authenticated/s--sig--/${publicId}`),
}))

import { db } from '../../db'
import { revokeAllRefreshTokens } from '../../services/auth.service'
import { deleteByPrefix } from '../../services/cloudinary.service'
import { deactivateTrainer, isRestorable, purgeTrainer, findPurgeable, buildExport, PURGE_AFTER_DAYS } from '../../services/account.service'

const NOW = new Date('2026-09-15T12:00:00Z')
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000)
const deletedTables = () => vi.mocked(db.delete).mock.calls.map((c) => (c[0] as unknown as { __table: string }).__table)

describe('deactivateTrainer', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('stamps deactivatedAt and revokes every device', async () => {
    await deactivateTrainer('t-1', NOW)
    expect(vi.mocked(db.update({} as never).set).mock.calls[0]?.[0]).toMatchObject({ deactivatedAt: NOW })
    expect(revokeAllRefreshTokens).toHaveBeenCalledWith('t-1')
  })
})

describe('isRestorable', () => {
  it('is false for an active account', () => { expect(isRestorable(null, NOW)).toBe(false) })
  it('is true inside the window and false at/after it', () => {
    expect(isRestorable(daysAgo(1), NOW)).toBe(true)
    expect(isRestorable(daysAgo(PURGE_AFTER_DAYS - 0.01), NOW)).toBe(true)
    expect(isRestorable(daysAgo(PURGE_AFTER_DAYS), NOW)).toBe(false)
    expect(isRestorable(daysAgo(45), NOW)).toBe(false)
  })
})

describe('purgeTrainer', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes media by prefix for every client and private exercise, then the DB in dependency order, in one transaction', async () => {
    vi.mocked(db.query.clients.findMany).mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }] as never)
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([{ id: 'e1' }] as never)
    const report = await purgeTrainer('t-1')

    // Client folders are `authenticated`, library folders `public` — the admin API
    // scopes deletion by type, so a purge that forgot this would delete nothing (G16).
    expect(vi.mocked(deleteByPrefix).mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['trainer-app/clients/c1', 'authenticated'], ['trainer-app/clients/c2', 'authenticated'], ['trainer-app/exercises/e1', 'public'],
    ])
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(deletedTables()).toEqual([
      'sessions', 'templates', 'challenges', 'clients',   // children of the trainer that carry the RESTRICT edges
      'exercises',                                        // private exercises, after every session/template is gone
      'refreshTokens', 'emailVerificationTokens', 'clientEvents', 'idempotencyKeys',
      'trainers',                                         // last: captured_by references are gone by now
    ])
    expect(report).toMatchObject({ trainerId: 't-1', clients: 2, exercisesDeleted: 1, exercisesRehomed: 0, mediaFailures: [] })
  })

  it('re-homes a private exercise still referenced by someone else instead of deleting it', async () => {
    vi.mocked(db.query.exercises.findMany).mockResolvedValueOnce([{ id: 'e-used' }, { id: 'e-free' }] as never)
    vi.mocked(db.query.sessionExercises.findMany).mockResolvedValueOnce([{ exerciseId: 'e-used' }] as never)
    const report = await purgeTrainer('t-1')
    expect(vi.mocked(db.update({} as never).set).mock.calls[0]?.[0]).toEqual({ trainerId: null, isPublic: true })
    expect(report).toMatchObject({ exercisesDeleted: 1, exercisesRehomed: 1 })
  })

  it('a media failure is reported, and the DB delete still runs', async () => {
    vi.mocked(db.query.clients.findMany).mockResolvedValueOnce([{ id: 'c1' }] as never)
    vi.mocked(deleteByPrefix).mockRejectedValueOnce(new Error('cloudinary down'))
    const report = await purgeTrainer('t-1')
    expect(report.mediaFailures).toEqual(['trainer-app/clients/c1'])
    expect(deletedTables()).toContain('trainers')
  })
})

describe('findPurgeable', () => {
  it('returns the ids the query yields', async () => {
    vi.mocked(db.query.trainers.findMany).mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }] as never)
    expect(await findPurgeable(NOW)).toEqual(['a', 'b'])
  })
})

describe('buildExport', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null for an unknown trainer', async () => {
    expect(await buildExport('nope', NOW)).toBeNull()
  })

  it('assembles every owned table, strips the password hash, and only fetches media for rows that exist', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce({ id: 't-1', email: 'a@b.co', passwordHash: '$argon2id$secret', name: 'A' } as never)
    vi.mocked(db.query.clients.findMany).mockResolvedValueOnce([{ id: 'c1' }] as never)
    vi.mocked(db.query.clientSnapshots.findMany).mockResolvedValueOnce([{ id: 'snap1' }] as never)
    vi.mocked(db.query.sessions.findMany).mockResolvedValueOnce([{ id: 's1', sessionExercises: [{ id: 'se1', sets: [{ id: 'set1' }] }] }] as never)
    vi.mocked(db.query.snapshotMedia.findMany).mockResolvedValueOnce([{ id: 'photo1', snapshotId: 'snap1', cloudinaryPublicId: 'pid1', cloudinaryUrl: 'https://res.cloudinary.com/x/image/upload/pid1.webp' }] as never)

    const out = await buildExport('t-1', NOW)
    expect(out).not.toBeNull()
    expect(JSON.stringify(out)).not.toContain('argon2')
    expect(out).toMatchObject({
      format: 'just-train-export', version: 1, exportedAt: NOW.toISOString(),
      account: { id: 't-1', email: 'a@b.co', name: 'A' },
      clients: [{ id: 'c1' }], snapshots: [{ id: 'snap1' }],
      // G16: export carries a delivery URL signed at read time, not the stored column
      progressPhotos: [{ id: 'photo1', cloudinaryUrl: 'https://res.cloudinary.com/x/authenticated/s--sig--/pid1' }],
      sessions: [{ id: 's1', sessionExercises: [{ id: 'se1', sets: [{ id: 'set1' }] }] }],
      templates: [], challenges: [], exercises: [], telemetry: [], goals: [], formCheckClips: [],
    })
    expect(db.query.snapshotMedia.findMany).toHaveBeenCalledTimes(1)          // there was a snapshot
    expect(db.query.sessionExerciseMedia.findMany).toHaveBeenCalledTimes(1)   // there was a session-exercise
  })

  it('skips per-client and media queries entirely when the account owns nothing', async () => {
    vi.mocked(db.query.trainers.findFirst).mockResolvedValueOnce({ id: 't-1', passwordHash: 'x' } as never)
    await buildExport('t-1', NOW)
    expect(db.query.clientGoals.findMany).not.toHaveBeenCalled()
    expect(db.query.snapshotMedia.findMany).not.toHaveBeenCalled()
    expect(db.query.sessionExerciseMedia.findMany).not.toHaveBeenCalled()
  })
})
