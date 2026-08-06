// lib/exerciseProgress.ts — pure builder for per-exercise progression analytics.
//
// Takes the flat set rows (one per logged set, across the client's completed
// sessions for one exercise) and produces the ExerciseProgressResponse: per-
// session summaries (est-1RM / top-set / volume), the top-3-heaviest set
// positions tracked over time (rate-of-change via weightTrend), and overall
// bests. No I/O — the route does the query, this does the math. Unit-tested.

import { setVolume, type ExerciseProgressResponse } from '@trainer-app/shared'
import { weightTrend } from './progression'

export interface ProgressSetRow {
  sessionId: string
  date:      string   // YYYY-MM-DD
  setNumber: number
  weight:    number | null
  reps:      number | null
  perSide:   boolean | null
  repsLeft:  number | null
  repsRight: number | null
}

// Epley 1RM estimate, 1-decimal. Per-side reps are per-side by design — the
// estimate is per limb, which is the right unit for a unilateral movement.
const epley = (weight: number, reps: number): number =>
  Math.round(weight * (1 + reps / 30) * 10) / 10

/**
 * Build the progression response from raw set rows. Rows may arrive in any
 * order. `supported` is true only for resistance (weight-based) exercises.
 */
export function buildExerciseProgress(
  rows: ProgressSetRow[],
  exerciseId: string,
  workoutType: string,
): ExerciseProgressResponse {
  // Group by session.
  const bySession = new Map<string, { date: string; sets: ProgressSetRow[] }>()
  for (const r of rows) {
    const g = bySession.get(r.sessionId) ?? { date: r.date, sets: [] }
    g.sets.push(r)
    bySession.set(r.sessionId, g)
  }

  // Per-session summaries, oldest first (trend series read left→right).
  const summaries = [...bySession.entries()]
    .map(([sessionId, g]) => ({ sessionId, ...g }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => {
      let topSet: { weight: number; reps: number | null } | null = null
      let est1rm: number | null = null
      const weights: number[] = []
      for (const st of s.sets) {
        if (st.weight != null) {
          weights.push(st.weight)
          if (topSet == null || st.weight > topSet.weight) topSet = { weight: st.weight, reps: st.reps }
          if (st.reps != null && st.reps > 0) {
            const e = epley(st.weight, st.reps)
            if (est1rm == null || e > est1rm) est1rm = e
          }
        }
      }
      const top3 = [...weights].sort((a, b) => b - a).slice(0, 3) // heaviest first
      const volume = Math.round(s.sets.reduce((sum, st) => sum + setVolume(st), 0))
      return {
        sessionId: s.sessionId,
        date:      s.date,
        est1rm,
        volume,
        topSet,
        top3,
        sets: s.sets.map((st) => ({
          setNumber: st.setNumber,
          weight:    st.weight,
          reps:      st.reps,
          perSide:   st.perSide ?? false,
          repsLeft:  st.repsLeft ?? null,
          repsRight: st.repsRight ?? null,
        })),
      }
    })

  // Rate-of-change of the top-3-heaviest positions over time.
  const byRank = ([1, 2, 3] as const).flatMap((rank) => {
    const series: { date: string; weight: number }[] = []
    for (const s of summaries) {
      const w = s.top3[rank - 1]
      if (w != null) series.push({ date: s.date, weight: w })
    }
    if (series.length === 0) return []
    const last = series[series.length - 1]
    return [{
      rank,
      latestWeight: last ? last.weight : null,
      series,
      trend: weightTrend(series),
    }]
  })

  const latest = summaries[summaries.length - 1]
  const est1rmValues = summaries.map((s) => s.est1rm).filter((e): e is number => e != null)
  const rank1 = byRank.find((r) => r.rank === 1)

  return {
    exerciseId,
    workoutType: workoutType as ExerciseProgressResponse['workoutType'],
    supported: workoutType === 'resistance',
    // Newest first for the history list.
    sessions: [...summaries].reverse().map((s) => ({
      sessionId: s.sessionId,
      date:      s.date,
      est1rm:    s.est1rm,
      volume:    s.volume,
      topSet:    s.topSet,
      sets:      s.sets,
    })),
    byRank,
    overall: {
      currentEst1rm:       latest?.est1rm ?? null,
      currentTopSetWeight: latest?.topSet?.weight ?? null,
      bestEst1rm:          est1rmValues.length ? Math.max(...est1rmValues) : null,
      bestVolume:          summaries.length ? Math.max(...summaries.map((s) => s.volume)) : null,
      highestWeightTrend:  rank1?.trend ?? weightTrend([]),
    },
  }
}
