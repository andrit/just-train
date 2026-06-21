// ------------------------------------------------------------
// main.tsx — React application entry point
//
// This file bootstraps the entire frontend application.
// The order of providers matters:
//   QueryClientProvider must wrap everything that uses TanStack Query
//   BrowserRouter must wrap everything that uses React Router
// ------------------------------------------------------------

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import * as Sentry from '@sentry/react'
import App from './App'
import { ErrorBoundary } from './components/shell/ErrorBoundary'
import './index.css'
import { syncService, SYNC_COMPLETE_EVENT } from './services/syncService'
import { ApiError } from './lib/api'
import { capturePWAInstallPrompt } from './lib/pwaInstall'

// Sentry error monitoring — no-ops when DSN is absent (dev + CI).
// Add VITE_SENTRY_DSN to Vercel env vars to activate in production.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.05,
    allowUrls: [window.location.origin],
    // Auth errors are expected — not actionable noise in Sentry
    ignoreErrors: ['Unauthorized', 'X-Device-ID header required'],
  })

  // Track PWA install to home screen — satisfies Phase 16 advance criterion
  window.addEventListener('pwa:installed', () => {
    Sentry.captureMessage('PWA installed to home screen', 'info')
  })
}

// Register beforeinstallprompt listener before React mounts — the browser fires
// this event early and it won't repeat, so the listener must be in place first.
capturePWAInstallPrompt()

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

// Initialise offline sync — registers online/offline listeners + prefetch
syncService.init()

// When the queue flushes successfully, invalidate all session queries
// so the UI reflects the newly synced data
window.addEventListener(SYNC_COMPLETE_EVENT, () => {
  queryClient.invalidateQueries({ queryKey: ['sessions'] })
  queryClient.invalidateQueries({ queryKey: ['clients'] })
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

      {/* DevTools panel — only visible in development, removed from production build */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
)
