// ------------------------------------------------------------
// hooks/useSignOut.ts — the one sign-out sequence
//
// Server revoke (this device, or every device), then the local teardown that
// MUST happen even if the server call fails: query cache, auth store, any
// live session state, the overlay, and a redirect to /login. Layout's logout
// button, "Sign out everywhere" in Account, and account deactivation all go
// through here so the teardown cannot drift between them.
// ------------------------------------------------------------

import { useNavigate }     from 'react-router-dom'
import { useQueryClient }  from '@tanstack/react-query'
import { apiClient }       from '@/lib/api'
import { useAuthStore }    from '@/store/authStore'
import { useSessionStore } from '@/store/sessionStore'
import { useOverlayStore } from '@/store/overlayStore'

interface SignOutOptions {
  /** Revoke every device's refresh token, not just this one. */
  everywhere?: boolean
  /** Skip the server call — the server already ended the session (e.g. account deactivated). */
  localOnly?: boolean
}

export function useSignOut(): (opts?: SignOutOptions) => Promise<void> {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return async ({ everywhere = false, localOnly = false }: SignOutOptions = {}): Promise<void> => {
    try {
      if (!localOnly) await apiClient.post(everywhere ? '/auth/logout-all' : '/auth/logout', {})
    } catch {
      // Even if the server call fails, clear local auth
    } finally {
      qc.clear()
      clearAuth()
      useSessionStore.getState().clearAll()
      useOverlayStore.getState().hide()
      navigate('/login', { replace: true })
    }
  }
}
