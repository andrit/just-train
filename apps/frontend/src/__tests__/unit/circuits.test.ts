import { describe, it, expect } from 'vitest'
import type { SessionExerciseResponse } from '@trainer-app/shared'
import { circuitLabel, groupExercisesByCircuit } from '@/lib/circuits'

// Minimal SessionExerciseResponse builder — only the fields the helpers read.
function se(
  id: string,
  circuitId: string | null,
  bodyPart: string | null,
  targetSets: number | null = 3,
): SessionExerciseResponse {
  return {
    id,
    circuitId,
    targetSets,
    sets: [],
    exercise: bodyPart
      ? { name: id, bodyPart: { name: bodyPart } }
      : { name: id, bodyPart: null },
  } as unknown as SessionExerciseResponse
}

describe('circuitLabel', () => {
  it('derives "{BodyPart} Circuit" when all members share a body part', () => {
    expect(circuitLabel([se('a', 'c1', 'shoulders'), se('b', 'c1', 'shoulders')]))
      .toBe('Shoulders Circuit')
  })

  it('title-cases and de-underscores the body part', () => {
    expect(circuitLabel([se('a', 'c1', 'full_body'), se('b', 'c1', 'full_body')]))
      .toBe('Full body Circuit')
  })

  it('falls back to "Circuit" when body parts differ', () => {
    expect(circuitLabel([se('a', 'c1', 'chest'), se('b', 'c1', 'back')]))
      .toBe('Circuit')
  })

  it('falls back to "Circuit" when a body part is missing', () => {
    expect(circuitLabel([se('a', 'c1', null), se('b', 'c1', null)]))
      .toBe('Circuit')
  })
})

describe('groupExercisesByCircuit', () => {
  it('keeps standalone exercises as solo groups, in order', () => {
    const groups = groupExercisesByCircuit([se('a', null, 'chest'), se('b', null, 'legs')])
    expect(groups.map((g) => g.kind)).toEqual(['solo', 'solo'])
  })

  it('brackets consecutive members sharing a circuitId into one circuit group', () => {
    const groups = groupExercisesByCircuit([
      se('a', 'c1', 'shoulders'),
      se('b', 'c1', 'shoulders'),
      se('c', 'c1', 'shoulders'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('circuit')
    if (groups[0].kind === 'circuit') {
      expect(groups[0].members.map((m) => m.id)).toEqual(['a', 'b', 'c'])
      expect(groups[0].label).toBe('Shoulders Circuit')
      expect(groups[0].rounds).toBe(3)
    }
  })

  it('preserves interleaving of solo and circuit groups', () => {
    const groups = groupExercisesByCircuit([
      se('warmup', null, 'legs'),
      se('a', 'c1', 'shoulders'),
      se('b', 'c1', 'shoulders'),
      se('finisher', null, 'core'),
    ])
    expect(groups.map((g) => g.kind)).toEqual(['solo', 'circuit', 'solo'])
  })

  it('separates two distinct circuits', () => {
    const groups = groupExercisesByCircuit([
      se('a', 'c1', 'shoulders'), se('b', 'c1', 'shoulders'),
      se('c', 'c2', 'legs'),      se('d', 'c2', 'legs'),
    ])
    expect(groups.map((g) => g.kind)).toEqual(['circuit', 'circuit'])
  })

  it('demotes a single-member circuit to solo (e.g. after a member was deleted)', () => {
    const groups = groupExercisesByCircuit([se('lonely', 'c1', 'shoulders')])
    expect(groups).toHaveLength(1)
    expect(groups[0].kind).toBe('solo')
  })

  it('derives rounds from the max target sets across members', () => {
    const groups = groupExercisesByCircuit([
      se('a', 'c1', 'shoulders', 4),
      se('b', 'c1', 'shoulders', 4),
    ])
    if (groups[0].kind === 'circuit') expect(groups[0].rounds).toBe(4)
  })
})
