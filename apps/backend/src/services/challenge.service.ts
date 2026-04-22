// ------------------------------------------------------------
// services/challenge.service.ts — Challenge auto-detection (v2.12.0)
//
// Called after a set is logged or a session is completed.
// Checks for active challenges tied to the client/exercise
// and updates currentValue if the new data exceeds it.
//
// METRIC TYPE BEHAVIOR:
//   weight_lifted      → max(currentValue, set.weight)
//   reps_achieved      → max(currentValue, set.reps)
//   distance           → max(currentValue, set.distance)
//   duration           → max(currentValue, set.durationSeconds)
//   sessions_completed → currentValue + 1
//   qualitative        → manual only (never auto-updated)
//
// COMPLETION:
//   If currentValue >= targetValue after update, status → 'completed'
//   and completedAt is set.
// ------------------------------------------------------------

import { db, challenges } from '../db'
import { eq, and } from 'drizzle-orm'

// ── Set-based detection ─────────────────────────────────────────────────────
// Called from POST /session-exercises/:id/sets after a set is inserted.

interface SetData {
  weight?:          number | null
  reps?:            number | null
  distance?:        number | null
  durationSeconds?: number | null
}

export async function updateChallengesForSet(
  clientId:   string,
  exerciseId: string,
  setData:    SetData,
): Promise<void> {
  // Find active challenges for this client + exercise
  const activeChallenges = await db.query.challenges.findMany({
    where: and(
      eq(challenges.clientId, clientId),
      eq(challenges.exerciseId, exerciseId),
      eq(challenges.status, 'active'),
    ),
  })

  for (const challenge of activeChallenges) {
    let newValue: number | null = null

    switch (challenge.metricType) {
      case 'weight_lifted':
        if (setData.weight != null) {
          newValue = Math.max(challenge.currentValue, setData.weight)
        }
        break
      case 'reps_achieved':
        if (setData.reps != null) {
          newValue = Math.max(challenge.currentValue, setData.reps)
        }
        break
      case 'distance':
        if (setData.distance != null) {
          newValue = Math.max(challenge.currentValue, setData.distance)
        }
        break
      case 'duration':
        if (setData.durationSeconds != null) {
          newValue = Math.max(challenge.currentValue, setData.durationSeconds)
        }
        break
      // qualitative and sessions_completed are not set-based
      default:
        break
    }

    if (newValue !== null && newValue > challenge.currentValue) {
      const completed = newValue >= challenge.targetValue
      await db
        .update(challenges)
        .set({
          currentValue: newValue,
          ...(completed ? { status: 'completed' as const, completedAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(challenges.id, challenge.id))
    }
  }
}

// ── Session-based detection ─────────────────────────────────────────────────
// Called from PATCH /sessions/:id when status transitions to 'completed'.

export async function updateChallengesForSessionComplete(
  clientId: string,
): Promise<void> {
  // Find active sessions_completed challenges for this client
  const activeChallenges = await db.query.challenges.findMany({
    where: and(
      eq(challenges.clientId, clientId),
      eq(challenges.metricType, 'sessions_completed'),
      eq(challenges.status, 'active'),
    ),
  })

  for (const challenge of activeChallenges) {
    const newValue = challenge.currentValue + 1
    const completed = newValue >= challenge.targetValue

    await db
      .update(challenges)
      .set({
        currentValue: newValue,
        ...(completed ? { status: 'completed' as const, completedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(challenges.id, challenge.id))
  }
}

// ── Expiry check ────────────────────────────────────────────────────────────
// Called daily from the BullMQ scheduler.

export async function expireOverdueChallenges(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Find all active challenges past their deadline
  const overdue = await db.query.challenges.findMany({
    where: eq(challenges.status, 'active'),
  })

  let expired = 0
  for (const challenge of overdue) {
    if (challenge.deadline < today) {
      await db
        .update(challenges)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(challenges.id, challenge.id))
      expired++
    }
  }

  return expired
}
