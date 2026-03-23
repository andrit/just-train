// ------------------------------------------------------------
// lib/offlineAwareApi.ts (v2.4.0)
//
// Drop-in wrapper around apiClient that queues mutating requests
// when the device is offline, instead of throwing network errors.
//
// READ requests (GET) are never queued — Workbox handles those
// via the NetworkFirst cache strategy in vite.config.ts.
//
// WRITE requests (POST, PATCH, DELETE) when offline:
//   1. Added to the persistent offlineQueue
//   2. An optimistic response is returned (null for DELETE,
//      a stub object for POST/PATCH)
//   3. When connectivity returns, syncService flushes the queue
//      and TanStack Query invalidates the relevant caches
//
// USAGE — identical to apiClient:
//   import { offlineAwareApi } from '@/lib/offlineAwareApi'
//   await offlineAwareApi.post('/sessions/abc/sets', body, 'Log set — Squat')
//
// The description parameter is human-readable — shown in the
// sync status UI and dev console logs.
// ------------------------------------------------------------

import { apiClient }   from './api'
import { offlineQueue } from '@/services/offlineQueue'

type Method = 'POST' | 'PATCH' | 'DELETE'

async function mutate<T>(
  method:      Method,
  path:        string,
  body:        unknown | undefined,
  description: string,
): Promise<T> {
  // If online, attempt the request normally
  if (navigator.onLine) {
    try {
      if (method === 'POST')   return await apiClient.post<T>(path, body)
      if (method === 'PATCH')  return await apiClient.patch<T>(path, body)
      if (method === 'DELETE') return await apiClient.delete<T>(path)
    } catch (err: unknown) {
      // Network error despite being "online" — queue it
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch')
      if (!isNetworkError) throw err  // real API error, don't queue
      // Fall through to queue
    }
  }

  // Offline (or network error) — queue the write
  offlineQueue.enqueue({ method, path, body, description })

  // Return a stub so callers don't break.
  // TanStack Query mutations use onSuccess to update the cache —
  // the stub prevents errors but the cache update will be incomplete
  // until sync. The pending indicator tells the trainer what's happening.
  if (import.meta.env.DEV) {
    console.debug(`[offlineAwareApi] queued (offline): ${description}`)
  }

  // Return null cast to T — caller should handle optimistic UI
  return null as T
}

export const offlineAwareApi = {
  post:   <T>(path: string, body: unknown, description: string) =>
    mutate<T>('POST',   path, body,      description),
  patch:  <T>(path: string, body: unknown, description: string) =>
    mutate<T>('PATCH',  path, body,      description),
  delete: <T>(path: string,               description: string) =>
    mutate<T>('DELETE', path, undefined, description),
}
