// sw.spec.ts
//
// Service Worker smoke tests — production preview build only.
//
// Two constraints shape the approach here:
//
// 1. waitForFunction does not await Promises returned by async callbacks —
//    the Promise object itself is truthy, so it resolves immediately with an
//    unresolved Promise handle. All waitForFunction callbacks must be synchronous.
//
// 2. src/sw.ts has no clientsClaim(). This is intentional (no forced page
//    reload on SW update). The consequence: controller is null on the page
//    that triggered the install. Only pages opened AFTER activation have a
//    non-null controller. The helper below ensures SW activation is confirmed
//    via a synchronous flag before triggering the reload.
//
// 3. networkidle must not be used after a reload — the SW install event makes
//    precache requests for all static assets, which Playwright counts as active
//    network connections, and background TanStack Query refetches add more.
//
// SW ACTIVATION PATTERN (loadWithSwActive helper):
//   1. addInitScript → converts navigator.serviceWorker.ready (async) to a
//      synchronous window flag that waitForFunction can poll.
//   2. page.goto('/') → SW registers, installs, activates → flag becomes true.
//   3. page.reload() → this page was opened after activation → controller ≠ null.

import { test, expect } from '@playwright/test'

const mockTrainer = {
  id:                   'trainer-sw-1',
  name:                 'SW Tester',
  email:                'sw@example.com',
  role:                 'trainer',
  weightUnitPreference: 'kg',
  emailVerified:        false,
  lastLoginAt:          null,
  subscriptionTier:     'free',
  subscriptionStatus:   'active',
  onboardedAt:          '2024-01-01T00:00:00Z',
  trainerMode:          'trainer',
  reportsSentCount:     0,
  lastActiveAt:         null,
  ctaLabel:             'Start Training',
  alertsEnabled:        true,
  widgetProgression:    null,
  alertColorScheme:     'amber',
  alertTone:            'motivating',
  sessionLayout:        'vertical',
  weeklySessionTarget:  4,
  show1rmEstimate:      true,
  autoReportEnabled:    false,
  timezone:             'America/New_York',
  prNotifyType:         '1rm',
  restDurationSeconds:  90,
  photoSharingPreference: 'private',
  createdAt:            '2024-01-01T00:00:00Z',
  updatedAt:            '2024-01-01T00:00:00Z',
}

async function mockAllApi(page: Parameters<typeof test>[1]['page']): Promise<void> {
  await page.route('/api/v1/**', (route) =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ accessToken: 'tok', trainer: mockTrainer }),
    })
  )
}

/**
 * Load the page and block until the SW is activated, then reload so the new
 * page is under SW control (controller !== null).
 *
 * addInitScript runs before any page scripts and persists across reloads.
 * It converts navigator.serviceWorker.ready (a Promise) into a synchronous
 * boolean flag that waitForFunction can poll without the async-callback problem.
 */
async function loadWithSwActive(page: Parameters<typeof test>[1]['page']): Promise<void> {
  // Expose a synchronous flag that mirrors navigator.serviceWorker.ready state.
  // Must be registered before page.goto so it runs on page init.
  await page.addInitScript(() => {
    (window as Window & { __swReady?: boolean }).__swReady = false
    navigator.serviceWorker.ready.then(() => {
      (window as Window & { __swReady?: boolean }).__swReady = true
    })
  })

  // First load: SW registers, installs (precaches all assets), and activates.
  // Avoid networkidle — the SW install event makes precache fetch requests that
  // can prevent networkidle from firing.
  await page.goto('/')
  await page.waitForFunction(
    () => !!(window as Window & { __swReady?: boolean }).__swReady,
    { timeout: 25_000 }
  )

  // SW is activated. Reload: this page was opened after activation, so the SW
  // controls it and navigator.serviceWorker.controller is now non-null.
  await page.reload()
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    { timeout: 10_000 }
  )
}

test.describe('Service Worker', () => {
  test('is active and controlling the page after install + reload', async ({ page }) => {
    await mockAllApi(page)
    await loadWithSwActive(page)

    const swState = await page.evaluate(
      () => navigator.serviceWorker.controller?.state ?? null
    )
    expect(swState).toBe('activated')
  })

  test('offline navigation is served from SW precache (NavigationRoute fallback)', async ({ page, context }) => {
    await mockAllApi(page)
    await loadWithSwActive(page)

    // Go offline — Playwright blocks all network traffic including localhost.
    // Without the SW, this would throw net::ERR_INTERNET_DISCONNECTED.
    await context.setOffline(true)

    // NavigationRoute in sw.ts intercepts the request and serves the cached
    // index.html. React mounts into #root from the cached JS bundles.
    await page.goto('/', { waitUntil: 'commit' })
    await expect(page.locator('#root')).toHaveCount(1)
  })
})
