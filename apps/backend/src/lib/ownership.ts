// ------------------------------------------------------------
// lib/ownership.ts — who may touch what, in one place
//
// Two kinds of resolution, both returning null (→ route sends 404, never 403,
// so nothing leaks existence):
//
//   owned*   — rows that belong to exactly one trainer, resolved through the
//              aggregate root when the row itself carries no trainer_id
//              (session → session_exercise → set).
//   visible* — the exercise library: a trainer may reference an exercise that
//              is PUBLIC (trainer_id IS NULL) or THEIR OWN. Same rule as
//              GET /exercises; enforced here for every body-supplied
//              exerciseId so a private draft cannot be attached to someone
//              else's session, template or challenge.
//
// Found by the Phase 19 ownership audit: URL ids were the first sweep
// (routes/sessions.ts), body ids the second (this file).
// ------------------------------------------------------------

import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { db, clients, exercises, sessions, sessionExercises, sets } from '../db'

// ── Clients ─────────────────────────────────────────────────────────────────

export async function ownedClient(clientId: string, trainerId: string) {
  return db.query.clients.findFirst({
    where:   and(eq(clients.id, clientId), eq(clients.trainerId, trainerId)),
    columns: { id: true, name: true, isSelf: true },
  })
}

// ── Session tree ────────────────────────────────────────────────────────────

export async function ownedSession(sessionId: string, trainerId: string) {
  return db.query.sessions.findFirst({
    where:   and(eq(sessions.id, sessionId), eq(sessions.trainerId, trainerId)),
    columns: { id: true, clientId: true },
  })
}

export async function ownedSessionExercise(id: string, trainerId: string) {
  const row = await db.query.sessionExercises.findFirst({
    where: eq(sessionExercises.id, id),
    with:  { session: { columns: { id: true, trainerId: true, clientId: true } } },
  })
  return row && row.session.trainerId === trainerId ? row : null
}

export async function ownedSet(id: string, trainerId: string) {
  const row = await db.query.sets.findFirst({
    where: eq(sets.id, id),
    with:  { sessionExercise: { with: { session: { columns: { trainerId: true } } } } },
  })
  return row && row.sessionExercise.session.trainerId === trainerId ? row : null
}

// ── Exercise library visibility ─────────────────────────────────────────────

/** WHERE fragment: public library OR the caller's own. Reuse in list queries. */
export function exerciseVisibleTo(trainerId: string) {
  return or(isNull(exercises.trainerId), eq(exercises.trainerId, trainerId))
}

export async function visibleExercise(id: string, trainerId: string) {
  return db.query.exercises.findFirst({
    where:   and(eq(exercises.id, id), exerciseVisibleTo(trainerId)),
    columns: { id: true, workoutType: true, laterality: true },
  })
}

/**
 * All of `ids` must be visible; returns null if any is missing/foreign so the
 * caller answers with one 404 rather than revealing which id was the problem.
 */
export async function visibleExercises(ids: readonly string[], trainerId: string) {
  const unique = [...new Set(ids)]
  if (!unique.length) return []
  const rows = await db.query.exercises.findMany({
    where:   and(inArray(exercises.id, unique), exerciseVisibleTo(trainerId)),
    columns: { id: true, workoutType: true, laterality: true },
  })
  return rows.length === unique.length ? rows : null
}
