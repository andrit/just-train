// primary-flow.spec.ts
//
// E2E: Login → Dashboard → My Training
// All API calls are intercepted via page.route() so the tests run without
// a backend. The refresh endpoint returns 200 with a valid trainer so the
// AuthProvider skips the login redirect when the test wants an authenticated state.

import { test, expect } from '@playwright/test'

// Trainer fixture returned by auth mocks
const mockTrainer = {
  id:                   'trainer-uuid-1',
  name:                 'Alex Smith',
  email:                'alex@example.com',
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

const accessToken = 'e2e-test-token'

// Set up API mocks that make the app think the user is logged in.
async function mockAuthenticatedSession(page: Parameters<typeof test>[1]['page']): Promise<void> {
  await page.route('/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ accessToken, trainer: mockTrainer }),
    })
  })

  // Silence other API calls with empty successful responses
  await page.route('/api/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/auth/refresh')) return route.continue()

    await route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ clients: [], sessions: [], exercises: [], total: 0 }),
    })
  })
}

// ── Unauthenticated redirect ──────────────────────────────────────────────────

test('unauthenticated user is redirected from / to /login', async ({ page }) => {
  // Refresh returns 401 → not authenticated
  await page.route('/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) })
  )
  await page.route('/api/v1/**', (route) =>
    route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) })
  )

  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

// ── Login form → Dashboard ────────────────────────────────────────────────────

test('successful login lands on the dashboard', async ({ page }) => {
  // Start unauthenticated
  await page.route('/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: 401, body: JSON.stringify({ error: 'Unauthorized' }) })
  )
  await page.route('/api/v1/auth/login', (route) =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ accessToken, trainer: mockTrainer }),
    })
  )
  // Silence all subsequent API calls after login
  await page.route('/api/v1/**', (route) =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ clients: [], sessions: [], exercises: [], total: 0 }),
    })
  )

  await page.goto('/login')
  await page.fill('input[type="email"]',    'alex@example.com')
  await page.fill('input[type="password"]', 'password123')
  await page.click('button[type="submit"]')

  await expect(page).toHaveURL('/')
})

// ── Offline login guard ───────────────────────────────────────────────────────

test('submitting login while offline shows offline message instead of spinner', async ({ page, context }) => {
  // Start unauthenticated
  await page.route('/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: 401 })
  )

  await page.goto('/login')

  // Wait for the login form to render before going offline.
  // AuthProvider must complete its refresh attempt (gets 401, calls clearAuth())
  // before LoginPage mounts. Going offline first causes AuthProvider's !navigator.onLine
  // branch to fire, showing OfflineAuthScreen instead of the login form.
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 })

  await context.setOffline(true)

  await page.fill('input[type="email"]',    'offline@example.com')
  await page.fill('input[type="password"]', 'password')
  await page.click('button[type="submit"]')

  // LoginPage.handleSubmit checks navigator.onLine before calling the API
  await expect(page.locator('text=offline')).toBeVisible({ timeout: 3_000 })
})

// ── Authenticated — dashboard renders ────────────────────────────────────────

test('authenticated user sees the dashboard', async ({ page }) => {
  await mockAuthenticatedSession(page)
  await page.goto('/')
  // Dashboard has at least one heading — sufficient to confirm it rendered
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5_000 })
})

// ── My Training page (athlete self-view) ──────────────────────────────────────

test('/my-training is accessible for authenticated users', async ({ page }) => {
  await mockAuthenticatedSession(page)
  await page.goto('/my-training')
  // Page renders without crashing
  await expect(page.locator('body')).not.toBeEmpty()
})

// ── AthleteRouteGuard ─────────────────────────────────────────────────────────

test('athlete-mode user is redirected away from /clients', async ({ page }) => {
  // Return an athlete-mode trainer
  const athleteTrainer = { ...mockTrainer, trainerMode: 'athlete', onboardedAt: '2024-01-01T00:00:00Z' }

  await page.route('/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({ accessToken, trainer: athleteTrainer }),
    })
  )
  await page.route('/api/v1/**', (route) =>
    route.fulfill({
      status:      200,
      contentType: 'application/json',
      body:        JSON.stringify({}),
    })
  )

  await page.goto('/clients')
  // AthleteRouteGuard redirects to /
  await expect(page).not.toHaveURL(/\/clients/)
})
