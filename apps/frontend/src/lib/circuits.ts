// ------------------------------------------------------------
// lib/circuits.ts — Circuit grouping + label derivation (pure)
//
// A circuit is a set of session exercises sharing a `circuitId`, performed
// round-major. These helpers turn a flat, ordered session-exercise list into
// display groups (a circuit bracket, or a standalone exercise) and derive the
// circuit's label from its members' shared body part.
//
// Used by CircuitBlock (live header label) and SessionExerciseBreakdown
// (read-view bracketing). Grouping is contiguous: members of one circuit are
// adjacent by orderIndex, so a run of the same circuitId forms one group.
// ------------------------------------------------------------

import type { SessionExerciseResponse } from '@trainer-app/shared'

export interface CircuitGroup {
  kind:      'circuit'
  circuitId: string
  label:     string
  /** Shared rounds = the members' target sets (equal at creation). */
  rounds:    number
  members:   SessionExerciseResponse[]
}

export interface SoloGroup {
  kind:     'solo'
  exercise: SessionExerciseResponse
}

export type ExerciseGroup = CircuitGroup | SoloGroup

// "Shoulder Circuit" when every member shares a body part, else "Circuit".
export function circuitLabel(members: SessionExerciseResponse[]): string {
  const parts = new Set(members.map((m) => m.exercise?.bodyPart?.name).filter(Boolean))
  if (parts.size === 1) {
    const p    = [...parts][0] as string
    const nice = p.replace('_', ' ')
    return `${nice.charAt(0).toUpperCase()}${nice.slice(1)} Circuit`
  }
  return 'Circuit'
}

// Group consecutive circuit members (shared circuitId) into one group; standalone
// exercises (null circuitId) stay individual. Order is preserved.
//
// A circuit that has dropped to a single member — e.g. after a member was deleted
// without ungrouping the survivor — is demoted to solo: one exercise should never
// render as a bracketed "circuit" of one.
export function groupExercisesByCircuit(
  sessionExercises: SessionExerciseResponse[],
): ExerciseGroup[] {
  const groups: ExerciseGroup[] = []

  for (const se of sessionExercises) {
    const cid  = se.circuitId ?? null
    const last = groups[groups.length - 1]

    if (cid != null && last && last.kind === 'circuit' && last.circuitId === cid) {
      last.members.push(se)
    } else if (cid != null) {
      groups.push({ kind: 'circuit', circuitId: cid, label: '', rounds: 0, members: [se] })
    } else {
      groups.push({ kind: 'solo', exercise: se })
    }
  }

  // Finalize: derive label + rounds; demote single-member circuits to solo.
  return groups.flatMap<ExerciseGroup>((g) => {
    if (g.kind !== 'circuit') return [g]
    if (g.members.length < 2) return [{ kind: 'solo', exercise: g.members[0] }]
    return [{
      ...g,
      label:  circuitLabel(g.members),
      rounds: Math.max(1, ...g.members.map((m) => m.targetSets ?? 0)),
    }]
  })
}
