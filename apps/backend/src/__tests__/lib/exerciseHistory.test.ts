// lib/exerciseHistory.test.ts — unit tests for the last-session selection.
//
// The case that matters: two completed sessions on the SAME DATE. `sessions.date`
// is text 'YYYY-MM-DD' with no time component, so date can never separate them.

import { describe, it, expect } from 'vitest'
import { mostRecentSessionSets } from '../../lib/exerciseHistory'

function row(sessionId: string, date: string, setNumber: number, weight: number) {
  return { sessionId, date, setNumber, weight }
}

describe('mostRecentSessionSets', () => {
  it('returns only the first row\'s session, not everything sharing its date', () => {
    // Two sessions on 2026-01-08 — an evening lift (newest) and a morning one.
    // Ordered as the route orders them: date desc, createdAt desc, setNumber.
    const rows = [
      row('evening', '2026-01-08', 1, 100),
      row('evening', '2026-01-08', 2, 110),
      row('evening', '2026-01-08', 3, 120),
      row('morning', '2026-01-08', 1, 60),
      row('morning', '2026-01-08', 2, 65),
    ]
    const out = mostRecentSessionSets(rows)

    expect(out.map((r) => r.sessionId)).toEqual(['evening', 'evening', 'evening'])
    // Set positions stay 1,2,3 — no duplicate positions from the other session.
    expect(out.map((r) => r.setNumber)).toEqual([1, 2, 3])
    // Indexing by position gives that position's weight, not the other session's.
    expect(out[1]?.weight).toBe(110)
  })

  it('drops older sessions on earlier dates', () => {
    const rows = [
      row('B', '2026-01-08', 1, 100),
      row('B', '2026-01-08', 2, 110),
      row('A', '2026-01-01', 1, 90),
    ]
    expect(mostRecentSessionSets(rows).map((r) => r.sessionId)).toEqual(['B', 'B'])
  })

  it('returns every set of a single session', () => {
    const rows = [row('A', '2026-01-01', 1, 100), row('A', '2026-01-01', 2, 110)]
    expect(mostRecentSessionSets(rows)).toHaveLength(2)
  })

  it('returns an empty array for no rows', () => {
    expect(mostRecentSessionSets([])).toEqual([])
  })

  it('caps at the max, keeping the earliest positions', () => {
    const rows = Array.from({ length: 14 }, (_, i) => row('A', '2026-01-01', i + 1, 100))
    const out = mostRecentSessionSets(rows)
    expect(out).toHaveLength(10)
    expect(out[0]?.setNumber).toBe(1)
    expect(out[9]?.setNumber).toBe(10)
  })

  it('honours an explicit max', () => {
    const rows = [
      row('A', '2026-01-01', 1, 100),
      row('A', '2026-01-01', 2, 110),
      row('A', '2026-01-01', 3, 120),
    ]
    expect(mostRecentSessionSets(rows, 2).map((r) => r.setNumber)).toEqual([1, 2])
  })
})
