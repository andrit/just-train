// db/lib/prRecords.ts — pure derivation of "current record holder" set ids.
//
// A set earns a chip only if it currently holds the client's record for that
// exercise — Load (heaviest weight, any reps) or Volume (weight × reps). The
// record is DERIVED from history, never a frozen flag, so when a later set beats
// it the chip moves automatically.
//
// Rules (agreed 2026-07-27):
//   - Ties: the earliest set keeps the record — equalling is not beating (strict >).
//   - Baseline: the chronologically-first set for a client+exercise never earns a
//     chip (there was nothing to beat). If the record holder IS that first set, no chip.
//
// Volume counts both sides for per-side (unilateral) sets via sideReps — Load is
// weight-only and unaffected.

import { sideReps } from '@trainer-app/shared'

export interface RecordCandidate {
  id:         string
  exerciseId: string
  weight:     number | null
  reps:       number | null
  perSide?:   boolean | null
  repsLeft?:  number | null
  repsRight?: number | null
  createdAt:  Date | string
}

export interface RecordSetIds {
  loadIds:   Set<string>
  volumeIds: Set<string>
}

function toMs(d: Date | string): number {
  return d instanceof Date ? d.getTime() : new Date(d).getTime()
}

/**
 * Given every resistance set for a client across the exercises of interest,
 * return the set ids that currently hold the Load and Volume records per exercise.
 * Non-resistance rows (missing weight/reps) are ignored.
 */
export function deriveRecordSetIds(rows: RecordCandidate[]): RecordSetIds {
  const byExercise = new Map<string, RecordCandidate[]>()
  for (const r of rows) {
    if (r.weight == null || r.reps == null || r.reps <= 0) continue
    const list = byExercise.get(r.exerciseId) ?? []
    list.push(r)
    byExercise.set(r.exerciseId, list)
  }

  const loadIds   = new Set<string>()
  const volumeIds = new Set<string>()

  for (const list of byExercise.values()) {
    // Chronological order; id as a stable tiebreaker for identical timestamps.
    const sorted = [...list].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt) || a.id.localeCompare(b.id))
    const first = sorted[0]
    if (!first) continue
    const firstId = first.id

    let load = first
    let vol  = first
    for (const s of sorted) {
      // strict > means the earliest set at a given max keeps the record
      if ((s.weight as number) > (load.weight as number)) load = s
      // Volume counts both sides for per-side work (sideReps), not raw reps.
      const sv = (s.weight as number) * sideReps(s)
      const lv = (vol.weight as number) * sideReps(vol)
      if (sv > lv) vol = s
    }

    // Baseline suppression: a record still held by the first-ever set was never earned.
    if (load.id !== firstId) loadIds.add(load.id)
    if (vol.id  !== firstId) volumeIds.add(vol.id)
  }

  return { loadIds, volumeIds }
}
