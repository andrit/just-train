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
import App from './App'
import './index.css'

// ------------------------------------------------------------
// TanStack Query client configuration
//
// The QueryClient manages the cache for all server state.
// defaultOptions apply to every query/mutation in the app
// unless overridden at the individual query level.
// ------------------------------------------------------------
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long data is considered fresh before a background refetch
      staleTime: 1000 * 60 * 5, // 5 minutes

      // How long inactive data stays in the cache before being garbage collected
      gcTime: 1000 * 60 * 30,   // 30 minutes

      // Retry failed requests twice before showing an error
      retry: 2,

      // Don't refetch when the user switches back to the browser tab
      // (relevant for workout tracking — we don't want unexpected refreshes mid-session)
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Retry failed mutations once (e.g. if a set-recording request fails)
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* QueryClientProvider makes the query client available to all child components */}
    <QueryClientProvider client={queryClient}>
      {/* BrowserRouter enables client-side routing */}
      <BrowserRouter>
        <App />
      </BrowserRouter>

      {/* DevTools panel — only visible in development, removed from production build */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
)
