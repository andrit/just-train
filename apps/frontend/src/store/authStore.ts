// ------------------------------------------------------------
// store/authStore.ts — Authentication state (Phase 2)
//
// WHY ZUSTAND FOR AUTH STATE?
//   The access token must live in JavaScript memory, NOT localStorage.
//   localStorage is readable by any JS on the page (XSS risk).
//   Zustand state lives in memory — gone on page close, which is safe
//   and intentional. The httpOnly refresh token cookie handles persistence
//   across page loads without JavaScript ever touching it.
//
// FLOW:
//   1. App loads → call initAuth() → hits GET /auth/me
//      If that fails with 401, try POST /auth/refresh using the cookie.
//      If refresh succeeds → store new access token → user is logged in.
//      If refresh fails → user must log in.
//   2. Login → store access token + trainer profile
//   3. Every API request → apiClient reads token via getState()
//   4. API returns 401 TOKEN_EXPIRED → apiClient calls refresh()
//      → if ok, retry original request → transparent to the user
//   5. Logout → clear token + call /auth/logout → cookie is cleared server-side
//
// DEVICE ID:
//   A UUID stored in localStorage that identifies this browser/device.
//   It is NOT sensitive — it's just used to look up the right refresh token
//   in the DB. It does not grant any access on its own.
// ------------------------------------------------------------

import { create } from 'zustand'
import type { TrainerResponse } from '@trainer-app/shared'

// Retrieve or generate a stable device ID for this browser
// localStorage is fine here — this value is not sensitive
function getOrCreateDeviceId(): string {
  const stored = localStorage.getItem('trainer_device_id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('trainer_device_id', id)
  return id
}

export const DEVICE_ID = getOrCreateDeviceId()

interface AuthStore {
  // The JWT access token — in memory only, never persisted
  accessToken: string | null

  // Logged-in trainer profile
  trainer: TrainerResponse | null

  // True during the initial auth check on app load
  isInitializing: boolean

  // True if the user is authenticated
  isAuthenticated: boolean

  // Actions
  setAuth:         (token: string, trainer: TrainerResponse) => void
  setTrainer:      (trainer: TrainerResponse) => void  // update trainer without changing token
  clearAuth:       () => void
  setInitializing: (value: boolean) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  accessToken:    null,
  trainer:        null,
  isInitializing: true,
  isAuthenticated: false,

  setAuth: (accessToken, trainer) =>
    set({ accessToken, trainer, isAuthenticated: true, isInitializing: false }),

  setTrainer: (trainer) =>
    set({ trainer }),

  clearAuth: () =>
    set({ accessToken: null, trainer: null, isAuthenticated: false, isInitializing: false }),

  setInitializing: (value) =>
    set({ isInitializing: value }),
}))
