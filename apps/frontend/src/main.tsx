// ------------------------------------------------------------
// main.tsx — React application entry point
//
// The critical path is kept lean: only the providers + <App/> render
// synchronously. Everything non-visual — Sentry, service-worker registration,
// offline sync, telemetry — is deferred to AFTER first paint via dynamic imports,
// so none of it sits in the always-loaded entry chunk or blocks FCP.
// (installPrompt stays static so its beforeinstallprompt listener registers early;
// it's tiny.) See the #19 initial-load plan.
// ------------------------------------------------------------

import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ErrorBoundary } from './components/shell/ErrorBoundary'
import './index.css'
import { ApiError } from './lib/api'
import { recordFirstStandaloneLaunch } from './lib/installPrompt'

// React Query devtools — DEV ONLY. Lazy + `import.meta.env.DEV` (statically false
// in a prod build) means the ternary is `null` and the dynamic import is never
// referenced, so Rollup tree-shakes the whole dependency out of production.
const DevtoolsPanel = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
  : null

// Vercel Speed Insights — real-user Web Vitals per path (no cookie, no PII; a
// no-op outside Vercel). Lazy so it's not in the entry chunk.
const SpeedInsights = lazy(() => import('@vercel/speed-insights/react').then((m) => ({ default: m.SpeedInsights })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime:    1000 * 60 * 30,
      // Never retry on 401 — the api.ts interceptor handles refresh+retry once.
      // Retrying 401s causes the rate-limit loop on startup.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 0)) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 0)) return false
        return failureCount < 1
      },
    },
  },
})

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* QueryClientProvider makes the query client available to all child components */}
    <QueryClientProvider client={queryClient}>
      {/* BrowserRouter enables client-side routing */}
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>

      {/* DevTools panel — dev only; tree-shaken from the prod bundle */}
      {DevtoolsPanel && (
        <Suspense fallback={null}>
          <DevtoolsPanel initialIsOpen={false} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <SpeedInsights sampleRate={0.2} />
      </Suspense>
    </QueryClientProvider>
  </React.StrictMode>
)

// ── Deferred bootstrap ────────────────────────────────────────────────────────
// Non-visual startup work that must not block first paint. Runs after render, on
// idle, via dynamic imports (so it's a separate chunk, not the entry). Order:
// Sentry first (so SW-registration errors can reach it), then SW, sync, telemetry,
// and finally the first-launch check (after both pwa:first-launch listeners exist).
function afterPaint(cb: () => void): void {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(cb)
  else setTimeout(cb, 1)
}

async function bootstrap(): Promise<void> {
  // Sentry — no-op without a DSN (dev + CI). Loaded first so the SW-registration
  // error handler below can report through it. Best-effort: never block on it.
  if (import.meta.env.VITE_SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/react')
      Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN as string,
        environment: import.meta.env.MODE,
        tracesSampleRate: 0.05,
        allowUrls: [window.location.origin],
        // Auth errors are expected — not actionable noise in Sentry
        ignoreErrors: ['Unauthorized', 'X-Device-ID header required'],
        // Privacy (PrivacyPage → Sentry): no IP, no PII, no replay. Pinned so a
        // future upgrade can't flip it silently. Query strings stripped — a path
        // carries UUIDs only, but a query could carry a user-typed search term.
        sendDefaultPii: false,
        beforeSend(event) {
          if (event.request?.url) event.request.url = event.request.url.split('?')[0]
          return event
        },
      })
      window.addEventListener('pwa:first-launch', () => {
        Sentry.captureMessage('PWA installed to home screen', 'info')
      })
      // Service-worker errors have no SDK of their own — sw.ts posts them here.
      const { installSwErrorRelay } = await import('./lib/swErrorRelay')
      installSwErrorRelay()
    } catch { /* monitoring is best-effort */ }
  }

  // Service worker registration — ours, not vite-plugin-pwa's injected one-liner,
  // so a rejected registration (Android 2026-09-14: bare "Rejected") is reported
  // with a real message/tag. injectRegister is null in vite.config.ts.
  try {
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({
      onRegisterError(error) {
        if (!import.meta.env.VITE_SENTRY_DSN) return
        void import('@sentry/react').then((S) =>
          S.captureException(error instanceof Error ? error : new Error(String(error)), {
            tags: { source: 'sw-registration' },
          }),
        )
      },
    })
  } catch { /* SW unsupported — the app still works online */ }

  // Offline sync — online/offline listeners + prefetch. Re-run session/client
  // queries when the write queue flushes.
  const { syncService, SYNC_COMPLETE_EVENT } = await import('./services/syncService')
  syncService.init()
  window.addEventListener(SYNC_COMPLETE_EVENT, () => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] })
    queryClient.invalidateQueries({ queryKey: ['clients'] })
  })

  // First-party usage counters (POST /telemetry) — aggregates, sent on an interval.
  const { initTelemetry, track } = await import('./services/telemetry')
  initTelemetry()
  window.addEventListener('pwa:first-launch', () => track('pwa.installed'))

  // Now that both pwa:first-launch listeners exist: is this the first launch from
  // the home screen? (installPrompt's beforeinstallprompt/appinstalled listeners
  // already registered at import time above.)
  recordFirstStandaloneLaunch()
}

afterPaint(() => { void bootstrap() })
