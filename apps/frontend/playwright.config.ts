import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:       './e2e',
  fullyParallel: true,
  forbidOnly:    !!process.env.CI,
  retries:       process.env.CI ? 2 : 0,
  workers:       process.env.CI ? 1 : undefined,
  reporter:      'html',

  use: {
    // E2E tests run against the production preview build.
    // Service worker precaching (offline fallback) only works after vite build —
    // the injectManifest strategy does not inject the precache manifest in dev mode.
    baseURL: 'http://localhost:4173',
    trace:   'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use:  { ...devices['Desktop Chrome'] },
    },
  ],

  // Build the app first, then serve with vite preview.
  // This ensures the SW precache manifest is injected and offline tests work.
  webServer: {
    command:             'npm run build && npm run preview',
    url:                 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout:             120_000,
  },
})
