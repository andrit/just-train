// lib/setPrefill.ts — which set does the live input pre-fill from?
//
// Pure. No React, no fetching. The live session hands in what it knows and gets
// back one set plus the reason it was chosen.

import type { SetResponse } from '@trainer-app/shared'
import type { ExerciseHistorySet } from '@/lib/queries/clients'

/** Why a set was chosen — the caller needs this, not just the set. See below. */
export type PrefillSource = 'ramp' | 'history' | 'in-session'

export interface PrefillResult {
  set:    SetResponse | null
  source: PrefillSource | null
}

/**
 * A history row is a thin projection; the input expects a full SetResponse.
 * Fields the history endpoint does not carry are filled with inert defaults —
 * this set is never persisted, it only seeds the input.
 */
export function historySetToSetResponse(
  h: ExerciseHistorySet,
  sessionExerciseId: string,
): SetResponse {
  return {
    id:                '',
    sessionExerciseId,
    setNumber:       h.setNumber,
    reps:            h.reps,
    weight:          h.weight,
    weightUnit:      h.weightUnit,
    durationSeconds: h.durationSeconds,
    distance:        null,
    intensity:       null,
    perSide:         h.perSide ?? false,
    repsLeft:        h.repsLeft ?? null,
    repsRight:       h.repsRight ?? null,
    isPR:            false,
    isPRVolume:      false,
    isLoadRecord:    false,
    isVolumeRecord:  false,
    createdAt:       '',
  } as SetResponse
}

export interface PickPrefillArgs {
  /** 0-based position of the set about to be logged (== count already logged). */
  setIndex:          number
  /** Sets logged for this exercise in the current session, in order. */
  loggedSets:        SetResponse[]
  /** Last completed session's sets for this exercise, indexed by position. */
  lastSessionSets:   ExerciseHistorySet[]
  /** Per-set weight increment; 0 or null when this exercise has no ramp. */
  weightStep:        number | null
  sessionExerciseId: string
}

/**
 * Priority for the set about to be logged:
 *
 *   1. ramp        — an explicit "+ / set" step compounds off today's previous
 *                    set. Deliberate intent set at setup time, so it outranks
 *                    everything.
 *   2. history     — last session's set at this same position. This is the point
 *                    of the whole helper: set 2 should offer what you did on set
 *                    2 last time, not one weight repeated down the stack.
 *   3. in-session  — today's previous set, when history has nothing at this
 *                    position (you added a 4th set that last session never had).
 *   4. null        — nothing to go on; the input falls back to the target.
 *
 * Returning `source` is not decoration. The caller gates ramp compounding on a
 * `priorInSession` flag, and once history can win *while* in-session sets exist,
 * that flag can no longer be inferred from `loggedSets.length` — it has to come
 * from which branch actually won, or the ramp silently stops compounding.
 */
export function pickPrefillSet({
  setIndex,
  loggedSets,
  lastSessionSets,
  weightStep,
  sessionExerciseId,
}: PickPrefillArgs): PrefillResult {
  const previousInSession = loggedSets.length > 0
    ? (loggedSets[loggedSets.length - 1] ?? null)
    : null

  if (weightStep && previousInSession) {
    return { set: previousInSession, source: 'ramp' }
  }

  const fromHistory = lastSessionSets[setIndex]
  if (fromHistory) {
    return { set: historySetToSetResponse(fromHistory, sessionExerciseId), source: 'history' }
  }

  if (previousInSession) {
    return { set: previousInSession, source: 'in-session' }
  }

  return { set: null, source: null }
}

/**
 * True when the chosen set was logged in the current session. The ramp compounds
 * off today's actual lift, so it must not fire on a set pulled from history.
 */
export const isPriorInSession = (source: PrefillSource | null): boolean =>
  source === 'ramp' || source === 'in-session'
