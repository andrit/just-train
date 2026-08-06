// lib/exerciseProgress.test.ts — unit tests for the pure progression builder.
//
// Covers: per-rank series + trend, top-3-heaviest (warm-up drops out),
// newest-first history, non-resistance (supported:false), empty input,
// and ranks when sessions have fewer than 3 sets.

import { describe, it, expect } from 'vitest'
import { buildExerciseProgress, type ProgressSetRow } from '../../lib/exerciseProgress'

function row(
  sessionId: string,
  date: string,
  setNumber: number,
  weight: number | null,
  reps: number | null,
  extra: Partial<ProgressSetRow> = {},
): ProgressSetRow {
  return { sessionId, date, setNumber, weight, reps, perSide: false, repsLeft: null, repsRight: null, ...extra }
}

describe('buildExerciseProgress', () => {
  it('tracks each top-3 rank over time and trends the heaviest', () => {
    const rows = [
      row('A', '2026-01-01', 1, 135, 5),
      row('A', '2026-01-01', 2, 175, 5),
      row('A', '2026-01-01', 3, 205, 5),
      row('B', '2026-01-15', 1, 155, 5),
      row('B', '2026-01-15', 2, 185, 5),
      row('B', '2026-01-15', 3, 225, 5),
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')

    expect(p.supported).toBe(true)
    expect(p.sessions).toHaveLength(2)
    expect(p.sessions[0]?.date).toBe('2026-01-15') // newest first

    const r1 = p.byRank.find((r) => r.rank === 1)
    expect(r1?.series.map((s) => s.weight)).toEqual([205, 225]) // oldest → newest
    expect(r1?.latestWeight).toBe(225)
    expect(r1?.trend.direction).toBe('up')
    expect(r1?.trend.deltaFirstToLast).toBe(20)

    const r3 = p.byRank.find((r) => r.rank === 3)
    expect(r3?.series.map((s) => s.weight)).toEqual([135, 155])

    expect(p.overall.currentTopSetWeight).toBe(225)
    expect(p.overall.highestWeightTrend.deltaFirstToLast).toBe(20)
    // Epley of 225×5 = 262.5, the best single-session estimate
    expect(p.overall.bestEst1rm).toBeCloseTo(262.5, 5)
  })

  it('ranks by weight so a warm-up drops out of the top 3', () => {
    const rows = [
      row('A', '2026-01-01', 1, 95,  10), // warm-up
      row('A', '2026-01-01', 2, 205, 5),
      row('A', '2026-01-01', 3, 225, 5),
      row('A', '2026-01-01', 4, 245, 3),
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(p.byRank.map((r) => r.latestWeight)).toEqual([245, 225, 205]) // 95 excluded
    expect(p.overall.currentTopSetWeight).toBe(245)
  })

  it('counts both sides for per-side volume', () => {
    const rows = [
      row('A', '2026-01-01', 1, 20, 10, { perSide: true }), // 20 × (10+10) = 400
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(p.sessions[0]?.volume).toBe(400)
  })

  it('marks non-resistance as unsupported', () => {
    const p = buildExerciseProgress([], 'ex1', 'cardio')
    expect(p.supported).toBe(false)
  })

  it('handles no history', () => {
    const p = buildExerciseProgress([], 'ex1', 'resistance')
    expect(p.sessions).toEqual([])
    expect(p.byRank).toEqual([])
    expect(p.overall.currentEst1rm).toBeNull()
    expect(p.overall.bestVolume).toBeNull()
    expect(p.overall.highestWeightTrend.direction).toBe('flat')
  })

  it('only includes a rank in sessions that reached it', () => {
    const rows = [
      row('A', '2026-01-01', 1, 100, 5),
      row('A', '2026-01-01', 2, 120, 5), // 2 sets only
      row('B', '2026-01-08', 1, 110, 5),
      row('B', '2026-01-08', 2, 130, 5),
      row('B', '2026-01-08', 3, 140, 5), // 3 sets
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    // rank 1 = heaviest each session: A→120, B→140
    expect(p.byRank.find((r) => r.rank === 1)?.series.map((s) => s.weight)).toEqual([120, 140])
    // rank 3 = 3rd heaviest; only session B has 3 sets (110/130/140 → 3rd = 110)
    expect(p.byRank.find((r) => r.rank === 3)?.series.map((s) => s.weight)).toEqual([110])
  })
})
