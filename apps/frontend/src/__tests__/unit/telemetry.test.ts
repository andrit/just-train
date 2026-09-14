// telemetry.test.ts
//
// First-party counters: repeats fold into one event with a count, the batch
// has the server's shape, and a flush never happens offline, unauthenticated,
// or into the offline queue — a failed send is dropped.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({ apiClient: { post } }))

const authState = vi.hoisted(() => ({ accessToken: 'tok' as string | null }))
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => authState } }))

import { track, drain, flush, _resetTelemetry } from '@/services/telemetry'

describe('telemetry', () => {
  beforeEach(() => {
    _resetTelemetry()
    post.mockReset()
    post.mockResolvedValue({ accepted: 1 })
    authState.accessToken = 'tok'
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
  })

  it('folds repeats of the same name+props into one event with a count', () => {
    track('offline.cache_hit', { cache: 'api-reference-cache' })
    track('offline.cache_hit', { cache: 'api-reference-cache' })
    track('offline.cache_hit', { cache: 'cloudinary-media' })
    track('session.completed')
    const events = drain()
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({ name: 'offline.cache_hit', props: { cache: 'api-reference-cache', count: 2 } })
    expect(events[1]).toMatchObject({ name: 'offline.cache_hit', props: { cache: 'cloudinary-media', count: 1 } })
    expect(events[2]).toMatchObject({ name: 'session.completed', props: { count: 1 } })
    expect(events[0]?.clientTs).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(drain()).toEqual([])   // drained
  })

  it('treats the same props in a different key order as the same event', () => {
    track('x.y', { a: 1, b: 'z' })
    track('x.y', { b: 'z', a: 1 })
    expect(drain()).toHaveLength(1)
  })

  it('posts the batch to /telemetry when online and authenticated', async () => {
    track('session.completed')
    await flush()
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/telemetry', { events: [expect.objectContaining({ name: 'session.completed' })] })
  })

  it('does not send when offline, unauthenticated, or empty — and keeps the buffer', async () => {
    track('session.completed')
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    await flush()
    expect(post).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    authState.accessToken = null
    await flush()
    expect(post).not.toHaveBeenCalled()

    authState.accessToken = 'tok'
    await flush()
    expect(post).toHaveBeenCalledTimes(1)   // the buffered event survived the gated attempts

    await flush()
    expect(post).toHaveBeenCalledTimes(1)   // nothing left to send
  })

  it('drops a failed send rather than retrying or throwing', async () => {
    post.mockRejectedValueOnce(new Error('500'))
    track('session.completed')
    await expect(flush()).resolves.toBeUndefined()
    await flush()
    expect(post).toHaveBeenCalledTimes(1)
  })
})
