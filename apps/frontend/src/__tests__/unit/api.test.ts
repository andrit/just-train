// api.test.ts
//
// Tests the 401 interceptor behaviour — specifically the offline guard
// that prevents mid-workout logouts when a request fails because the
// network is down rather than because the session expired.
//
// Each test uses vi.resetModules() + dynamic imports to get a fresh
// module with reset module-level state (refreshPromise, isRedirectingToLogin).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TrainerResponse }                  from '@trainer-app/shared'

const mockTrainer: Pick<TrainerResponse, 'id' | 'name' | 'email'> & Record<string, unknown> = {
  id:    'trainer-uuid-1',
  name:  'Alex Smith',
  email: 'alex@example.com',
  // remaining fields omitted — authStore only reads .id
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

// Helper: build a minimal Response-like object
function makeResponse(status: number, body?: unknown): Response {
  return {
    ok:     status >= 200 && status < 300,
    status,
    json:   async () => body ?? {},
    text:   async () => JSON.stringify(body ?? {}),
    headers: new Headers(),
  } as unknown as Response
}

beforeEach(() => {
  vi.resetModules()
})

describe('apiClient — happy path', () => {
  it('returns parsed JSON for a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(200, { ok: true })))

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.setState({ isInitializing: false, accessToken: 'tok', isAuthenticated: true, trainer: mockTrainer as TrainerResponse })

    const result = await apiClient<{ ok: boolean }>('/clients')
    expect(result).toEqual({ ok: true })
  })

  it('returns null for a 204 No Content response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse(204)))

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.setState({ isInitializing: false, accessToken: 'tok', isAuthenticated: true, trainer: mockTrainer as TrainerResponse })

    const result = await apiClient('/sessions/1')
    expect(result).toBeNull()
  })
})

describe('apiClient — 401 interceptor', () => {
  it('retries the original request when refresh succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse(401))
      .mockResolvedValueOnce(makeResponse(200, { accessToken: 'new-tok', trainer: mockTrainer }))
      .mockResolvedValueOnce(makeResponse(200, { clients: [] }))

    vi.stubGlobal('fetch', fetchMock)

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.setState({ isInitializing: false, accessToken: 'old-tok', isAuthenticated: true, trainer: mockTrainer as TrainerResponse })

    const result = await apiClient<{ clients: unknown[] }>('/clients')
    expect(result).toEqual({ clients: [] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws without clearing auth when 401 arrives and device is offline', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse(401))
      .mockRejectedValueOnce(new Error('Failed to fetch'))  // refresh fails offline

    vi.stubGlobal('fetch', fetchMock)
    // Simulate offline
    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.setState({ isInitializing: false, accessToken: 'tok', isAuthenticated: true, trainer: mockTrainer as TrainerResponse })

    await expect(apiClient('/clients')).rejects.toThrow('offline')

    // Auth must NOT be cleared — session is still valid, just unreachable
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().accessToken).toBe('tok')
  })

  it('clears auth and throws when 401 arrives and device is online but refresh fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse(401))
      .mockResolvedValueOnce(makeResponse(401))  // refresh also fails

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('navigator', { ...navigator, onLine: true })

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.setState({ isInitializing: false, accessToken: 'tok', isAuthenticated: true, trainer: mockTrainer as TrainerResponse })

    await expect(apiClient('/clients')).rejects.toThrow('Session expired')

    // Auth should be cleared so ProtectedRoute redirects to /login
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('does not retry on 401 for auth endpoints to avoid refresh loops', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(401, { error: 'Invalid credentials' }))
    vi.stubGlobal('fetch', fetchMock)

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.setState({ isInitializing: false, isAuthenticated: false })

    await expect(apiClient('/auth/login', { method: 'POST' })).rejects.toThrow()

    // Fetch called only once — no refresh attempt on auth routes
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('apiClient — non-401 errors', () => {
  it('throws ApiError for 400 Bad Request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeResponse(400, { error: 'Validation failed', code: 'INVALID_BODY' })
    ))

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    useAuthStore.setState({ isInitializing: false, accessToken: 'tok', isAuthenticated: true, trainer: mockTrainer as TrainerResponse })

    const err = await apiClient('/clients').catch(e => e)
    expect(err.status).toBe(400)
    expect(err.code).toBe('INVALID_BODY')
  })

  it('throws when isInitializing to prevent pre-auth request storms', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { apiClient }   = await import('@/lib/api')
    const { useAuthStore } = await import('@/store/authStore')
    // Leave isInitializing: true (default state)
    expect(useAuthStore.getState().isInitializing).toBe(true)

    await expect(apiClient('/clients')).rejects.toThrow('Auth initializing')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
