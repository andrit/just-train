// ------------------------------------------------------------
// hooks/useUXEvent.ts — React hook for the UX event system (v1.4.4)
//
// The primary interface for firing UX events from components.
// Returns a stable `fire` callback safe to use in dependency arrays.
//
// USAGE:
//   const { fire } = useUXEvent()
//
//   // With a DOM ref (triggers animation on the element):
//   const ref = useRef<HTMLButtonElement>(null)
//   <button ref={ref} onClick={() => fire('create', { target: ref.current, entity: 'client' })}>
//     Add Client
//   </button>
//
//   // Without a ref (side effects only, no animation):
//   fire('page_enter')
//
//   // With guidance evaluation:
//   const { fire, pendingGuidance, dismissGuidance } = useUXEvent({ context: { clientCount } })
//   {pendingGuidance && <GuidanceNudge rule={pendingGuidance} onDismiss={dismissGuidance} />}
//
// NOTES:
//   - fire() is synchronous — animation plays immediately, side effects are async
//   - fire() never throws — errors in side effects are caught internally
//   - The returned fire function is stable (useCallback with empty deps)
//   - context is optional — pass it to enable contextual guidance evaluation
// ------------------------------------------------------------

import { useCallback, useState, useRef }  from 'react'
import {
  fireUXEvent,
  evaluateGuidance,
  type UXEventType,
  type UXEventPayload,
  type GuidanceRule,
} from '@/lib/ux-events'

// ── Hook options ──────────────────────────────────────────────────────────────

interface UseUXEventOptions {
  /**
   * Contextual data used to evaluate guidance rules.
   * Pass any relevant counts or state your component has.
   * e.g. { clientCount: 5, progressionState: 'assessment' }
   */
  context?: Record<string, unknown>
}

// ── Hook return type ──────────────────────────────────────────────────────────

interface UseUXEventResult {
  /**
   * Fire a UX event. Plays the mapped animation on `payload.target` (if provided)
   * and dispatches all registered side effects asynchronously.
   *
   * @param eventType - The semantic event classification
   * @param payload   - Optional: target element, entity info, metadata
   */
  fire: (eventType: UXEventType, payload?: UXEventPayload) => void

  /**
   * The most recently triggered guidance rule, if any.
   * null when no guidance is pending.
   * Phase 4.5+: render a GuidanceNudge component when this is non-null.
   */
  pendingGuidance: GuidanceRule | null

  /**
   * Dismiss the current pending guidance.
   */
  dismissGuidance: () => void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useUXEvent(options: UseUXEventOptions = {}): UseUXEventResult {
  const contextRef = useRef(options.context)
  // Keep context ref current without causing re-renders
  contextRef.current = options.context

  const [pendingGuidance, setPendingGuidance] = useState<GuidanceRule | null>(null)

  const fire = useCallback((eventType: UXEventType, payload: UXEventPayload = {}): void => {
    // 1. Play animation + dispatch side effects
    fireUXEvent(eventType, payload)

    // 2. Evaluate contextual guidance rules
    const rule = evaluateGuidance(eventType, payload, contextRef.current)
    if (rule) {
      setPendingGuidance(rule)

      // Auto-dismiss after duration if set
      if (rule.duration !== null) {
        setTimeout(() => {
          setPendingGuidance((current) => current === rule ? null : current)
        }, rule.duration)
      }
    }
  }, []) // stable — never changes

  const dismissGuidance = useCallback((): void => {
    setPendingGuidance(null)
  }, [])

  return { fire, pendingGuidance, dismissGuidance }
}

// ── useUXEventRef helper ──────────────────────────────────────────────────────
// Convenience wrapper that creates a ref and returns a pre-bound fire function
// that automatically uses that ref as the target.
//
// USAGE:
//   const [ref, fireOn] = useUXEventRef<HTMLButtonElement>()
//   <button ref={ref} onClick={() => fireOn('create', { entity: 'client' })}>
//
// Equivalent to manually creating useRef + useUXEvent, but less boilerplate.

export function useUXEventRef<T extends HTMLElement>(): [
  React.RefObject<T>,
  (eventType: UXEventType, payload?: Omit<UXEventPayload, 'target'>) => void,
] {
  const ref = useRef<T>(null)
  const { fire } = useUXEvent()

  const fireOn = useCallback((
    eventType: UXEventType,
    payload:   Omit<UXEventPayload, 'target'> = {},
  ): void => {
    fire(eventType, { ...payload, target: ref.current ?? undefined })
  }, [fire])

  return [ref, fireOn]
}
