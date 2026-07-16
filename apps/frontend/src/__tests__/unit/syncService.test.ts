// ------------------------------------------------------------
// syncService.test.ts — flushQueue replays queued ops carrying their
// idempotency key as a header, and tolerates legacy ops that lack one.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted above the file, so the fns it references must come from
// vi.hoisted (also hoisted) — a plain top-level const would be in the TDZ.
const { apiClient, getAll, remove, size, incrementRetry } = vi.hoisted(() => ({
  apiClient:      vi.fn(),
  getAll:         vi.fn(),
  remove:         vi.fn(),
  size:           vi.fn(() => 0),
  incrementRetry: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ apiClient }))
vi.mock('@/services/offlineQueue', () => ({
  offlineQueue: { getAll, remove, size, incrementRetry },
}))

import { syncService } from '@/services/syncService'

function op(over: Record<string, unknown> = {}) {
  return {
    id: 'op-1', method: 'POST', path: '/session-exercises/a/sets',
    body: { reps: 5 }, description: 'Log set', enqueuedAt: 1, retries: 0,
    ...over,
  }
}

describe('syncService.flush — idempotency header', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    size.mockReturnValue(0)
  })

  it('sends the op idempotencyKey as an Idempotency-Key header', async () => {
    getAll.mockReturnValue([op({ idempotencyKey: 'key-123' })])
    apiClient.mockResolvedValue({})

    await syncService.flush()

    expect(apiClient).toHaveBeenCalledTimes(1)
    const [path, init] = apiClient.mock.calls[0]
    expect(path).toBe('/session-exercises/a/sets')
    expect(init.headers['Idempotency-Key']).toBe('key-123')
    expect(remove).toHaveBeenCalledWith('op-1')
  })

  it('tolerates a legacy op with no idempotencyKey — no header, no crash', async () => {
    getAll.mockReturnValue([op({ id: 'op-2' })])   // no idempotencyKey
    apiClient.mockResolvedValue({})

    await syncService.flush()

    const [, init] = apiClient.mock.calls[0]
    expect(init.headers).toBeUndefined()
    expect(remove).toHaveBeenCalledWith('op-2')
  })
})
