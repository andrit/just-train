// ------------------------------------------------------------
// lib/queries/account.ts — the signed-in user's own account
// (password, devices, export, deactivate). Distinct from usePreferences,
// which is the settings surface; these are security actions.
// ------------------------------------------------------------

import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { apiClient }    from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type { ChangePasswordInput, DeactivateAccountInput, DeviceListResponse } from '@trainer-app/shared'

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
