# PWA E2E Testing Gotchas — Playwright + Service Workers

> Written after Phase 8 (Testing). Documents patterns and failure modes
> discovered while writing the Playwright test suite for a Vite + Workbox PWA.
> These are not obvious from the Playwright or Workbox documentation.

---

## 1. `waitForFunction` does not await async callbacks

**Symptom:** Test resolves immediately with `null` instead of waiting.

**What happened:**
```typescript
// WRONG — Promise object is truthy; waitForFunction resolves immediately
const handle = await page.waitForFunction(async () => {
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg?.active?.state ?? null
})
const state = await handle.jsonValue() // → null (serialized Promise)
```

Playwright's `waitForFunction` evaluates the callback and checks if the return value is truthy. An async function returns a Promise. The Promise object itself is truthy, so `waitForFunction` resolves immediately — before the Promise settles — and `jsonValue()` serializes the unresolved Promise as `null`.

**Fix:** Use only synchronous values inside `waitForFunction`. Convert async state to a synchronous flag via `page.addInitScript`:

```typescript
// Set up before page.goto — addInitScript runs before any page scripts
await page.addInitScript(() => {
  (window as Window & { __swReady?: boolean }).__swReady = false
  navigator.serviceWorker.ready.then(() => {
    (window as Window & { __swReady?: boolean }).__swReady = true
  })
})

// Now waitForFunction polls the synchronous flag
await page.waitForFunction(
  () => !!(window as Window & { __swReady?: boolean }).__swReady,
  { timeout: 25_000 }
)
```

`navigator.serviceWorker.controller` is also safe — it's a synchronous property:
```typescript
await page.waitForFunction(
  () => navigator.serviceWorker.controller !== null,
  { timeout: 10_000 }
)
```

---

## 2. `networkidle` fails with active SW + TanStack Query

**Symptom:** `waitForLoadState('networkidle')` times out after 30 seconds on page reload.

**What happened:**
Two concurrent sources of network activity prevent `networkidle` from firing:
- The SW install event fetches and caches all precache assets (one request per file in the build manifest — typically 15–30 requests).
- TanStack Query fires background refetches for all active queries on page focus (including after a `page.reload()`).

Playwright counts SW background fetches as active network connections. If either source keeps making requests, `networkidle` (which requires 500ms of zero connections) never fires.

**Fix:** Don't use `networkidle` in PWA E2E tests. Use the appropriate signal for what you're actually waiting for:

| Waiting for | Use |
|---|---|
| SW to be activated | `__swReady` flag via `addInitScript` |
| SW to control the page | `waitForFunction(() => controller !== null)` |
| A specific element to render | `page.waitForSelector(...)` |
| Page navigation to complete | `waitForLoadState('load')` or `waitForURL(...)` |
| A URL change | `expect(page).toHaveURL(...)` |

---

## 3. `navigator.serviceWorker.controller` is null on the install page

**Symptom:** `waitForFunction(() => controller !== null)` times out even though the SW is installed.

**What happened:**
`src/sw.ts` does not call `self.clients.claim()`. This is intentional — it prevents the SW from disrupting open tabs when an update deploys. The consequence: the page that triggered the SW install does not become controlled by it. `controller` remains `null` for that page's lifetime.

`controller` is only non-null on pages that were opened **after** the SW was already in the `activated` state.

**Fix:** Use a two-load pattern. Wait for SW activation (via `__swReady`), then reload. The reloaded page was opened after activation, so `controller` is non-null.

```typescript
async function loadWithSwActive(page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__swReady = false
    navigator.serviceWorker.ready.then(() => { (window as any).__swReady = true })
  })

  await page.goto('/')
  // Wait for SW to fully activate (install event + activate event complete)
  await page.waitForFunction(() => !!(window as any).__swReady, { timeout: 25_000 })

  // Reload: this page opened after SW activated → controller is non-null
  await page.reload()
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    { timeout: 10_000 }
  )
}
```

**Note:** If you DO add `self.clients.claim()` to the SW, the two-load pattern becomes unnecessary — the SW claims the install page immediately on activation. The trade-off is that deployed SW updates take control of open tabs immediately (may interrupt in-progress sessions).

---

## 4. SW precache doesn't work in Vite dev mode (`injectManifest` strategy)

**Symptom:** SW registration check returns null/undefined in dev; offline navigation fails.

**What happened:**
VitePWA's `injectManifest` strategy injects the precache manifest (`self.__WB_MANIFEST`) at **build time** via `vite build`. In dev mode (`vite dev`), no build runs, so `self.__WB_MANIFEST` is never injected. The SW either fails to register or registers without a precache.

**Fix:** Run E2E tests against the production preview server, not the dev server:

```typescript
// playwright.config.ts
webServer: {
  command: 'npm run build && npm run preview',
  url: 'http://localhost:4173',
}
```

The `npm run test:e2e` script handles the build automatically. Non-SW tests (primary flow, auth) run against the same preview server and work identically.

**Note for developer iteration:** `reuseExistingServer: true` (set for non-CI environments) means subsequent test runs reuse the already-running preview server. The build only runs once per server start.

---

## 5. `context.setOffline(true)` before auth bootstrap shows OfflineAuthScreen

**Symptom:** Offline login test times out waiting for `input[type="email"]`.

**What happened:**
`AuthProvider` calls `attemptTokenRefresh()` on mount. If `setOffline(true)` fires before this refresh completes, the fetch fails with a network error. `AuthProvider` then checks `!navigator.onLine` and shows `OfflineAuthScreen` instead of the login form.

**Fix:** Wait for the login form to render before going offline. This confirms the auth bootstrap (refresh attempt → 401 → `clearAuth()` → `LoginPage` mounts) has completed.

```typescript
await page.goto('/login')
// AuthProvider refresh must complete before going offline
await page.waitForSelector('input[type="email"]', { timeout: 10_000 })
await context.setOffline(true)
// Now fill and submit — navigator.onLine is false, LoginPage shows offline error
```

---

## 6. `page.evaluate` with async is destroyed by SW `clients.claim()`

**Symptom:** `page.evaluate: Execution context was destroyed, most likely because of a navigation.`

**What happened:**
When the SW activates and calls `clients.claim()` (in other configurations), it takes control of the current page. Playwright treats this as a navigation, destroying the execution context of any pending `page.evaluate` call that's awaiting an async operation.

**Fix:** Use `page.waitForFunction` instead of `page.evaluate` for any check that might span a SW lifecycle event. `waitForFunction` retries automatically when the context is destroyed.

---

## Summary table

| Failure | Root cause | Fix |
|---|---|---|
| `waitForFunction` returns null | async callback, Promise treated as truthy | Use synchronous value or `addInitScript` flag |
| `networkidle` never fires | SW precache + TanStack Query refetches | Use specific element/URL waits instead |
| `controller` always null | No `clientsClaim()` in SW | Two-load pattern (install, then reload) |
| Precache missing in dev | `injectManifest` requires build step | E2E against `vite preview`, not `vite dev` |
| Login form not found | `setOffline` before auth bootstrap | `waitForSelector` before `setOffline` |
| Execution context destroyed | SW `clients.claim()` mid-evaluate | Use `waitForFunction` not `page.evaluate` |
