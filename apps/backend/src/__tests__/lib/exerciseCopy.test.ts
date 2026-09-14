// ------------------------------------------------------------
// lib/exerciseCopy.test.ts — unit tests for the pure plan-copy helpers
//
// The mappers are the single field list shared by save-as-template, fork and
// apply. The "copies every planning field" cases are the check that a column
// added to the schema was also added here — nothing else catches that.
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import {
  createCircuitRemapper,
  toTemplateExerciseRow,
  toSessionExerciseRow,
  type PlannedExerciseSource,
} from '../../lib/exerciseCopy'

const SRC_CID = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa'
const EX_ID   = 'eeeeeeee-0000-0000-0000-eeeeeeeeeeee'

function src(overrides: Partial<PlannedExerciseSource> = {}): PlannedExerciseSource {
  return {
    exerciseId:            EX_ID,
    workoutType:           'resistance',
    orderIndex:            2,
    circuitId:             null,
    targetSets:            3,
    targetReps:            8,
    targetRepsPerSet:      '10,8,6',
    targetWeight:          100,
    targetWeightStep:      10,
    targetWeightUnit:      'kg',
    targetDurationSeconds: 45,
    targetDistance:        1.5,
    targetIntensity:       'high',
    notes:                 'pause at bottom',
    trackPerSide:          null,
    ...overrides,
  }
}

describe('createCircuitRemapper', () => {
  it('maps null to null (standalone stays standalone)', () => {
    expect(createCircuitRemapper()(null)).toBeNull()
  })

  it('never returns the source id', () => {
    expect(createCircuitRemapper()(SRC_CID)).not.toBe(SRC_CID)
  })

  it('maps the same source id to the same fresh id (members stay grouped)', () => {
    const remap = createCircuitRemapper()
    expect(remap(SRC_CID)).toBe(remap(SRC_CID))
  })

  it('maps distinct source ids to distinct fresh ids', () => {
    const remap = createCircuitRemapper()
    expect(remap(SRC_CID)).not.toBe(remap('bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb'))
  })

  it('is independent per remapper (two copies of one source do not share circuits)', () => {
    expect(createCircuitRemapper()(SRC_CID)).not.toBe(createCircuitRemapper()(SRC_CID))
  })
})

describe('toTemplateExerciseRow', () => {
  it('copies every planning field and stamps the target template', () => {
    const row = toTemplateExerciseRow(src(), 'tpl-1', createCircuitRemapper())
    expect(row).toEqual({
      templateId:            'tpl-1',
      exerciseId:            EX_ID,
      workoutType:           'resistance',
      orderIndex:            2,
      circuitId:             null,
      targetSets:            3,
      targetReps:            8,
      targetRepsPerSet:      '10,8,6',
      targetWeight:          100,
      targetWeightStep:      10,
      targetWeightUnit:      'kg',
      targetDurationSeconds: 45,
      targetDistance:        1.5,
      targetIntensity:       'high',
      notes:                 'pause at bottom',
      trackPerSide:          null,
    })
  })

  it('preserves an explicit per-side mode from a session (true and false)', () => {
    const remap = createCircuitRemapper()
    expect(toTemplateExerciseRow(src({ trackPerSide: true }),  'tpl-1', remap).trackPerSide).toBe(true)
    expect(toTemplateExerciseRow(src({ trackPerSide: false }), 'tpl-1', remap).trackPerSide).toBe(false)
  })

  it('remaps the circuit id through the supplied remapper', () => {
    const remap = createCircuitRemapper()
    const a = toTemplateExerciseRow(src({ circuitId: SRC_CID }), 'tpl-1', remap)
    const b = toTemplateExerciseRow(src({ circuitId: SRC_CID }), 'tpl-1', remap)
    expect(a.circuitId).toBeTruthy()
    expect(a.circuitId).toBe(b.circuitId)
    expect(a.circuitId).not.toBe(SRC_CID)
  })
})

describe('toSessionExerciseRow', () => {
  const none = new Set<string>()

  it('copies every planning field and stamps the target session', () => {
    const row = toSessionExerciseRow(src(), 'ses-1', createCircuitRemapper(), none)
    expect(row).toEqual({
      sessionId:             'ses-1',
      exerciseId:            EX_ID,
      workoutType:           'resistance',
      orderIndex:            2,
      circuitId:             null,
      targetSets:            3,
      targetReps:            8,
      targetRepsPerSet:      '10,8,6',
      targetWeight:          100,
      targetWeightStep:      10,
      targetWeightUnit:      'kg',
      targetDurationSeconds: 45,
      targetDistance:        1.5,
      targetIntensity:       'high',
      notes:                 'pause at bottom',
      trackPerSide:          false,
    })
  })

  it('resolves a null per-side mode from the exercise laterality', () => {
    const remap = createCircuitRemapper()
    expect(toSessionExerciseRow(src(), 'ses-1', remap, new Set([EX_ID])).trackPerSide).toBe(true)
    expect(toSessionExerciseRow(src(), 'ses-1', remap, none).trackPerSide).toBe(false)
  })

  it('lets an explicit per-side mode override the laterality default', () => {
    const remap = createCircuitRemapper()
    // Unilateral exercise saved from a session where the athlete chose "together".
    expect(toSessionExerciseRow(src({ trackPerSide: false }), 'ses-1', remap, new Set([EX_ID])).trackPerSide).toBe(false)
    // Bilateral exercise explicitly tracked per side.
    expect(toSessionExerciseRow(src({ trackPerSide: true }), 'ses-1', remap, none).trackPerSide).toBe(true)
  })
})
