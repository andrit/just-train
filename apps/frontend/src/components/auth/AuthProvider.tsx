// ------------------------------------------------------------
// components/auth/AuthProvider.tsx — Auth state bootstrapper (Phase 2)
// Updated Phase 3.5: React.JSX.Element return types
// Updated v2.12.0: Proactive token refresh every 12 min to prevent
//   mid-workout logouts. Access tokens expire at 15 min — this
//   renews them before expiry so long sessions stay authenticated.
// ------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore }      from '@/store/authStore'
import { attemptTokenRefresh } from '@/lib/api'
import { Spinner }           from '@/components/ui/Spinner'

// Refresh 3 minutes before the 15-minute token expiry
const REFRESH_INTERVAL_MS = 12 * 60 * 1000

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * AuthProvider — runs once on mount to attempt a silent token refresh.
 * Restores auth state from the httpOnly cookie on page load/refresh.
 * Children are not mounted until initialization completes — this prevents
 * any query hooks from firing before the access token is available.
 *
 * Also starts a proactive refresh timer so long workouts (>15 min)
 * don't expire the access token mid-session.
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const isInitializing  = useAuthStore((s) => s.isInitializing)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setInitializing = useAuthStore((s) => s.setInitializing)
  const hasRun = useRef(false)

  // ── Bootstrap: attempt refresh on first mount ──────────────────────────
  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    attemptTokenRefresh()
      .then((token) => {
        // If refresh failed, ensure auth state is fully cleared
        if (!token) useAuthStore.getState().clearAuth()
      })
      .finally(() => {
        setInitializing(false)
      })
  }, [setInitializing])

  // ── Proactive refresh: renew token every 12 minutes while authenticated ──
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      attemptTokenRefresh().catch(() => {
        // Silent failure — the 401 interceptor in api.ts handles the redirect
      })
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [isAuthenticated])

  // Block children from mounting until auth is resolved.
  // This prevents query hooks from firing before the access token exists.
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <Spinner size="lg" className="text-brand-highlight" label="Initialising app" />
      </div>
    )
  }

  return <>{children}</>
}

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * ProtectedRoute — redirects to /login if the user is not authenticated.
 * Preserves the intended destination so they're sent there after login.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps): React.JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location        = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
