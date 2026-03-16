// ------------------------------------------------------------
// components/auth/AuthProvider.tsx — Auth state bootstrapper (Phase 2)
// Updated Phase 3.5: React.JSX.Element return types
// ------------------------------------------------------------

import { useEffect, useRef } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore }      from '@/store/authStore'
import { attemptTokenRefresh } from '@/lib/api'
import { Spinner }           from '@/components/ui/Spinner'

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * AuthProvider — runs once on mount to attempt a silent token refresh.
 * Restores auth state from the httpOnly cookie on page load/refresh.
 */
export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const isInitializing  = useAuthStore((s) => s.isInitializing)
  const setInitializing = useAuthStore((s) => s.setInitializing)
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    attemptTokenRefresh().finally(() => {
      setInitializing(false)
    })
  }, [setInitializing])

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
