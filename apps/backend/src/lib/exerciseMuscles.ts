// ------------------------------------------------------------
// lib/exerciseMuscles.ts — build exercise_muscles rows from a
// { primary, secondary } selection.
//
// Pure. The DB has a unique (exercise_id, muscle), so a muscle may appear
// once. If the same muscle is listed in both groups, PRIMARY WINS (a prime
// mover is never also an assister). Each group is de-duped. Order preserved.
// ------------------------------------------------------------

import type { Muscle, MuscleRole } from '@trainer-app/shared'
import type { NewExerciseMuscle }  from '../db/schema/exercises'

export interface MuscleTargets {
  primary:   Muscle[]
  secondary: Muscle[]
}

export function buildMuscleRows(
  exerciseId: string,
  muscles: MuscleTargets,
): NewExerciseMuscle[] {
  const primary   = dedupe(muscles.primary)
  const primarySet = new Set(primary)
  // A muscle in both lists is primary only — drop it from secondary.
  const secondary = dedupe(muscles.secondary).filter((m) => !primarySet.has(m))

  return [
    ...primary.map((muscle)   => row(exerciseId, muscle, 'primary')),
    ...secondary.map((muscle) => row(exerciseId, muscle, 'secondary')),
  ]
}

function row(exerciseId: string, muscle: Muscle, role: MuscleRole): NewExerciseMuscle {
  return { exerciseId, muscle, role }
}

function dedupe(muscles: Muscle[]): Muscle[] {
  return [...new Set(muscles)]
}
