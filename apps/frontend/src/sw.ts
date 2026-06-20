/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare let self: ServiceWorkerGlobalScope

// Background Sync API is not in all TypeScript webworker lib versions — declare locally.
interface SyncEvent extends ExtendableEvent {
  readonly tag: string
  readonly lastChance: boolean
}

// Inject the precache manifest at build time.
// VitePWA replaces self.__WB_MANIFEST with a versioned list of all static assets.
precacheAndRoute(self.__WB_MANIFEST)

// On activation: purge stale entries from previous SW versions.
// Without this, old versioned bundles accumulate in Cache Storage indefinitely.
cleanupOutdatedCaches()

// SPA navigation fallback — all app routes serve /index.html from precache.
// Ensures every route loads offline even if the user navigates directly to it.
// API routes are excluded — they should fail with a network error, not return HTML.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api/],
  })
)

// NetworkFirst: API reference data (exercises, body parts, templates).
// Changes rarely, no PII — safe to serve stale for 24h. 50-entry cap.
registerRoute(
  ({ url }) => /\/api\/v1\/(exercises|body-parts|templates)(\?|\/|$)/.test(url.pathname),
  new NetworkFirst({
    cacheName: 'api-reference-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  })
)

// CacheFirst: Cloudinary media (exercise illustrations, progress photos).
// Immutable once uploaded — serve from cache, evict after 30 days, cap at 200 entries.
registerRoute(
  ({ url }) => url.origin === 'https://res.cloudinary.com',
  new CacheFirst({
    cacheName: 'cloudinary-media',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
)

// Background Sync relay.
// When the browser gets connectivity (even after the app tab closes), the browser
// fires a 'sync' event here. We message all open window clients to flush the
// localStorage write queue via syncService. If no clients are open, syncService's
// startup flush handles it on the next app load.
self.addEventListener('sync', (event) => {
  const syncEvt = event as unknown as SyncEvent
  if (syncEvt.tag === 'trainer-app-write-queue') {
    syncEvt.waitUntil(
      self.clients
        .matchAll({ includeUncontrolled: true, type: 'window' })
        .then((clients) => {
          clients.forEach((client) => client.postMessage({ type: 'FLUSH_QUEUE' }))
        })
    )
  }
})
