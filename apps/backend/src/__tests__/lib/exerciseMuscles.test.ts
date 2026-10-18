// ------------------------------------------------------------
// lib/exerciseMuscles.test.ts — unit tests for buildMuscleRows.
//
// Pure, no I/O. Covers: role tagging, empty input, within-group de-dupe,
// primary-wins when a muscle appears in both groups, and order preservation.
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import { buildMuscleRows } from '../../lib/exerciseMuscles'

const EX = '11111111-1111-1111-1111-111111111111'

describe('buildMuscleRows', () => {
  it('tags primary and secondary rows with the exercise id', () => {
    const rows = buildMuscleRows(EX, {
      primary:   ['biceps_brachii'],
      secondary: ['brachialis', 'brachioradialis'],
    })
    expect(rows).toEqual([
      { exerciseId: EX, muscle: 'biceps_brachii',  role: 'primary' },
      { exerciseId: EX, muscle: 'brachialis',      role: 'secondary' },
      { exerciseId: EX, muscle: 'brachioradialis', role: 'secondary' },
    ])
  })

  it('returns no rows for empty groups', () => {
    expect(buildMuscleRows(EX, { primary: [], secondary: [] })).toEqual([])
  })

  it('de-dupes within a group', () => {
    const rows = buildMuscleRows(EX, {
      primary:   ['pectoralis_major', 'pectoralis_major'],
      secondary: ['deltoid_anterior', 'deltoid_anterior'],
    })
    expect(rows.map((r) => r.muscle)).toEqual(['pectoralis_major', 'deltoid_anterior'])
  })

  it('keeps a muscle as primary when it appears in both groups (primary wins)', () => {
    const rows = buildMuscleRows(EX, {
      primary:   ['quadriceps'],
      secondary: ['quadriceps', 'gluteus_maximus'],
    })
    expect(rows).toEqual([
      { exerciseId: EX, muscle: 'quadriceps',      role: 'primary' },
      { exerciseId: EX, muscle: 'gluteus_maximus', role: 'secondary' },
    ])
  })

  it('preserves the given order within each group', () => {
    const rows = buildMuscleRows(EX, {
      primary:   ['latissimus_dorsi', 'trapezius_middle'],
      secondary: ['rhomboids', 'biceps_brachii'],
    })
    expect(rows.map((r) => r.muscle)).toEqual([
      'latissimus_dorsi', 'trapezius_middle', 'rhomboids', 'biceps_brachii',
    ])
  })
})
