# Pre-Phase 4 Audit — Service Worker & Caching

**Date:** 2026-06-19
**Purpose:** Inventory what's already in place vs what Phase 4 actually needs to deliver.
**SDLC reference:** `/workbench/project-types/pwa/project.json` → phase `4`

---

## Phase 4 deliverables — status

| Deliverable | Status | Evidence |
|---|---|---|
| App shell cached on install (cache-first) | ✅ Done | `vite.config.ts` → `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` — all static assets precached by Workbox `generateSW` |
| API responses cached with correct strategy per endpoint | ✅ Done | `runtimeCaching`: NetworkFirst for `/exercises`, `/body-parts`, `/templates` (24h, 50 entries); CacheFirst for Cloudinary (30d, 200 entries) |
| Cache size managed (max entries set, old entries evicted) | ✅ Done | `maxEntries` set on both runtime caches |
| Background sync for offline writes | ⚠️ Partial | `offlineQueue` (localStorage) + `syncService.flush()` on `window.online` event works. Does **not** use the Web Background Sync API — so DevTools won't show sync events and the flush doesn't fire when the app is closed |
| Static assets cached with versioned names (old caches purged on activation) | ❌ Missing | `cleanupOutdatedCaches` not set in Workbox config — old cache entries persist across deploys |
| Offline fallback page for failed navigation | ❌ Missing | No `navigateFallback` configured — if a user navigates to a route while offline with no cache, they get a browser error page, not the app |

---

## Advance criteria — status

| Criterion | Status | Notes |
|---|---|---|
| App shell loads instantly when offline | ✅ Met | Precache covers all static assets |
| Chrome DevTools → Cache Storage shows expected resources | ✅ Met | `api-reference-cache` + `cloudinary-media` + precache are all written by Workbox |
| Old caches cleaned up on SW activation | ❌ Not met | `cleanupOutdatedCaches: true` needs to be added |
| Background sync visible in DevTools when write made offline | ❌ Not met | Requires Web Background Sync API registration in the SW — current impl uses `window.online` only |

---

## What Phase 4 actually needs to build

### 1. `cleanupOutdatedCaches: true` (5 min)
Add to the `workbox` block in `vite.config.ts`. Workbox then purges stale precache entries on every SW activation. Without it, old bundles accumulate.

### 2. `navigateFallback` (30 min)
Add `navigateFallback: '/index.html'` and `navigateFallbackDenylist: [/^\/api/]` to the Workbox config. When the SW intercepts a navigation request and there's nothing in cache (new route, first visit offline), it serves `index.html` from precache — the React app loads, and the router renders the correct `OfflineFallback` or offline state. Without this, the browser shows its own error page.

### 3. Web Background Sync API (1–2h)
Replace `syncService`'s `window.online` flush with a proper Background Sync registration. This requires:
- A custom service worker entry point (`sw.ts`) instead of Workbox's fully auto-generated SW
- Registering a `sync` event tag in the app when an operation is queued
- A `sync` event handler in the SW that calls the API to flush the queue
- Switching VitePWA from `generateSW` to `injectManifest` mode

**Trade-off:** The current `window.online` approach works correctly for the primary use case (user is in the app when reconnecting). The SW Background Sync API adds resilience for the edge case where the app is closed when reconnecting — but the offline contract notes this is uncommon for gym-floor use. `window.online` flushes as long as the tab is open; Background Sync flushes even after tab close.

**Recommendation:** Deliver #1 and #2 now (both are one-line config changes, immediate value). Treat #3 as a separate decision — it requires switching to `injectManifest` mode and writing a custom SW, which changes the entire SW architecture. Flag it as a known gap with a clear backlog item.

---

## Known gaps carried forward

| Gap | Where tracked |
|---|---|
| Background Sync fires even when app is closed | Phase 4 backlog — needs `injectManifest` mode + custom SW |
| PR detection skipped for offline-logged sets | offline-contract.md known gaps |
| Goal/snapshot creation not offline-aware | offline-contract.md known gaps |
| `navigator.onLine` false-positive on captive networks | offline-contract.md known gaps |
