// ------------------------------------------------------------
// lib/loginLockout.ts — failed-sign-in counters (account plan C9)
//
// Two independent controls, one fixed 15-minute window each:
//   • per email  — 5 consecutive failures → locked until the window ends.
//     Counted for UNKNOWN emails too, so the lock cannot be used to learn
//     whether an account exists. A correct sign-in clears the counter.
//   • per IP     — 20 failures → the IP is refused for the rest of the
//     window (credential stuffing: many accounts, few guesses each).
//
// Fixed window rather than exponential back-off: it is explainable in the
// UI ("try again in 12 minutes") and 5 × 15 min already makes online
// guessing hopeless (≈480 guesses/day).
//
// The store is an interface. `createMemoryStore()` is what runs today.
// ponytail: in-process Map, same durability as the global rate limiter
// (@fastify/rate-limit's default store) — counters reset on deploy and are
// per replica. ceiling: a second Railway replica. upgrade: a Redis store
// (needs ioredis as a direct dependency — removed on purpose, see
// queues/connection.ts) or a small Postgres table; the interface is the seam.
// ------------------------------------------------------------

import { createHash } from 'node:crypto'

export const LOCKOUT_THRESHOLD  = 5                  // failures per email
export const IP_FAILURE_CAP     = 20                 // failures per IP
export const LOCKOUT_WINDOW_MS  = 15 * 60 * 1000     // one window for both

export interface FailureEntry {
  count:   number
  /** Window end — also the lock expiry once the threshold is reached. */
  resetAt: number
}

export interface FailureStore {
  get(key: string): FailureEntry | undefined
  set(key: string, entry: FailureEntry): void
  delete(key: string): void
}

export function createMemoryStore(): FailureStore & { size(): number } {
  const map = new Map<string, FailureEntry>()
  return {
    get:    (k) => map.get(k),
    set:    (k, e) => { map.set(k, e) },
    delete: (k) => { map.delete(k) },
    size:   () => map.size,
  }
}

export type LockScope = 'email' | 'ip'

export type LockState =
  | { locked: false }
  | { locked: true; scope: LockScope; retryAfterSeconds: number }

export interface FailureOutcome extends Record<string, unknown> {
  /** True on the exact failure that crossed the email threshold — the notice-email trigger. */
  justLockedEmail: boolean
  emailFailures:   number
  ipFailures:      number
}

export interface LoginLockout {
  /** Call BEFORE looking the account up, so unknown emails behave identically. */
  check(email: string, ip: string): LockState
  recordFailure(email: string, ip: string): FailureOutcome
  recordSuccess(email: string): void
  /** Test / ops hook. */
  reset(): void
}

function emailKey(email: string): string {
  // No PII in keys — the store may one day be a shared Redis.
  return 'email:' + createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}
function ipKey(ip: string): string { return 'ip:' + ip }

function secondsUntil(ts: number, now: number): number {
  return Math.max(1, Math.ceil((ts - now) / 1000))
}

export function createLoginLockout(
  store: FailureStore = createMemoryStore(),
  now: () => number = () => Date.now(),
): LoginLockout {
  /** Live entry or nothing — expired windows are dropped on read. */
  const live = (key: string): FailureEntry | undefined => {
    const e = store.get(key)
    if (!e) return undefined
    if (e.resetAt <= now()) { store.delete(key); return undefined }
    return e
  }

  const bump = (key: string): FailureEntry => {
    const t = now()
    const e = live(key) ?? { count: 0, resetAt: t + LOCKOUT_WINDOW_MS }
    const next = { count: e.count + 1, resetAt: e.resetAt }
    store.set(key, next)
    return next
  }

  let keys = new Set<string>()   // for reset(); the store itself has no scan

  return {
    check(email, ip) {
      const t  = now()
      const ie = live(ipKey(ip))
      if (ie && ie.count >= IP_FAILURE_CAP) return { locked: true, scope: 'ip', retryAfterSeconds: secondsUntil(ie.resetAt, t) }
      const ee = live(emailKey(email))
      if (ee && ee.count >= LOCKOUT_THRESHOLD) return { locked: true, scope: 'email', retryAfterSeconds: secondsUntil(ee.resetAt, t) }
      return { locked: false }
    },

    recordFailure(email, ip) {
      const ek = emailKey(email); const ik = ipKey(ip)
      keys.add(ek); keys.add(ik)
      const e = bump(ek)
      const i = bump(ik)
      return { justLockedEmail: e.count === LOCKOUT_THRESHOLD, emailFailures: e.count, ipFailures: i.count }
    },

    recordSuccess(email) {
      store.delete(emailKey(email))
    },

    reset() {
      for (const k of keys) store.delete(k)
      keys = new Set()
    },
  }
}
