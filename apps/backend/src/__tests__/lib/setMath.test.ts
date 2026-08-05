// ------------------------------------------------------------
// lib/setMath.test.ts — unit tests for the shared per-side reps/volume helper.
//
// Pure functions, no I/O. Covers the three laterality cases (bilateral,
// symmetric per-side, asymmetric drill-down), asymmetry detection, and the
// null-weight / null-reps edges (cardio / time-only sets).
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { sideReps, setVolume, isAsymmetric } from '@trainer-app/shared'

describe('sideReps', () => {
  it('counts reps once for a bilateral set', () => {
    expect(sideReps({ reps: 12, perSide: false })).toBe(12)
    expect(sideReps({ reps: 12 })).toBe(12) // perSide undefined = bilateral
  })

  it('doubles reps for a symmetric per-side set', () => {
    expect(sideReps({ reps: 10, perSide: true })).toBe(20)
  })

  it('sums L + R for an asymmetric per-side set', () => {
    expect(sideReps({ reps: 10, perSide: true, repsLeft: 9, repsRight: 10 })).toBe(19)
  })

  it('falls back to reps for whichever side is null', () => {
    expect(sideReps({ reps: 10, perSide: true, repsLeft: 8 })).toBe(18) // right falls back to 10
    expect(sideReps({ reps: 10, perSide: true, repsRight: 8 })).toBe(18)
  })

  it('returns 0 when reps is null/undefined (cardio/time-only set)', () => {
    expect(sideReps({ reps: null })).toBe(0)
    expect(sideReps({ reps: null, perSide: true })).toBe(0)
  })
})

describe('setVolume', () => {
  it('is weight × reps for a bilateral set', () => {
    expect(setVolume({ reps: 10, weight: 100 })).toBe(1000)
  })

  it('counts both sides for a symmetric per-side set', () => {
    expect(setVolume({ reps: 10, weight: 20, perSide: true })).toBe(400) // 20 × 20
  })

  it('uses L + R for an asymmetric per-side set', () => {
    expect(setVolume({ reps: 10, weight: 20, perSide: true, repsLeft: 9, repsRight: 10 })).toBe(380) // 20 × 19
  })

  it('is 0 when weight is null (bodyweight / cardio)', () => {
    expect(setVolume({ reps: 10, weight: null, perSide: true })).toBe(0)
  })
})

describe('isAsymmetric', () => {
  it('is false for bilateral and symmetric per-side sets', () => {
    expect(isAsymmetric({ reps: 10, perSide: false })).toBe(false)
    expect(isAsymmetric({ reps: 10, perSide: true })).toBe(false)
    expect(isAsymmetric({ reps: 10, perSide: true, repsLeft: 10, repsRight: 10 })).toBe(false)
  })

  it('is true only when a per-side split differs L vs R', () => {
    expect(isAsymmetric({ reps: 10, perSide: true, repsLeft: 9, repsRight: 10 })).toBe(true)
    expect(isAsymmetric({ reps: 10, perSide: true, repsLeft: 9 })).toBe(true) // right falls back to 10
  })

  it('never flags a bilateral set even if L/R somehow present', () => {
    expect(isAsymmetric({ reps: 10, perSide: false, repsLeft: 9, repsRight: 10 })).toBe(false)
  })
})
