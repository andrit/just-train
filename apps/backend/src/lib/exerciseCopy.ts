// ------------------------------------------------------------
// lib/exerciseCopy.ts — the one field list for copying planned exercises
//
// Three routes deep-copy a plan: save a session as a template, fork a
// template, and apply a template to a session. Each used to hand-copy the
// target fields and the circuit-remap closure. That is how a new column gets
// added to one copier and silently dropped by the other two — so the mapping
// lives here, once, and the unit tests are the "forgot a column" check.
//
// Pure: no I/O. Callers own the DB writes.
// ------------------------------------------------------------

import { randomUUID } from 'crypto'
import type { NewTemplateExercise } from '../db/schema/templates'
import type { NewSessionExercise }  from '../db/schema/sessions'

// Every planning field shared by session_exercises and template_exercises.
// Sets (actuals) are never part of a plan copy.
export interface PlannedExerciseSource {
  exerciseId:            string
  workoutType:           NewTemplateExercise['workoutType']
  orderIndex:            number
  circuitId:             string | null
  targetSets:            number | null
  targetReps:            number | null
  targetRepsPerSet:      string | null
  targetWeight:          number | null
  targetWeightStep:      number | null
  targetWeightUnit:      NewTemplateExercise['targetWeightUnit']
  targetDurationSeconds: number | null
  targetDistance:        number | null
  targetIntensity:       NewTemplateExercise['targetIntensity']
  notes:                 string | null
  // Tri-state on templates (null = inherit from laterality); boolean on sessions.
  trackPerSide:          boolean | null
}

export type CircuitRemap = (sourceCircuitId: string | null) => string | null

/**
 * Circuit ids are plain grouping ids, so a copy must get fresh ones — but
 * members that shared a group in the source must still share one in the copy.
 * One remapper per copy operation; it memoises source → fresh id.
 */
export function createCircuitRemapper(): CircuitRemap {
  const map = new Map<string, string>()
  return (sourceCircuitId) => {
    if (!sourceCircuitId) return null
    const existing = map.get(sourceCircuitId)
    if (existing) return existing
    const fresh = randomUUID()
    map.set(sourceCircuitId, fresh)
    return fresh
  }
}

function planningFields(src: PlannedExerciseSource, remap: CircuitRemap) {
  return {
    exerciseId:            src.exerciseId,
    workoutType:           src.workoutType,
    orderIndex:            src.orderIndex,
    circuitId:             remap(src.circuitId),
    targetSets:            src.targetSets            ?? null,
    targetReps:            src.targetReps            ?? null,
    targetRepsPerSet:      src.targetRepsPerSet      ?? null,
    targetWeight:          src.targetWeight          ?? null,
    targetWeightStep:      src.targetWeightStep      ?? null,
    targetWeightUnit:      src.targetWeightUnit,
    targetDurationSeconds: src.targetDurationSeconds ?? null,
    targetDistance:        src.targetDistance        ?? null,
    targetIntensity:       src.targetIntensity       ?? null,
    notes:                 src.notes                 ?? null,
  }
}

/** Session exercise or template exercise → a new template_exercises row. */
export function toTemplateExerciseRow(
  src: PlannedExerciseSource,
  templateId: string,
  remap: CircuitRemap,
): NewTemplateExercise {
  return {
    templateId,
    ...planningFields(src, remap),
    trackPerSide: src.trackPerSide ?? null,
  }
}

/**
 * Template exercise → a new session_exercises row. A session must commit to a
 * per-side mode, so a template's null resolves against the exercise's laterality.
 */
export function toSessionExerciseRow(
  src: PlannedExerciseSource,
  sessionId: string,
  remap: CircuitRemap,
  unilateralExerciseIds: ReadonlySet<string>,
): NewSessionExercise {
  return {
    sessionId,
    ...planningFields(src, remap),
    trackPerSide: src.trackPerSide ?? unilateralExerciseIds.has(src.exerciseId),
  }
}
