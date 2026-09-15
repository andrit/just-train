// ------------------------------------------------------------
// lib/loginLockout.test.ts — failed-sign-in counters (account plan C9)
// ------------------------------------------------------------

import { describe, it, expect } from 'vitest'
import {
  createLoginLockout, createMemoryStore,
  LOCKOUT_THRESHOLD, IP_FAILURE_CAP, LOCKOUT_WINDOW_MS,
} from '../../lib/loginLockout'

function harness(start = 1_000_000) {
  let t = start
  const clock = { now: () => t, advance: (ms: number) => { t += ms } }
  const store = createMemoryStore()
  const lock  = createLoginLockout(store, clock.now)
  return { lock, store, clock }
}

describe('per-email lockout', () => {
  it('locks on the 5th failure, not the 4th, and reports the window remainder', () => {
    const { lock, clock } = harness()
    for (let i = 1; i < LOCKOUT_THRESHOLD; i++) {
      expect(lock.recordFailure('A@x.io', '1.1.1.1').justLockedEmail).toBe(false)
      expect(lock.check('a@x.io', '1.1.1.1')).toEqual({ locked: false })
    }
    clock.advance(60_000)
    expect(lock.recordFailure('a@x.io', '1.1.1.1').justLockedEmail).toBe(true)
    expect(lock.check('a@x.io', '1.1.1.1')).toEqual({ locked: true, scope: 'email', retryAfterSeconds: (LOCKOUT_WINDOW_MS - 60_000) / 1000 })
  })

  it('only the crossing failure reports justLockedEmail (the notice fires once)', () => {
    const { lock } = harness()
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) lock.recordFailure('a@x.io', '1.1.1.1')
    expect(lock.recordFailure('a@x.io', '1.1.1.1').justLockedEmail).toBe(false)
  })

  it('locks an unknown email exactly like a known one (the caller decides nothing by existence)', () => {
    const { lock } = harness()
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) lock.recordFailure('nobody@x.io', '1.1.1.1')
    expect(lock.check('nobody@x.io', '1.1.1.1').locked).toBe(true)
  })

  it('a success clears the email counter', () => {
    const { lock } = harness()
    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i++) lock.recordFailure('a@x.io', '1.1.1.1')
    lock.recordSuccess('A@X.IO')
    expect(lock.recordFailure('a@x.io', '1.1.1.1').emailFailures).toBe(1)
  })

  it('the lock lifts when the window ends and the count restarts', () => {
    const { lock, clock } = harness()
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) lock.recordFailure('a@x.io', '1.1.1.1')
    clock.advance(LOCKOUT_WINDOW_MS)
    expect(lock.check('a@x.io', '1.1.1.1')).toEqual({ locked: false })
    expect(lock.recordFailure('a@x.io', '1.1.1.1').emailFailures).toBe(1)
  })

  it('the window is fixed from the first failure, not sliding', () => {
    const { lock, clock } = harness()
    lock.recordFailure('a@x.io', '1.1.1.1')
    clock.advance(LOCKOUT_WINDOW_MS - 1_000)
    for (let i = 0; i < LOCKOUT_THRESHOLD - 1; i++) lock.recordFailure('a@x.io', '1.1.1.1')
    expect(lock.check('a@x.io', '1.1.1.1')).toEqual({ locked: true, scope: 'email', retryAfterSeconds: 1 })
    clock.advance(1_000)
    expect(lock.check('a@x.io', '1.1.1.1').locked).toBe(false)
  })

  it('stores hashed keys — never the address', () => {
    const { lock, store } = harness()
    lock.recordFailure('secret@x.io', '1.1.1.1')
    expect(store.get('email:secret@x.io')).toBeUndefined()
    expect(store.size()).toBe(2)
  })
})

describe('per-IP cap', () => {
  it('refuses the IP after 20 failures across different emails, and wins over the email check', () => {
    const { lock } = harness()
    for (let i = 0; i < IP_FAILURE_CAP; i++) lock.recordFailure(`u${i}@x.io`, '9.9.9.9')
    const state = lock.check('fresh@x.io', '9.9.9.9')
    expect(state.locked && state.scope).toBe('ip')
    expect(lock.check('fresh@x.io', '8.8.8.8')).toEqual({ locked: false })
  })

  it('a success does not clear the IP counter (stuffing runs also guess right sometimes)', () => {
    const { lock } = harness()
    for (let i = 0; i < IP_FAILURE_CAP - 1; i++) lock.recordFailure(`u${i}@x.io`, '9.9.9.9')
    lock.recordSuccess('u0@x.io')
    expect(lock.recordFailure('z@x.io', '9.9.9.9').ipFailures).toBe(IP_FAILURE_CAP)
  })
})

describe('reset', () => {
  it('drops every key the instance wrote', () => {
    const { lock, store } = harness()
    lock.recordFailure('a@x.io', '1.1.1.1')
    lock.reset()
    expect(store.size()).toBe(0)
    expect(lock.check('a@x.io', '1.1.1.1')).toEqual({ locked: false })
  })
})
