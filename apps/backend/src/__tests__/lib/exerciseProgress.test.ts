// lib/exerciseProgress.test.ts — unit tests for the pure progression builder.
//
// Covers: per-rank series + trend, top-3-heaviest (warm-up drops out),
// newest-first history, non-resistance (supported:false), empty input,
// ranks when sessions have fewer than 3 sets, and the per-set-position
// averages (window, uneven positions, null handling, rep rounding).

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

// ── bySetPosition — average weight/reps per set position, last 5 sessions ─────

describe('buildExerciseProgress — bySetPosition', () => {
  const at = (p: ReturnType<typeof buildExerciseProgress>, setNumber: number) =>
    p.bySetPosition.find((s) => s.setNumber === setNumber)

  it('averages only the newest 5 sessions, ignoring older ones', () => {
    // Six sessions of set 1. The oldest is a wild outlier that must fall outside
    // the window — if it leaked in, the average would be 250, not 100.
    const rows = [
      row('A', '2026-01-01', 1, 1000, 5),
      row('B', '2026-01-08', 1, 100, 5),
      row('C', '2026-01-15', 1, 100, 5),
      row('D', '2026-01-22', 1, 100, 5),
      row('E', '2026-01-29', 1, 100, 5),
      row('F', '2026-02-05', 1, 100, 5),
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(at(p, 1)?.avgWeight).toBe(100)
    expect(at(p, 1)?.sessionCount).toBe(5) // the window, not all six
  })

  it('averages each position over only the sessions that reached it', () => {
    const rows = [
      row('A', '2026-01-01', 1, 100, 10),
      row('A', '2026-01-01', 2, 110, 8),
      row('B', '2026-01-08', 1, 200, 10),
      row('B', '2026-01-08', 2, 210, 8),
      row('B', '2026-01-08', 3, 300, 6), // only B has a 3rd set
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(p.bySetPosition.map((s) => s.setNumber)).toEqual([1, 2, 3]) // ordered
    expect(at(p, 1)?.avgWeight).toBe(150)
    expect(at(p, 1)?.sessionCount).toBe(2)
    expect(at(p, 3)?.avgWeight).toBe(300)
    expect(at(p, 3)?.sessionCount).toBe(1) // thin position is visible as such
  })

  it('skips null weights without dropping the position', () => {
    const rows = [
      row('A', '2026-01-01', 1, null, 10), // bodyweight / unrecorded
      row('B', '2026-01-08', 1, 100,  10),
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(at(p, 1)?.avgWeight).toBe(100) // averages the one real weight
    expect(at(p, 1)?.avgReps).toBe(10)    // reps unaffected
    expect(at(p, 1)?.sessionCount).toBe(2)
  })

  it('reports reps even when no set at that position recorded a weight', () => {
    const rows = [
      row('A', '2026-01-01', 1, null, 12),
      row('B', '2026-01-08', 1, null, 10),
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(at(p, 1)?.avgWeight).toBeNull()
    expect(at(p, 1)?.avgReps).toBe(11)
  })

  it('rounds reps half-up: 8.4 → 8', () => {
    // 8 + 8 + 8 + 9 + 9 = 42 over 5 sessions = 8.4
    const rows = [
      row('A', '2026-01-01', 1, 100, 8),
      row('B', '2026-01-08', 1, 100, 8),
      row('C', '2026-01-15', 1, 100, 8),
      row('D', '2026-01-22', 1, 100, 9),
      row('E', '2026-01-29', 1, 100, 9),
    ]
    expect(at(buildExerciseProgress(rows, 'ex1', 'resistance'), 1)?.avgReps).toBe(8)
  })

  it('rounds reps half-up: 8.5 → 9', () => {
    // 8 + 8 + 9 + 9 = 34 over 4 sessions = 8.5 — the boundary rounds up
    const rows = [
      row('A', '2026-01-01', 1, 100, 8),
      row('B', '2026-01-08', 1, 100, 8),
      row('C', '2026-01-15', 1, 100, 9),
      row('D', '2026-01-22', 1, 100, 9),
    ]
    expect(at(buildExerciseProgress(rows, 'ex1', 'resistance'), 1)?.avgReps).toBe(9)
  })

  it('keeps weight to one decimal', () => {
    // (100 + 105 + 111) / 3 = 105.333…
    const rows = [
      row('A', '2026-01-01', 1, 100, 5),
      row('B', '2026-01-08', 1, 105, 5),
      row('C', '2026-01-15', 1, 111, 5),
    ]
    expect(at(buildExerciseProgress(rows, 'ex1', 'resistance'), 1)?.avgWeight).toBe(105.3)
  })

  it('averages entered reps for a per-side set, not the doubled side count', () => {
    // The live input takes reps-per-side, so the average must be in the same unit
    // the athlete types — 10, not 20. (Volume still counts both sides; see above.)
    const rows = [row('A', '2026-01-01', 1, 20, 10, { perSide: true })]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(at(p, 1)?.avgReps).toBe(10)
  })

  it('handles a single session', () => {
    const rows = [
      row('A', '2026-01-01', 1, 100, 10),
      row('A', '2026-01-01', 2, 120, 8),
    ]
    const p = buildExerciseProgress(rows, 'ex1', 'resistance')
    expect(p.bySetPosition).toHaveLength(2)
    expect(at(p, 2)?.avgWeight).toBe(120)
    expect(at(p, 2)?.sessionCount).toBe(1)
  })

  it('is empty with no history', () => {
    expect(buildExerciseProgress([], 'ex1', 'resistance').bySetPosition).toEqual([])
  })
})
