// ------------------------------------------------------------
// lib/api.ts — Base API client (Phase 3 update)
//
// PHASE 3 CHANGES:
//   - apiClient is now callable as a function: apiClient<T>(path, init?)
//     This matches the fetch-like interface expected by TanStack Query hooks.
//   - Backwards-compatible: old apiClient.get/post/patch/delete still work.
//   - init.body as string is forwarded as-is (JSON.stringify done by caller).
//
// PHASE 2 (unchanged):
//   - Attaches Authorization: Bearer <token> from authStore on every request
//   - Handles 401 TOKEN_EXPIRED: auto-refresh + retry once
//   - Sends X-Device-ID and X-Trainer-ID headers
// ------------------------------------------------------------

import { useAuthStore, DEVICE_ID } from '@/store/authStore'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

export class ApiError extends Error {
  constructor(
    public readonly status:   number,
    public readonly message:  string,
    public readonly code?:    string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ── Token refresh — singleton pattern ────────────────────────────────────────
// Only one refresh call in flight at a time. All concurrent 401s share the
// same promise. When the refresh fails, we redirect immediately and set a
// flag so no further requests are attempted.

let refreshPromise: Promise<string | null> | null = null
let isRedirectingToLogin = false

export async function attemptTokenRefresh(): Promise<string | null> {
  // Already redirecting — don't attempt anything
  if (isRedirectingToLogin) return null

  // Return the in-flight promise if one exists (deduplication)
  if (refreshPromise) return refreshPromise

  const trainerId = useAuthStore.getState().trainer?.id

  refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
    method:      'POST',
    credentials: 'include',
    headers: {
      'X-Device-ID':   DEVICE_ID,
      ...(trainerId ? { 'X-Trainer-ID': trainerId } : {}),
    },
  })
    .then(async (response) => {
      if (!response.ok) return null
      const data = await response.json()
      useAuthStore.getState().setAuth(data.accessToken, data.trainer)
      return data.accessToken as string
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null  // clear lock so future refreshes can run
    })

  return refreshPromise
}

function redirectToLogin(): void {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true
  useAuthStore.getState().clearAuth()
  // Do NOT use window.location.href here — that causes a hard reload which
  // resets all module state (including isRedirectingToLogin) and restarts
  // the entire 401 loop. Instead, clearAuth() sets isAuthenticated: false
  // and ProtectedRoute in App.tsx handles the redirect via React Router.
  // Reset the flag after a tick so future logins work normally.
  setTimeout(() => { isRedirectingToLogin = false }, 100)
}

// ── Core request ──────────────────────────────────────────────────────────────

async function request<T>(
  path:        string,
  init:        RequestInit = {},
  isRetry = false,
): Promise<T> {
  // Already redirecting to login — don't fire any more requests
  if (isRedirectingToLogin) throw new ApiError(401, 'Session expired')

  const { accessToken, isInitializing } = useAuthStore.getState()

  // Don't fire authenticated requests while auth state is still being
  // restored from the refresh cookie — avoids the 401 storm on startup.
  // Auth routes are always allowed through.
  if (isInitializing && !path.includes('/auth/')) {
    throw new ApiError(0, 'Auth initializing')
  }

  const headers: Record<string, string> = {
    'X-Device-ID': DEVICE_ID,
    // Only set Content-Type for non-DELETE requests with a JSON body.
    // DELETE has no body — sending Content-Type: application/json with an
    // empty body causes Fastify to return 400 FST_ERR_CTP_EMPTY_JSON_BODY.
    ...(init.method !== 'DELETE' && (!init.body || typeof init.body === 'string')
      ? { 'Content-Type': 'application/json' }
      : {}),
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  // Merge caller headers, letting them override defaults
  const mergedHeaders = { ...headers, ...(init.headers as Record<string, string> ?? {}) }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers:     mergedHeaders,
    credentials: 'include',
  })

  // ── 401 — attempt silent refresh + retry once ────────────────────────────
  // Fires on any 401: expired token, missing token, or invalid token.
  // Auth routes excluded. Singleton refresh prevents parallel calls.
  if (response.status === 401 && !isRetry && !path.includes('/auth/')) {
    const newToken = await attemptTokenRefresh()
    if (newToken) {
      return request<T>(path, init, true)
    } else {
      redirectToLogin()
      throw new ApiError(401, 'Session expired — please log in again')
    }
  }

  if (!response.ok) {
    let errorData: { error?: string; code?: string; details?: unknown } = {}
    try { errorData = await response.json() } catch { /* ignore */ }

    // Don't redirect to login on auth routes — the login page needs to
    // display the error message itself (e.g. "Invalid email or password")
    if (response.status === 401 && !path.includes('/auth/')) {
      redirectToLogin()
    }

    throw new ApiError(
      response.status,
      errorData.error || response.statusText || `Request failed (${response.status})`,
      errorData.code,
      errorData.details,
    )
  }

  if (response.status === 204) return null as T
  return response.json() as Promise<T>
}

// ── Public API ────────────────────────────────────────────────────────────────
// Callable as a function:  apiClient<T>(path, init?)
// Or via method shortcuts: apiClient.get<T>(path)

type ApiFn = {
  <T>(path: string, init?: RequestInit): Promise<T>
  get:    <T>(path: string)                     => Promise<T>
  post:   <T>(path: string, body: unknown)      => Promise<T>
  patch:  <T>(path: string, body: unknown)      => Promise<T>
  delete: <T>(path: string)                     => Promise<T>
}

const fn = <T>(path: string, init: RequestInit = {}) =>
  request<T>(path, init)

const apiClient = fn as ApiFn
apiClient.get    = <T>(path: string)            => request<T>(path, { method: 'GET' })
apiClient.post   = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',  body: JSON.stringify(body) })
apiClient.patch  = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
apiClient.delete = <T>(path: string)            => request<T>(path, { method: 'DELETE' })

export { apiClient }
