// ------------------------------------------------------------
// routes/telemetry.test.ts — POST /telemetry accepts batches of first-party
// product events for the authenticated trainer and hands them to the sink.
// ------------------------------------------------------------

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildTelemetryTestApp } from '../helpers/buildApp'
import { TEST_TRAINER_ID } from '../helpers/factories'
import { generateAccessToken } from '../../services/auth.service'
import type { TelemetrySink } from '../../lib/telemetry/sink'

vi.mock('../../db', () => ({ db: {}, clientEvents: {} }))

vi.mock('../../services/auth.service', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../services/auth.service')>()
  return { ...real }
})

function authHeader(trainerId = TEST_TRAINER_ID): Record<string, string> {
  return { authorization: `Bearer ${generateAccessToken(trainerId, 'trainer')}` }
}

const url = '/api/v1/telemetry'
const good = { events: [
  { name: 'offline.cache_hit', props: { count: 12, cache: 'api-reference-cache' }, clientTs: '2026-09-14T10:00:00.000Z' },
  { name: 'session.completed', clientTs: '2026-09-14T10:05:00.000Z' },
] }

describe('POST /telemetry', () => {
  const sink: TelemetrySink = { record: vi.fn(async (_t, events) => events.length) }
  let app: Awaited<ReturnType<typeof buildTelemetryTestApp>>
  beforeAll(async () => { app = await buildTelemetryTestApp({ sink }) })
  afterAll(async ()  => { await app.close() })
  beforeEach(()      => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'POST', url, payload: good })
    expect(res.statusCode).toBe(401)
    expect(sink.record).not.toHaveBeenCalled()
  })

  it('accepts a batch for the authenticated trainer and returns 202 with the count', async () => {
    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload: good })
    expect(res.statusCode).toBe(202)
    expect(res.json()).toEqual({ accepted: 2 })
    expect(sink.record).toHaveBeenCalledWith(TEST_TRAINER_ID, good.events)
  })

  it('rejects an event name that is not lower-case dotted', async () => {
    const res = await app.inject({ method: 'POST', url, headers: authHeader(),
      payload: { events: [{ name: 'Session Completed!', clientTs: '2026-09-14T10:00:00.000Z' }] } })
    expect(res.statusCode).toBe(400)
    expect(sink.record).not.toHaveBeenCalled()
  })

  it('rejects nested / non-scalar props (no structured PII by construction)', async () => {
    const res = await app.inject({ method: 'POST', url, headers: authHeader(),
      payload: { events: [{ name: 'x.y', props: { nested: { a: 1 } }, clientTs: '2026-09-14T10:00:00.000Z' }] } })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an empty batch and a batch over 50', async () => {
    const empty = await app.inject({ method: 'POST', url, headers: authHeader(), payload: { events: [] } })
    expect(empty.statusCode).toBe(400)
    const big = await app.inject({ method: 'POST', url, headers: authHeader(),
      payload: { events: Array.from({ length: 51 }, () => ({ name: 'a.b', clientTs: '2026-09-14T10:00:00.000Z' })) } })
    expect(big.statusCode).toBe(400)
  })

  it('returns 500 when the sink fails (the client treats it as fire-and-forget)', async () => {
    vi.mocked(sink.record).mockRejectedValueOnce(new Error('db down'))
    const res = await app.inject({ method: 'POST', url, headers: authHeader(), payload: good })
    expect(res.statusCode).toBe(500)
  })
})
