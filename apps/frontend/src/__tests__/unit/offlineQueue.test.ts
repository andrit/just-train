import { describe, it, expect, beforeEach } from 'vitest'
import { offlineQueue } from '@/services/offlineQueue'

// localStorage is cleared in setup.ts afterEach, so each test starts with an empty queue.

const baseOp = {
  method:      'POST' as const,
  path:        '/sessions',
  body:        { clientId: 'c-1' },
  description: 'Start session — Test Client',
}

describe('offlineQueue', () => {
  beforeEach(() => {
    offlineQueue.clear()
  })

  describe('enqueue', () => {
    it('returns a QueuedOperation with generated id, enqueuedAt, and retries:0', () => {
      const op = offlineQueue.enqueue(baseOp)
      expect(op.id).toMatch(/^op-\d+-[a-z0-9]+$/)
      expect(op.enqueuedAt).toBeGreaterThan(0)
      expect(op.retries).toBe(0)
      expect(op.method).toBe('POST')
      expect(op.path).toBe('/sessions')
    })

    it('persists operations across reads', () => {
      offlineQueue.enqueue(baseOp)
      expect(offlineQueue.size()).toBe(1)
      expect(offlineQueue.getAll()[0]?.path).toBe('/sessions')
    })

    it('preserves insertion order across multiple enqueues', () => {
      offlineQueue.enqueue({ ...baseOp, path: '/sessions/1', description: 'first' })
      offlineQueue.enqueue({ ...baseOp, path: '/sessions/2', description: 'second' })
      offlineQueue.enqueue({ ...baseOp, path: '/sessions/3', description: 'third' })

      const ops = offlineQueue.getAll()
      expect(ops[0]?.path).toBe('/sessions/1')
      expect(ops[1]?.path).toBe('/sessions/2')
      expect(ops[2]?.path).toBe('/sessions/3')
    })
  })

  describe('getAll', () => {
    it('returns empty array when queue is empty', () => {
      expect(offlineQueue.getAll()).toEqual([])
    })

    it('returns all enqueued operations', () => {
      offlineQueue.enqueue({ ...baseOp, path: '/a' })
      offlineQueue.enqueue({ ...baseOp, path: '/b' })
      expect(offlineQueue.getAll()).toHaveLength(2)
    })
  })

  describe('remove', () => {
    it('removes the operation with the matching id', () => {
      const op1 = offlineQueue.enqueue({ ...baseOp, path: '/keep' })
      const op2 = offlineQueue.enqueue({ ...baseOp, path: '/remove' })
      offlineQueue.remove(op2.id)

      const remaining = offlineQueue.getAll()
      expect(remaining).toHaveLength(1)
      expect(remaining[0]?.id).toBe(op1.id)
    })

    it('is a no-op when id does not exist', () => {
      offlineQueue.enqueue(baseOp)
      offlineQueue.remove('nonexistent-id')
      expect(offlineQueue.size()).toBe(1)
    })
  })

  describe('clear', () => {
    it('empties the queue', () => {
      offlineQueue.enqueue(baseOp)
      offlineQueue.enqueue(baseOp)
      offlineQueue.clear()
      expect(offlineQueue.size()).toBe(0)
      expect(offlineQueue.getAll()).toEqual([])
    })
  })

  describe('size', () => {
    it('returns 0 for an empty queue', () => {
      expect(offlineQueue.size()).toBe(0)
    })

    it('returns the number of enqueued operations', () => {
      offlineQueue.enqueue(baseOp)
      offlineQueue.enqueue(baseOp)
      expect(offlineQueue.size()).toBe(2)
    })
  })

  describe('incrementRetry', () => {
    it('increments the retry count on the matching operation', () => {
      const op = offlineQueue.enqueue(baseOp)
      offlineQueue.incrementRetry(op.id)
      expect(offlineQueue.getAll()[0]?.retries).toBe(1)
    })

    it('drops the operation after MAX_RETRIES (5) failures', () => {
      const op = offlineQueue.enqueue(baseOp)
      for (let i = 0; i < 6; i++) {
        offlineQueue.incrementRetry(op.id)
      }
      expect(offlineQueue.size()).toBe(0)
    })

    it('keeps the operation at exactly MAX_RETRIES (5)', () => {
      const op = offlineQueue.enqueue(baseOp)
      for (let i = 0; i < 5; i++) {
        offlineQueue.incrementRetry(op.id)
      }
      expect(offlineQueue.size()).toBe(1)
      expect(offlineQueue.getAll()[0]?.retries).toBe(5)
    })
  })
})
