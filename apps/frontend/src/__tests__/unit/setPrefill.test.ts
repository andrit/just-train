// setPrefill.test.ts
//
// Which set seeds the live input, and — just as important — whether the chosen
// set counts as "prior in session", since that flag gates weight-ramp compounding.

import { describe, it, expect } from 'vitest'
import type { SetResponse } from '@trainer-app/shared'
import type { ExerciseHistorySet } from '@/lib/queries/clients'
import { pickPrefillSet, isPriorInSession } from '@/lib/setPrefill'

const SE_ID = 'se-1'

function logged(setNumber: number, weight: number, reps: number): SetResponse {
  return {
    id: `s${setNumber}`, sessionExerciseId: SE_ID, setNumber, reps, weight,
    weightUnit: 'kg', durationSeconds: null, distance: null, intensity: null,
    perSide: false, repsLeft: null, repsRight: null,
    isPR: false, isPRVolume: false, isLoadRecord: false, isVolumeRecord: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  } as SetResponse
}

function history(setNumber: number, weight: number, reps: number): ExerciseHistorySet {
  return {
    sessionDate: '2026-01-01', setNumber, reps, weight, weightUnit: 'kg',
    perSide: false, repsLeft: null, repsRight: null, durationSeconds: null,
  }
}

const args = (over: Partial<Parameters<typeof pickPrefillSet>[0]> = {}) => ({
  setIndex: 0, loggedSets: [], lastSessionSets: [], weightStep: 0,
  sessionExerciseId: SE_ID, ...over,
})

describe('pickPrefillSet', () => {
  it('offers last session\'s set at the SAME position, not one weight repeated', () => {
    const lastSessionSets = [history(1, 100, 10), history(2, 110, 8), history(3, 120, 6)]

    // Set 1, nothing logged yet.
    expect(pickPrefillSet(args({ setIndex: 0, lastSessionSets })).set?.weight).toBe(100)

    // Set 3, with two sets already logged today — the old behaviour would have
    // handed back today's set 2. It must offer last session's set 3.
    const out = pickPrefillSet(args({
      setIndex: 2,
      loggedSets: [logged(1, 100, 10), logged(2, 110, 8)],
      lastSessionSets,
    }))
    expect(out.set?.weight).toBe(120)
    expect(out.source).toBe('history')
  })

  it('lets an explicit ramp outrank history', () => {
    const out = pickPrefillSet(args({
      setIndex: 1,
      loggedSets: [logged(1, 100, 10)],
      lastSessionSets: [history(1, 60, 10), history(2, 65, 10)],
      weightStep: 20,
    }))
    // Returns today's set 1 so the caller can add the step to it.
    expect(out.source).toBe('ramp')
    expect(out.set?.weight).toBe(100)
  })

  it('does not fire the ramp on set 1 — there is nothing to compound from', () => {
    const out = pickPrefillSet(args({
      setIndex: 0,
      loggedSets: [],
      lastSessionSets: [history(1, 60, 10)],
      weightStep: 20,
    }))
    expect(out.source).toBe('history')
  })

  it('falls back to today\'s previous set when history is shorter', () => {
    // A 4th set today; last session only ever did three.
    const out = pickPrefillSet(args({
      setIndex: 3,
      loggedSets: [logged(1, 100, 10), logged(2, 110, 8), logged(3, 120, 6)],
      lastSessionSets: [history(1, 90, 10), history(2, 95, 8), history(3, 100, 6)],
    }))
    expect(out.source).toBe('in-session')
    expect(out.set?.weight).toBe(120)
  })

  it('returns null when there is neither history nor a logged set', () => {
    expect(pickPrefillSet(args())).toEqual({ set: null, source: null })
  })

  it('carries per-side splits through from history', () => {
    const asymmetric: ExerciseHistorySet = {
      ...history(1, 20, 10), perSide: true, repsLeft: 9, repsRight: 10,
    }
    const out = pickPrefillSet(args({ lastSessionSets: [asymmetric] }))
    expect(out.set?.perSide).toBe(true)
    expect(out.set?.repsLeft).toBe(9)
    expect(out.set?.repsRight).toBe(10)
  })

  it('stamps the current sessionExerciseId on a set built from history', () => {
    const out = pickPrefillSet(args({ lastSessionSets: [history(1, 100, 10)] }))
    expect(out.set?.sessionExerciseId).toBe(SE_ID)
  })
})

describe('isPriorInSession', () => {
  it('is true only for sets logged today', () => {
    expect(isPriorInSession('ramp')).toBe(true)
    expect(isPriorInSession('in-session')).toBe(true)
    // The one that matters: a set pulled from last session must NOT let the ramp
    // compound, or the step gets added to a weight from a different day.
    expect(isPriorInSession('history')).toBe(false)
    expect(isPriorInSession(null)).toBe(false)
  })
})
