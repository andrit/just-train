// lib/progression.test.ts — unit tests for the pure weightTrend helper.
//
// Covers: empty/single point, rising/falling/flat, the delta vs slope split,
// out-of-order input, and same-date guard.

import { describe, it, expect } from 'vitest'
import { weightTrend } from '../../lib/progression'

// One point per week starting 2026-01-01.
const wk = (i: number): string => new Date(2026, 0, 1 + i * 7).toISOString()

describe('weightTrend', () => {
  it('returns a flat zero trend for no points', () => {
    expect(weightTrend([])).toMatchObject({ direction: 'flat', deltaFirstToLast: 0, slopePerWeek: 0, points: 0 })
  })

  it('returns flat for a single point', () => {
    expect(weightTrend([{ date: wk(0), weight: 100 }])).toMatchObject({ direction: 'flat', deltaFirstToLast: 0, points: 1 })
  })

  it('detects a rising trend and reports the first→last delta', () => {
    const t = weightTrend([
      { date: wk(0), weight: 205 },
      { date: wk(2), weight: 215 },
      { date: wk(4), weight: 225 },
    ])
    expect(t.direction).toBe('up')
    expect(t.deltaFirstToLast).toBe(20)     // 225 − 205
    expect(t.slopePerWeek).toBeCloseTo(5, 5) // +10 lb / 2 wks
    expect(t.spanWeeks).toBe(4)
  })

  it('detects a falling trend', () => {
    const t = weightTrend([
      { date: wk(0), weight: 100 },
      { date: wk(1), weight: 95 },
      { date: wk(2), weight: 90 },
    ])
    expect(t.direction).toBe('down')
    expect(t.deltaFirstToLast).toBe(-10)
  })

  it('calls a constant series flat', () => {
    const t = weightTrend([
      { date: wk(0), weight: 135 },
      { date: wk(1), weight: 135 },
      { date: wk(2), weight: 135 },
    ])
    expect(t.direction).toBe('flat')
    expect(t.slopePerWeek).toBe(0)
    expect(t.deltaFirstToLast).toBe(0)
  })

  it('is robust to one noisy dip (slope up even though a middle point drops)', () => {
    const t = weightTrend([
      { date: wk(0), weight: 200 },
      { date: wk(1), weight: 185 }, // noisy off day
      { date: wk(2), weight: 210 },
      { date: wk(3), weight: 220 },
    ])
    expect(t.direction).toBe('up')
  })

  it('sorts out-of-order input before computing', () => {
    const t = weightTrend([
      { date: wk(2), weight: 225 },
      { date: wk(0), weight: 205 },
      { date: wk(1), weight: 215 },
    ])
    expect(t.deltaFirstToLast).toBe(20) // earliest 205 → latest 225
    expect(t.direction).toBe('up')
  })

  it('treats an all-same-date series as flat (no time axis)', () => {
    const t = weightTrend([
      { date: wk(0), weight: 200 },
      { date: wk(0), weight: 220 },
    ])
    expect(t.slopePerWeek).toBe(0)
    expect(t.direction).toBe('flat')
  })
})
