import { describe, it, expect } from 'vitest'
import { weightRampSequence } from '@/lib/weightRamp'

describe('weightRampSequence', () => {
  it('expands a positive ramp across sets', () => {
    expect(weightRampSequence(100, 50, 4)).toEqual([100, 150, 200, 250])
  })

  it('returns a flat sequence when the step is 0', () => {
    expect(weightRampSequence(60, 0, 3)).toEqual([60, 60, 60])
  })

  it('floors negative values at 0 on a descending ramp', () => {
    expect(weightRampSequence(20, -15, 3)).toEqual([20, 5, 0])
  })

  it('clamps sets below 1 to a single value', () => {
    expect(weightRampSequence(45, 10, 0)).toEqual([45])
  })
})
