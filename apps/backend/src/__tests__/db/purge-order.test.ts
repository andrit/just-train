// ------------------------------------------------------------
// __tests__/db/purge-order.test.ts — account purge against real foreign keys
//
// The unit test (services/account.test.ts) asserts the ORDER the purge
// issues its deletes in. This asserts the OUTCOME the order was chosen for:
// with the two RESTRICT edges live (session_exercises.exercise_id,
// client_snapshots.captured_by), purging A removes every A row, leaves every
// B row, and re-homes rather than deletes a private exercise that B's data
// still points at.
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { eq, count, type SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

vi.mock('../../services/cloudinary.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/cloudinary.service')>()
  return { ...real, deleteByPrefix: vi.fn().mockResolvedValue(undefined) }
})

import { db } from '../../db'
import * as schema from '../../db/schema'
import { deactivateTrainer, purgeTrainer } from '../../services/account.service'
import { resetDatabase, seedTenants, type Seed } from './harness'

let seed: Seed

const rows = async (table: PgTable, where: SQL): Promise<number> => {
  const [r] = await db.select({ n: count() }).from(table).where(where)
  return Number(r?.n ?? 0)
}

beforeAll(async () => {
  await resetDatabase()
  seed = await seedTenants()
  // B's session also uses A's private exercise → after the purge it must be
  // re-homed to the public library, not deleted (RESTRICT would refuse anyway).
  await db.insert(schema.sessionExercises).values({ sessionId: seed.b.session, exerciseId: seed.a.privateExercise, workoutType: 'resistance' })
  // (A's snapshot is seeded with captured_by = A — the second RESTRICT edge.)
})

describe('purgeTrainer against real foreign keys', () => {
  it('removes everything A owned, keeps everything B owned, and re-homes the shared private exercise', async () => {
    await deactivateTrainer(seed.a.trainerId, new Date())
    const report = await purgeTrainer(seed.a.trainerId)

    expect(report.exercisesRehomed).toBe(1)
    expect(report.exercisesDeleted).toBe(0)

    // A is gone, table by table.
    expect(await rows(schema.trainers,        eq(schema.trainers.id, seed.a.trainerId))).toBe(0)
    expect(await rows(schema.clients,         eq(schema.clients.trainerId, seed.a.trainerId))).toBe(0)
    expect(await rows(schema.clientGoals,     eq(schema.clientGoals.id, seed.a.goal))).toBe(0)
    expect(await rows(schema.clientSnapshots, eq(schema.clientSnapshots.id, seed.a.snapshot))).toBe(0)
    expect(await rows(schema.snapshotMedia,   eq(schema.snapshotMedia.id, seed.a.snapshotMedia))).toBe(0)
    expect(await rows(schema.sessions,        eq(schema.sessions.trainerId, seed.a.trainerId))).toBe(0)
    expect(await rows(schema.sets,            eq(schema.sets.id, seed.a.set))).toBe(0)
    expect(await rows(schema.sessionExerciseMedia, eq(schema.sessionExerciseMedia.id, seed.a.sessionExerciseMedia))).toBe(0)
    expect(await rows(schema.templates,       eq(schema.templates.trainerId, seed.a.trainerId))).toBe(0)
    expect(await rows(schema.challenges,      eq(schema.challenges.trainerId, seed.a.trainerId))).toBe(0)
    expect(await rows(schema.refreshTokens,   eq(schema.refreshTokens.trainerId, seed.a.trainerId))).toBe(0)

    // The shared exercise survived as public; A's exercise media went with A's folder prefix (Cloudinary) but the row cascades only on exercise delete — it stays with the re-homed exercise.
    const [ex] = await db.select().from(schema.exercises).where(eq(schema.exercises.id, seed.a.privateExercise))
    expect(ex?.trainerId).toBeNull()
    expect(ex?.isPublic).toBe(true)

    // B untouched.
    expect(await rows(schema.trainers,  eq(schema.trainers.id, seed.b.trainerId))).toBe(1)
    expect(await rows(schema.clients,   eq(schema.clients.trainerId, seed.b.trainerId))).toBe(1)
    expect(await rows(schema.sessions,  eq(schema.sessions.trainerId, seed.b.trainerId))).toBe(1)
    expect(await rows(schema.sessionExercises, eq(schema.sessionExercises.sessionId, seed.b.session))).toBe(2)
    expect(await rows(schema.templates, eq(schema.templates.trainerId, seed.b.trainerId))).toBe(1)
    expect(await rows(schema.exercises, eq(schema.exercises.id, seed.publicExercise))).toBe(1)
  })
})
