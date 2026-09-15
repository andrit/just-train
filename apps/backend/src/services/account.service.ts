// ------------------------------------------------------------
// services/account.service.ts — deactivate, restore, purge (account plan A5)
//
// Delete is SOFT (designer decision 2026-09-15): DELETE /auth/me stamps
// trainers.deactivated_at, revokes every session, and hides the account.
// Signing in within PURGE_AFTER_DAYS restores it. A daily job hard-purges
// accounts past the window. That is what /privacy promises ("30 days").
//
// purgeTrainer() is an EXPLICIT ORDERED delete, not `DELETE FROM trainers`
// and hope: two RESTRICT foreign keys (session_exercises/template_exercises
// → exercises, client_snapshots.captured_by → trainers) can fail a bare
// cascade depending on the order Postgres happens to process it. The order
// below satisfies both without touching the FKs. The same function is the
// admin "hard purge now" utility.
// ------------------------------------------------------------

import { and, eq, isNull, lt, inArray } from 'drizzle-orm'
import {
  db, trainers, clients, sessions, templates, challenges, exercises,
  sessionExercises, templateExercises, refreshTokens, emailVerificationTokens, clientEvents, idempotencyKeys,
} from '../db'
import { revokeAllRefreshTokens } from './auth.service'
import { deleteByPrefix } from './cloudinary.service'

export const PURGE_AFTER_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/** Soft delete: stamp, revoke every device. Idempotent. */
export async function deactivateTrainer(trainerId: string, now: Date = new Date()): Promise<void> {
  await db.update(trainers).set({ deactivatedAt: now, updatedAt: now }).where(and(eq(trainers.id, trainerId), isNull(trainers.deactivatedAt)))
  await revokeAllRefreshTokens(trainerId)
}

/** True when a deactivated account may still be restored by signing in. */
export function isRestorable(deactivatedAt: Date | null, now: Date = new Date()): boolean {
  if (!deactivatedAt) return false
  return now.getTime() - deactivatedAt.getTime() < PURGE_AFTER_DAYS * DAY_MS
}

export async function restoreTrainer(trainerId: string, now: Date = new Date()): Promise<void> {
  await db.update(trainers).set({ deactivatedAt: null, updatedAt: now }).where(eq(trainers.id, trainerId))
}

export interface PurgeReport {
  trainerId:          string
  clients:            number
  mediaPrefixes:      string[]
  mediaFailures:      string[]
  exercisesDeleted:   number
  exercisesRehomed:   number   // private exercises still referenced by others → made public
}

/**
 * Hard delete everything the trainer owns. Media first (needs the client ids,
 * best-effort), then the DB in one transaction in dependency order.
 */
export async function purgeTrainer(trainerId: string): Promise<PurgeReport> {
  const ownedClients = await db.query.clients.findMany({ where: eq(clients.trainerId, trainerId), columns: { id: true } })
  const clientIds    = ownedClients.map((c) => c.id)
  const ownedExercises = await db.query.exercises.findMany({ where: eq(exercises.trainerId, trainerId), columns: { id: true } })
  const exerciseIds  = ownedExercises.map((e) => e.id)

  // ── Media (Cloudinary) — best-effort, never blocks the DB delete ──────────
  const mediaPrefixes = [
    ...clientIds.map((id) => `trainer-app/clients/${id}`),
    ...exerciseIds.map((id) => `trainer-app/exercises/${id}`),
  ]
  const mediaFailures: string[] = []
  for (const prefix of mediaPrefixes) {
    try { await deleteByPrefix(prefix) } catch { mediaFailures.push(prefix) }
  }

  // ── Database — explicit order, one transaction ───────────────────────────
  const report = await db.transaction(async (tx) => {
    // 1. Training data. sessions cascade → session_exercises → sets (+ media rows).
    await tx.delete(sessions).where(eq(sessions.trainerId, trainerId))
    // 2. Plans. templates cascade → template_exercises.
    await tx.delete(templates).where(eq(templates.trainerId, trainerId))
    // 3. Challenges (own FK to trainer + client).
    await tx.delete(challenges).where(eq(challenges.trainerId, trainerId))
    // 4. Clients cascade → goals, snapshots (+ snapshot media rows). This clears
    //    every client_snapshots.captured_by = trainer row BEFORE the trainer row goes.
    await tx.delete(clients).where(eq(clients.trainerId, trainerId))

    // 5. Private exercises. Anything still referenced by OTHER trainers' rows
    //    (possible for data created before the visibility fix) cannot be deleted
    //    (RESTRICT) and must not break their history — re-home it to the public
    //    library. The rest goes.
    let exercisesDeleted = 0
    let exercisesRehomed = 0
    if (exerciseIds.length) {
      const stillUsed = new Set<string>()
      const refs = await Promise.all([
        tx.query.sessionExercises.findMany({ where: inArray(sessionExercises.exerciseId, exerciseIds), columns: { exerciseId: true } }),
        tx.query.templateExercises.findMany({ where: inArray(templateExercises.exerciseId, exerciseIds), columns: { exerciseId: true } }),
        tx.query.challenges.findMany({ where: inArray(challenges.exerciseId, exerciseIds), columns: { exerciseId: true } }),
      ])
      for (const rows of refs) for (const r of rows) if (r.exerciseId) stillUsed.add(r.exerciseId)

      const rehome = [...stillUsed]
      if (rehome.length) {
        await tx.update(exercises).set({ trainerId: null, isPublic: true }).where(inArray(exercises.id, rehome))
        exercisesRehomed = rehome.length
      }
      const deletable = exerciseIds.filter((id) => !stillUsed.has(id))
      if (deletable.length) {
        await tx.delete(exercises).where(inArray(exercises.id, deletable))
        exercisesDeleted = deletable.length
      }
    }

    // 6. Auth + bookkeeping rows (all cascade from trainers, deleted explicitly for clarity).
    await tx.delete(refreshTokens).where(eq(refreshTokens.trainerId, trainerId))
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.trainerId, trainerId))
    await tx.delete(clientEvents).where(eq(clientEvents.trainerId, trainerId))
    await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.trainerId, trainerId))

    // 7. The account.
    await tx.delete(trainers).where(eq(trainers.id, trainerId))

    return { exercisesDeleted, exercisesRehomed }
  })

  return { trainerId, clients: clientIds.length, mediaPrefixes, mediaFailures, ...report }
}

/** Accounts deactivated at least PURGE_AFTER_DAYS ago. */
export async function findPurgeable(now: Date = new Date()): Promise<string[]> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS)
  const rows = await db.query.trainers.findMany({ where: lt(trainers.deactivatedAt, cutoff), columns: { id: true } })
  return rows.map((r) => r.id)
}
