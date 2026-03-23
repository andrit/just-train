// ------------------------------------------------------------
// hooks/useNavLog.ts (v2.3.0-lite)
//
// Hook to observe and inspect navigation events.
//
// In development: navigation events are logged to the console
// automatically by navEventBus. This hook lets components
// subscribe to events and read the audit log.
//
// USAGE:
//   // Read the full log (e.g. in a debug panel)
//   const { log } = useNavLog()
//
//   // React to specific events
//   useNavLog((event) => {
//     if (event.action === 'openClientProfile') {
//       analytics.track('client_profile_opened', { id: event.payload?.entityId })
//     }
//   })
//
// FUTURE RxJS equivalent:
//   const events$ = navBus.pipe(filter(e => e.action === 'openClientProfile'))
//   events$.subscribe(...)
// ------------------------------------------------------------

import { useEffect, useState } from 'react'
import { navEventBus }         from '@/services/navEventBus'
import type { NavEvent }       from '@/services/navEventBus'

/**
 * Subscribe to navigation events and/or read the audit log.
 * The subscriber (if provided) is called on every new event.
 * Re-renders the component when new events arrive only if
 * no subscriber is provided (log-only mode).
 */
export function useNavLog(subscriber?: (event: NavEvent) => void): {
  log: readonly NavEvent[]
} {
  const [log, setLog] = useState<readonly NavEvent[]>(() => navEventBus.getValue())

  useEffect(() => {
    const unsubscribe = navEventBus.subscribe((event) => {
      subscriber?.(event)
      // Only trigger re-render if no subscriber (log viewer mode)
      if (!subscriber) {
        setLog(navEventBus.getValue())
      }
    })
    return unsubscribe
  }, [subscriber])

  return { log }
}
