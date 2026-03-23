// ------------------------------------------------------------
// services/offlineQueue.ts (v2.4.0)
//
// Persistent write queue for offline-first operation.
//
// INTERFACE — intentionally storage-agnostic:
//   queue.enqueue(op)   → add a pending write
//   queue.getAll()      → read all pending writes in order
//   queue.remove(id)    → remove a successfully synced write
//   queue.clear()       → remove all (after full sync)
//   queue.size()        → count of pending writes
//
// CURRENT IMPLEMENTATION: localStorage
//   Serialised as a JSON array under STORAGE_KEY.
//   Zustand persist handles this for sessionStore already —
//   this queue is intentionally separate so it can be swapped
//   independently.
//
// UPGRADING TO IndexedDB (v3.x):
//   1. Create services/offlineQueueIDB.ts implementing the same
//      OfflineQueue interface using idb or idb-keyval
//   2. Replace the `export const offlineQueue = new LocalStorageQueue()`
//      line at the bottom with the IDB implementation
//   3. Done — syncService.ts and all callers are unchanged
//
// WHAT GETS QUEUED:
//   Any mutating API call that happens while offline.
//   Currently: set logging, session start/end, exercise additions.
//   Read requests are handled by Workbox cache — not queued here.
//
// OPERATION FORMAT:
//   method   — HTTP method (POST, PATCH, DELETE)
//   path     — API path e.g. '/sessions/abc/workouts/def/exercises'
//   body     — request body (already serialisable)
//   id       — unique ID for deduplication and removal
//   enqueuedAt — timestamp for ordering and debugging
// ------------------------------------------------------------

export interface QueuedOperation {
  id:          string
  method:      'POST' | 'PATCH' | 'DELETE'
  path:        string
  body?:       unknown
  enqueuedAt:  number   // Date.now()
  retries:     number   // incremented on failed flush attempts
  description: string   // human-readable, for debug/UI e.g. "Log set — Squat"
}

// ── Interface — implement this to swap storage backends ──────────────────────

export interface OfflineQueue {
  enqueue(op: Omit<QueuedOperation, 'id' | 'enqueuedAt' | 'retries'>): QueuedOperation
  getAll(): QueuedOperation[]
  remove(id: string): void
  clear(): void
  size(): number
}

// ── localStorage implementation ───────────────────────────────────────────────

const STORAGE_KEY = 'trainer-app-offline-queue'
const MAX_RETRIES = 5   // drop an op after this many failed attempts

class LocalStorageQueue implements OfflineQueue {

  private read(): QueuedOperation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as QueuedOperation[]
    } catch {
      return []
    }
  }

  private write(ops: QueuedOperation[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ops))
    } catch (e) {
      // localStorage full — shouldn't happen with set data volumes
      console.error('[offlineQueue] localStorage write failed:', e)
    }
  }

  enqueue(op: Omit<QueuedOperation, 'id' | 'enqueuedAt' | 'retries'>): QueuedOperation {
    const full: QueuedOperation = {
      ...op,
      id:         `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      enqueuedAt: Date.now(),
      retries:    0,
    }
    const ops = this.read()
    ops.push(full)
    this.write(ops)

    if (import.meta.env.DEV) {
      console.debug(`[offlineQueue] enqueued: ${op.description}`, op)
    }

    return full
  }

  getAll(): QueuedOperation[] {
    return this.read()
  }

  remove(id: string): void {
    const ops = this.read().filter(op => op.id !== id)
    this.write(ops)
  }

  /** Increment retry count. Drops the op if MAX_RETRIES exceeded. */
  incrementRetry(id: string): void {
    const ops = this.read().map(op => {
      if (op.id !== id) return op
      return { ...op, retries: op.retries + 1 }
    }).filter(op => op.retries <= MAX_RETRIES)
    this.write(ops)
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }

  size(): number {
    return this.read().length
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────
// UPGRADE PATH: swap this line for IndexedDB implementation in v3.x
// export const offlineQueue = new IndexedDBQueue()

export const offlineQueue = new LocalStorageQueue()
