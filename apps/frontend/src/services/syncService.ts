// ------------------------------------------------------------
// services/syncService.ts (v2.4.0)
//
// Two responsibilities:
//
// 1. WRITE SYNC — flushes the offline queue when connectivity returns.
//    Listens to window 'online' event. Replays queued operations
//    in order against the API. On success, removes from queue.
//    On failure, increments retry count (drops after MAX_RETRIES).
//
// 2. READ PREFETCH — warms the Workbox cache on app load so the
//    trainer has everything they need if WiFi drops mid-session.
//    Prefetches: client list, today's planned sessions + their
//    full detail, and the exercise library.
//    Fire-and-forget — failures are silent (cache warming is
//    best-effort, not required for the app to function).
//
// INITIALISATION:
//   Call syncService.init() once in main.tsx or App.tsx.
//   It registers event listeners and runs the initial prefetch.
//
// QUERY CACHE INVALIDATION:
//   After a successful flush, we can't call TanStack Query's
//   invalidateQueries directly (we're outside React).
//   Instead we dispatch a custom DOM event that the
//   SyncStatusProvider listens to and triggers invalidation.
// ------------------------------------------------------------

import { offlineQueue }  from './offlineQueue'
import { apiClient }     from '@/lib/api'

export const SYNC_COMPLETE_EVENT = 'trainer-app:sync-complete'
export const SYNC_STATUS_EVENT   = 'trainer-app:sync-status'

export type SyncStatus = 'idle' | 'syncing' | 'error'

// ── Internal state ────────────────────────────────────────────────────────────

let isSyncing     = false
let isInitialised = false

function emitStatus(status: SyncStatus, pending: number): void {
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, {
    detail: { status, pending },
  }))
}

// ── Flush queue ───────────────────────────────────────────────────────────────

async function flushQueue(): Promise<void> {
  const ops = offlineQueue.getAll()
  if (ops.length === 0) return
  if (isSyncing) return

  isSyncing = true
  emitStatus('syncing', ops.length)

  if (import.meta.env.DEV) {
    console.debug(`[syncService] flushing ${ops.length} queued operations`)
  }

  let allSucceeded = true

  for (const op of ops) {
    try {
      await apiClient(op.path, {
        method: op.method,
        ...(op.body ? { body: JSON.stringify(op.body) } : {}),
      })
      offlineQueue.remove(op.id)

      if (import.meta.env.DEV) {
        console.debug(`[syncService] synced: ${op.description}`)
      }
    } catch (err) {
      allSucceeded = false
      offlineQueue.incrementRetry(op.id)

      if (import.meta.env.DEV) {
        console.warn(`[syncService] failed: ${op.description}`, err)
      }
    }
  }

  isSyncing = false
  const remaining = offlineQueue.size()
  emitStatus(remaining > 0 ? 'error' : 'idle', remaining)

  if (allSucceeded) {
    // Signal React to invalidate affected queries
    window.dispatchEvent(new CustomEvent(SYNC_COMPLETE_EVENT))
  }
}

// ── Prefetch — cache warm on load ─────────────────────────────────────────────

async function prefetch(): Promise<void> {
  if (!navigator.onLine) return

  const today = new Date().toISOString().split('T')[0]!

  const targets = [
    '/clients',
    '/exercises',
    `/sessions?status=planned`,
    `/sessions?status=in_progress`,
    `/sessions?date=${today}`,
  ]

  // Fire all prefetch requests in parallel, silently
  await Promise.allSettled(
    targets.map(path =>
      apiClient(path).catch(() => {
        // Swallow errors — prefetch is best-effort
      })
    )
  )

  if (import.meta.env.DEV) {
    console.debug('[syncService] prefetch complete')
  }
}

// ── Initialise ────────────────────────────────────────────────────────────────

function init(): void {
  if (isInitialised) return
  isInitialised = true

  // Flush on reconnect
  window.addEventListener('online', () => {
    if (import.meta.env.DEV) {
      console.debug('[syncService] online — flushing queue')
    }
    flushQueue()
  })

  // Prefetch on load (after a short delay so the app renders first)
  setTimeout(() => {
    prefetch()
    // Also flush any writes that were queued before the last close
    if (navigator.onLine) flushQueue()
  }, 2000)
}

// ── Public API ────────────────────────────────────────────────────────────────

export const syncService = {
  init,
  flush:          flushQueue,
  prefetch,
  getPending:     () => offlineQueue.size(),
  isOnline:       () => navigator.onLine,
}
