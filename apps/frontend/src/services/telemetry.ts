// ------------------------------------------------------------
// services/telemetry.ts — first-party product counters
//
// The app counts a few things about itself and sends the totals to its own
// backend (POST /telemetry) — no third-party SDK, no cookie, nothing leaves
// the product. Events are PostHog-`capture`-shaped so a vendor sink can be
// added server-side later without touching any of this.
//
// Design rules:
//   - Aggregate, don't stream. `count(name, props)` folds repeats of the same
//     name+props into one event with a `count`; a session that served 300
//     cached requests becomes one row, not 300.
//   - Never in the user's way. Flushes happen on an interval, when the tab is
//     hidden, and on reconnect; a failed flush is dropped, never retried into
//     the offline queue (telemetry must not compete with set logging).
//   - Only when authenticated and online. Otherwise the buffer just waits.
// ------------------------------------------------------------

import { apiClient }    from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export type EventProps = Record<string, string | number | boolean>

interface Pending {
  name:     string
  props:    EventProps
  count:    number
  firstTs:  string
}

const FLUSH_INTERVAL_MS = 30_000
const MAX_BATCH         = 50

const buffer = new Map<string, Pending>()
let timer: ReturnType<typeof setInterval> | null = null
let flushing = false

function keyOf(name: string, props: EventProps): string {
  const entries = Object.entries(props).sort(([a], [b]) => (a < b ? -1 : 1))
  return `${name}|${JSON.stringify(entries)}`
}

/** Record one occurrence of `name` (with optional flat props). Cheap; safe anywhere. */
export function track(name: string, props: EventProps = {}): void {
  const key = keyOf(name, props)
  const existing = buffer.get(key)
  if (existing) { existing.count += 1; return }
  buffer.set(key, { name, props, count: 1, firstTs: new Date().toISOString() })
}

/** Drain the buffer into the request shape. Exported for tests. */
export function drain(): Array<{ name: string; props: EventProps; clientTs: string }> {
  const events = [...buffer.values()].slice(0, MAX_BATCH).map((p) => ({
    name:     p.name,
    props:    { ...p.props, count: p.count },
    clientTs: p.firstTs,
  }))
  buffer.clear()
  return events
}

export async function flush(): Promise<void> {
  if (flushing || buffer.size === 0) return
  if (!navigator.onLine) return
  if (!useAuthStore.getState().accessToken) return

  flushing = true
  const events = drain()
  try {
    await apiClient.post('/telemetry', { events })
  } catch {
    // Dropped on purpose: telemetry never queues, never retries, never blocks.
  } finally {
    flushing = false
  }
}

export function initTelemetry(): void {
  if (timer) return
  timer = setInterval(() => { void flush() }, FLUSH_INTERVAL_MS)
  window.addEventListener('online', () => { void flush() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })

  // Service worker → "served this from cache because the network was unavailable"
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as { type?: string; cache?: string } | undefined
      if (data?.type === 'CACHE_HIT' && typeof data.cache === 'string') {
        track('offline.cache_hit', { cache: data.cache })
      }
    })
  }
}

/** Test hook — reset module state. */
export function _resetTelemetry(): void {
  buffer.clear()
  if (timer) clearInterval(timer)
  timer = null
  flushing = false
}
