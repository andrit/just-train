// ------------------------------------------------------------
// hooks/useSyncStatus.ts (v2.4.0)
//
// Reactive sync state for UI components.
// Subscribes to syncService events via CustomEvent listeners.
//
// Returns:
//   pending  — number of unsynced writes in the queue
//   status   — 'idle' | 'syncing' | 'error'
//   flush    — manually trigger a sync attempt
// ------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react'
import { syncService, SYNC_STATUS_EVENT }   from '@/services/syncService'
import type { SyncStatus }                   from '@/services/syncService'

interface SyncStatusResult {
  pending: number
  status:  SyncStatus
  flush:   () => void
}

export function useSyncStatus(): SyncStatusResult {
  const [pending, setPending] = useState(() => syncService.getPending())
  const [status,  setStatus]  = useState<SyncStatus>('idle')

  useEffect(() => {
    const handler = (e: Event): void => {
      const { pending, status } = (e as CustomEvent<{ pending: number; status: SyncStatus }>).detail
      setPending(pending)
      setStatus(status)
    }

    window.addEventListener(SYNC_STATUS_EVENT, handler)
    return () => window.removeEventListener(SYNC_STATUS_EVENT, handler)
  }, [])

  const flush = useCallback((): void => {
    syncService.flush()
  }, [])

  return { pending, status, flush }
}
