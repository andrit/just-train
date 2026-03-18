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

// ── Token refresh ─────────────────────────────────────────────────────────────

export async function attemptTokenRefresh(): Promise<string | null> {
  const trainerId = useAuthStore.getState().trainer?.id

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
      headers: {
        'X-Device-ID':   DEVICE_ID,
        ...(trainerId ? { 'X-Trainer-ID': trainerId } : {}),
      },
    })
    if (!response.ok) return null
    const data = await response.json()
    useAuthStore.getState().setAuth(data.accessToken, data.trainer)
    return data.accessToken as string
  } catch {
    return null
  }
}

// ── Core request ──────────────────────────────────────────────────────────────

async function request<T>(
  path:        string,
  init:        RequestInit = {},
  isRetry = false,
): Promise<T> {
  const { accessToken } = useAuthStore.getState()

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

  // ── 401 TOKEN_EXPIRED — silent refresh + retry once ───────────────────────
  if (response.status === 401 && !isRetry) {
    let errorBody: { code?: string } = {}
    try { errorBody = await response.clone().json() } catch { /* ignore */ }

    if (errorBody.code === 'TOKEN_EXPIRED') {
      const newToken = await attemptTokenRefresh()
      if (newToken) {
        return request<T>(path, init, true)
      } else {
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
        throw new ApiError(401, 'Session expired — please log in again')
      }
    }
  }

  if (!response.ok) {
    let errorData: { error?: string; code?: string; details?: unknown } = {}
    try { errorData = await response.json() } catch { /* ignore */ }

    if (response.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }

    throw new ApiError(
      response.status,
      errorData.error ?? response.statusText,
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
