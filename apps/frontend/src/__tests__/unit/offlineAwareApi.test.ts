// ------------------------------------------------------------
// offlineAwareApi.test.ts — the idempotency key is generated once per
// logical op and rides both the online attempt and any queued replay.
// ------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted above the file, so the fns it references must come from
// vi.hoisted (also hoisted) — a plain top-level const would be in the TDZ.
const { apiClient, enqueue } = vi.hoisted(() => ({
  apiClient: vi.fn(),
  enqueue:   vi.fn(),
}))
vi.mock('@/lib/api', () => ({ apiClient }))
vi.mock('@/services/offlineQueue', () => ({ offlineQueue: { enqueue } }))

import { offlineAwareApi } from '@/lib/offlineAwareApi'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

describe('offlineAwareApi — idempotency key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setOnline(true)
  })

  it('online POST attaches an Idempotency-Key header and does not queue', async () => {
    apiClient.mockResolvedValueOnce({ id: 's-1' })
    await offlineAwareApi.post('/session-exercises/a/sets', { reps: 5 }, 'Log set')

    expect(apiClient).toHaveBeenCalledTimes(1)
    const [path, init] = apiClient.mock.calls[0]
    expect(path).toBe('/session-exercises/a/sets')
    expect(init.method).toBe('POST')
    expect(init.headers['Idempotency-Key']).toMatch(UUID)
    expect(init.body).toBe(JSON.stringify({ reps: 5 }))
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('offline POST queues the op with an idempotencyKey', async () => {
    setOnline(false)
    await offlineAwareApi.post('/session-exercises/a/sets', { reps: 5 }, 'Log set')

    expect(apiClient).not.toHaveBeenCalled()
    expect(enqueue).toHaveBeenCalledTimes(1)
    const op = enqueue.mock.calls[0][0]
    expect(op.idempotencyKey).toMatch(UUID)
    expect(op.method).toBe('POST')
    expect(op.path).toBe('/session-exercises/a/sets')
  })

  it('online network error queues with the SAME key that was attempted', async () => {
    apiClient.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await offlineAwareApi.post('/session-exercises/a/sets', { reps: 5 }, 'Log set')

    const attemptedKey = apiClient.mock.calls[0][1].headers['Idempotency-Key']
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue.mock.calls[0][0].idempotencyKey).toBe(attemptedKey)
  })

  it('a real API error is rethrown, not queued', async () => {
    apiClient.mockRejectedValueOnce(new Error('400 Bad Request'))
    await expect(offlineAwareApi.post('/x', {}, 'x')).rejects.toThrow('400')
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('DELETE carries a key and no body on the online attempt', async () => {
    apiClient.mockResolvedValueOnce(null)
    await offlineAwareApi.delete('/sets/a', 'Delete set')
    const [, init] = apiClient.mock.calls[0]
    expect(init.method).toBe('DELETE')
    expect(init.headers['Idempotency-Key']).toMatch(UUID)
    expect(init.body).toBeUndefined()
  })
})
