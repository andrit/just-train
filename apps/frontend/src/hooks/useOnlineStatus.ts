// ------------------------------------------------------------
// hooks/useOnlineStatus.ts (v2.4.0)
//
// Returns current online/offline state, updating reactively.
// Uses navigator.onLine as the source of truth, listening to
// the window 'online' and 'offline' events.
//
// Note: navigator.onLine can be true while actually having no
// useful connectivity (e.g. connected to a router with no internet).
// For this app's purposes — gym WiFi dropping — it's accurate enough.
// The real test is whether API calls succeed, handled by syncService.
// ------------------------------------------------------------

import { useState, useEffect } from 'react'

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const onOnline  = (): void => setIsOnline(true)
    const onOffline = (): void => setIsOnline(false)

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return isOnline
}
