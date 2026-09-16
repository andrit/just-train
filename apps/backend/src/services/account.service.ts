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
  clientGoals, clientSnapshots, snapshotMedia, sessionExerciseMedia,
} from '../db'
import { revokeAllRefreshTokens } from './auth.service'
import { deleteByPrefix, mediaDeliveryUrl, type MediaAccess } from './cloudinary.service'

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

  // Decide re-homing BEFORE touching media: a private exercise still referenced
  // by another trainer's rows survives as public, and its media must survive
  // with it (found by the real-DB purge test — the media used to go first).
  const stillUsed = await exercisesReferencedElsewhere(exerciseIds, trainerId)
  const deletableExerciseIds = exerciseIds.filter((id) => !stillUsed.has(id))

  // ── Media (Cloudinary) — best-effort, never blocks the DB delete ──────────
  // Client media is `authenticated`, library media `public` — the delete is
  // scoped by type, so getting this wrong deletes nothing and reports success.
  const mediaPrefixes: Array<[string, MediaAccess]> = [
    ...clientIds.map((id): [string, MediaAccess] => [`trainer-app/clients/${id}`, 'authenticated']),
    ...deletableExerciseIds.map((id): [string, MediaAccess] => [`trainer-app/exercises/${id}`, 'public']),
  ]
  const mediaFailures: string[] = []
  for (const [prefix, access] of mediaPrefixes) {
    try { await deleteByPrefix(prefix, access) } catch { mediaFailures.push(prefix) }
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
      const rehome = [...stillUsed]
      if (rehome.length) {
        await tx.update(exercises).set({ trainerId: null, isPublic: true }).where(inArray(exercises.id, rehome))
        exercisesRehomed = rehome.length
      }
      if (deletableExerciseIds.length) {
        await tx.delete(exercises).where(inArray(exercises.id, deletableExerciseIds))
        exercisesDeleted = deletableExerciseIds.length
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

  return { trainerId, clients: clientIds.length, mediaPrefixes: mediaPrefixes.map(([prefix]) => prefix), mediaFailures, ...report }
}

/**
 * Private exercises of `trainerId` that rows OUTSIDE this trainer's own data
 * still point at (sessions/templates/challenges of other trainers — possible
 * for data created before the visibility fix). The trainer's own references
 * vanish with their sessions/templates/challenges in the purge, so they do
 * not count.
 */
async function exercisesReferencedElsewhere(exerciseIds: string[], trainerId: string): Promise<Set<string>> {
  const used = new Set<string>()
  if (!exerciseIds.length) return used
  const [se, te, ch] = await Promise.all([
    db.query.sessionExercises.findMany({
      where: inArray(sessionExercises.exerciseId, exerciseIds),
      columns: { exerciseId: true },
      with: { session: { columns: { trainerId: true } } },
    }),
    db.query.templateExercises.findMany({
      where: inArray(templateExercises.exerciseId, exerciseIds),
      columns: { exerciseId: true },
      with: { template: { columns: { trainerId: true } } },
    }),
    db.query.challenges.findMany({
      where: inArray(challenges.exerciseId, exerciseIds),
      columns: { exerciseId: true, trainerId: true },
    }),
  ])
  for (const r of se) if (r.session?.trainerId !== trainerId) used.add(r.exerciseId)
  for (const r of te) if (r.template?.trainerId !== trainerId) used.add(r.exerciseId)
  for (const r of ch) if (r.trainerId !== trainerId && r.exerciseId) used.add(r.exerciseId)
  return used
}

/** Accounts deactivated at least PURGE_AFTER_DAYS ago. */
export async function findPurgeable(now: Date = new Date()): Promise<string[]> {
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * DAY_MS)
  const rows = await db.query.trainers.findMany({ where: lt(trainers.deactivatedAt, cutoff), columns: { id: true } })
  return rows.map((r) => r.id)
}

// ── Export (account plan A4 — portability) ──────────────────────────────────
//
// One JSON document of everything the trainer owns, raw rows grouped by
// table, plus a small envelope. Raw rows on purpose: portability means the
// user gets the data as it is stored, not our UI's view of it. Media are
// exported as the Cloudinary URLs already on the rows. The password hash and
// tokens are never included.
//
// ponytail: assembled in memory. A year of daily sessions is a few tens of
// thousands of set rows — fine. ceiling: ~100k rows per account. upgrade:
// stream per table when a real account gets there.

export const EXPORT_FORMAT_VERSION = 1

export async function buildExport(trainerId: string, now: Date = new Date()) {
  const trainer = await db.query.trainers.findFirst({ where: eq(trainers.id, trainerId) })
  if (!trainer) return null
  const { passwordHash: _hash, ...account } = trainer

  const ownedClients = await db.query.clients.findMany({ where: eq(clients.trainerId, trainerId) })
  const clientIds    = ownedClients.map((c) => c.id)
  const byClient     = clientIds.length

  const [goals, snapshots, ownedSessions, ownedTemplates, ownedChallenges, privateExercises, events] = await Promise.all([
    byClient ? db.query.clientGoals.findMany({ where: inArray(clientGoals.clientId, clientIds) }) : [],
    byClient ? db.query.clientSnapshots.findMany({ where: inArray(clientSnapshots.clientId, clientIds) }) : [],
    db.query.sessions.findMany({
      where: eq(sessions.trainerId, trainerId),
      with:  { sessionExercises: { with: { sets: true } } },
    }),
    db.query.templates.findMany({ where: eq(templates.trainerId, trainerId), with: { templateExercises: true } }),
    db.query.challenges.findMany({ where: eq(challenges.trainerId, trainerId) }),
    db.query.exercises.findMany({ where: eq(exercises.trainerId, trainerId) }),
    db.query.clientEvents.findMany({ where: eq(clientEvents.trainerId, trainerId) }),
  ])

  const snapshotIds = snapshots.map((s) => s.id)
  const sessionExerciseIds = ownedSessions.flatMap((s) => s.sessionExercises.map((se) => se.id))
  const [progressPhotos, formCheckClips] = await Promise.all([
    snapshotIds.length ? db.query.snapshotMedia.findMany({ where: inArray(snapshotMedia.snapshotId, snapshotIds) }) : [],
    sessionExerciseIds.length ? db.query.sessionExerciseMedia.findMany({ where: inArray(sessionExerciseMedia.sessionExerciseId, sessionExerciseIds) }) : [],
  ])

  return {
    format:     'just-train-export',
    version:    EXPORT_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    account,
    clients:    ownedClients,
    goals,
    snapshots,
    // Delivery URLs are signed at read time (G16); the stored column is not usable directly.
    progressPhotos: progressPhotos.map((m) => ({ ...m, cloudinaryUrl: mediaDeliveryUrl(m.cloudinaryPublicId, 'image', 'authenticated') })),
    sessions:   ownedSessions,
    formCheckClips: formCheckClips.map((m) => ({ ...m, cloudinaryUrl: mediaDeliveryUrl(m.cloudinaryPublicId, m.mediaType, 'authenticated') })),
    templates:  ownedTemplates,
    challenges: ownedChallenges,
    exercises:  privateExercises,
    telemetry:  events,
  }
}
