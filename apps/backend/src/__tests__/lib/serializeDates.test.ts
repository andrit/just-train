import { describe, it, expect } from 'vitest'
import { serializeDates } from '../../lib/serializeDates'

describe('serializeDates', () => {
  it('converts Dates at any depth and leaves everything else alone', () => {
    const d = new Date('2026-09-16T10:00:00.000Z')
    const out = serializeDates({ createdAt: d, n: 1, s: 'x', nil: null, nested: { media: [{ createdAt: d, isPrimary: true }] } })
    expect(out).toEqual({ createdAt: d.toISOString(), n: 1, s: 'x', nil: null, nested: { media: [{ createdAt: d.toISOString(), isPrimary: true }] } })
  })
})
