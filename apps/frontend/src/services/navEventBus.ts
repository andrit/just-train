// ------------------------------------------------------------
// services/navEventBus.ts (v2.3.0-lite)
//
// Internal event bus for the navigation service.
//
// DESIGN — intentionally mirrors the RxJS Subject API:
//   bus.next(event)           → emit an event
//   bus.subscribe(fn)         → add a listener, returns unsubscribe fn
//   bus.getValue()            → current log snapshot
//
// When v2.3.0 (full RxJS) lands, this file is replaced with:
//   import { Subject } from 'rxjs'
//   export const navBus = new Subject<NavEvent>()
//   export const navLog$ = navBus.pipe(scan((acc, e) => [...acc, e], []))
//
// Everything that calls navEventBus.next() / .subscribe() keeps
// working with zero changes. That's the whole point.
//
// CURRENT IMPLEMENTATION:
//   - In-memory array (the audit log)
//   - Set of subscriber callbacks
//   - Debounce per event type (configurable)
//   - No external dependencies
// ------------------------------------------------------------

export type NavAction =
  | 'openClientProfile'
  | 'openSessionSummary'
  | 'openSessionHistory'
  | 'openSessionLauncher'
  | 'openSessionPlan'
  | 'closePanel'
  | 'goToTab'

export interface NavEvent {
  action:    NavAction
  payload?:  Record<string, string | undefined>
  timestamp: number           // Date.now()
  id:        string           // unique per emission, useful for dedup
}

type Subscriber = (event: NavEvent) => void

// ── Debounce config (ms) per action ──────────────────────────────────────────
// Prevents double-tap race conditions.
// Set to 0 to disable for an action.

const DEBOUNCE_MS: Partial<Record<NavAction, number>> = {
  openClientProfile:  300,
  openSessionHistory: 300,
  openSessionPlan:    300,
  openSessionLauncher:300,
  closePanel:         150,
  goToTab:            200,
}

const MAX_LOG_SIZE = 200  // cap memory usage

// ── Bus implementation ────────────────────────────────────────────────────────

class NavEventBusImpl {
  private log:         NavEvent[]   = []
  private subscribers: Set<Subscriber> = new Set()
  private lastEmitAt:  Partial<Record<NavAction, number>> = {}

  /** Emit a navigation event. Debounced per action type. */
  next(action: NavAction, payload?: NavEvent['payload']): void {
    const debounce = DEBOUNCE_MS[action] ?? 0
    const now      = Date.now()
    const last     = this.lastEmitAt[action] ?? 0

    if (debounce > 0 && now - last < debounce) {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[nav] debounced: ${action} (${now - last}ms since last)`)
      }
      return
    }

    this.lastEmitAt[action] = now

    const event: NavEvent = {
      action,
      payload,
      timestamp: now,
      id:        `${action}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    }

    // Append to audit log, cap size
    this.log.push(event)
    if (this.log.length > MAX_LOG_SIZE) {
      this.log = this.log.slice(-MAX_LOG_SIZE)
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug(`[nav] ${action}`, payload ?? '')
    }

    // Notify subscribers
    this.subscribers.forEach(fn => fn(event))
  }

  /**
   * Subscribe to navigation events.
   * Returns an unsubscribe function — mirrors RxJS Subscription.unsubscribe().
   *
   * FUTURE RxJS equivalent:
   *   const sub = navBus.subscribe(fn)
   *   return () => sub.unsubscribe()
   */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn)
    return () => this.subscribers.delete(fn)
  }

  /**
   * Current audit log snapshot.
   * FUTURE RxJS equivalent: use navLog$ observable + toArray() or scan().
   */
  getValue(): readonly NavEvent[] {
    return this.log
  }

  /** Most recent event of a given action type. */
  getLastOf(action: NavAction): NavEvent | undefined {
    return [...this.log].reverse().find(e => e.action === action)
  }

  /** Clear the log — useful in tests. */
  clearLog(): void {
    this.log = []
  }
}

// Singleton — one bus for the whole app.
// FUTURE: export const navBus = new Subject<NavEvent>()
export const navEventBus = new NavEventBusImpl()
