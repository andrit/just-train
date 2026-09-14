// ------------------------------------------------------------
// lib/telemetrySink.test.ts — the Postgres sink maps events to rows and
// createTelemetrySink() honours TELEMETRY_SINK.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db', () => {
  const chain = { values: vi.fn().mockResolvedValue(undefined) }
  return { db: { insert: vi.fn().mockReturnValue(chain) }, clientEvents: {}, chain }
})

import { db } from '../../db'
import { postgresSink, noopSink, createTelemetrySink } from '../../lib/telemetry/sink'

describe('postgresSink', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts one row per event, stamped with the trainer, and returns the count', async () => {
    const n = await postgresSink.record('t-1', [
      { name: 'offline.cache_hit', props: { count: 3 }, clientTs: '2026-09-14T10:00:00.000Z' },
      { name: 'session.completed', clientTs: '2026-09-14T10:05:00.000Z' },
    ])
    expect(n).toBe(2)
    const rows = vi.mocked(db.insert({} as never).values).mock.calls[0]?.[0] as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ trainerId: 't-1', name: 'offline.cache_hit', props: { count: 3 } })
    expect(rows[0]?.clientTs).toEqual(new Date('2026-09-14T10:00:00.000Z'))
    expect(rows[1]).toMatchObject({ trainerId: 't-1', name: 'session.completed', props: null })
  })

  it('does nothing for an empty batch', async () => {
    expect(await postgresSink.record('t-1', [])).toBe(0)
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe('createTelemetrySink', () => {
  it('defaults to postgres, supports none, and refuses unknown kinds loudly', () => {
    expect(createTelemetrySink('postgres')).toBe(postgresSink)
    expect(createTelemetrySink('none')).toBe(noopSink)
    expect(() => createTelemetrySink('datadog')).toThrow(/Unknown TELEMETRY_SINK/)
  })
})
