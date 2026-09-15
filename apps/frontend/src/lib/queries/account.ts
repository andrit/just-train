// ------------------------------------------------------------
// lib/queries/account.ts — the signed-in user's own account
// (password, devices, export, deactivate). Distinct from usePreferences,
// which is the settings surface; these are security actions.
// ------------------------------------------------------------

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { apiClient }    from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { ChangePasswordInput, DeactivateAccountInput, DeviceListResponse, ForgotPasswordInput, ResetPasswordInput } from '@trainer-app/shared'

interface MessageResponse { message: string }

export const accountKeys = {
  devices: () => ['account', 'devices'] as const,
}

// ── Password ──────────────────────────────────────────────────────────────────

/** PATCH /auth/password — re-proves the current password; other devices are signed out. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordInput) => apiClient.patch<MessageResponse>('/auth/password', body),
  })
}

// ── Devices ───────────────────────────────────────────────────────────────────

export function useDevices(): UseQueryResult<DeviceListResponse> {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: accountKeys.devices(),
    queryFn:  () => apiClient.get<DeviceListResponse>('/auth/devices'),
    enabled:  !!accessToken,
    staleTime: 30_000,
  })
}

/** DELETE /auth/devices/:deviceId — sign out one device. */
export function useRevokeDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: string) => apiClient.delete<void>(`/auth/devices/${encodeURIComponent(deviceId)}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: accountKeys.devices() }),
  })
}

// ── Deactivate (soft delete) ──────────────────────────────────────────────────

/** DELETE /auth/me — deactivates the account; restorable by signing in within 30 days. */
export function useDeactivateAccount() {
  return useMutation({
    mutationFn: (body: DeactivateAccountInput) => apiClient.delete<MessageResponse>('/auth/me', body),
  })
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * GET /auth/export — the server answers with a JSON attachment. apiClient
 * parses JSON, so we receive the document as an object and hand the browser a
 * Blob to save; the filename mirrors the server's Content-Disposition.
 */
export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const data = await apiClient.get<{ exportedAt: string }>('/auth/export')
      const stamp = data.exportedAt.slice(0, 10)
      const blob  = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement('a')
      a.href = url
      a.download = `just-train-export-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  })
}

// ── Forgot / reset (public) ───────────────────────────────────────────────────

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: ForgotPasswordInput) => apiClient.post<MessageResponse>('/auth/forgot-password', body),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: ResetPasswordInput) => apiClient.post<MessageResponse>('/auth/reset-password', body),
  })
}
