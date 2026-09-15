// ------------------------------------------------------------
// lib/queries/account.ts — mutations for the signed-in user's own account
// (password, devices, export, deactivate). Distinct from usePreferences,
// which is the settings surface; these are security actions.
// ------------------------------------------------------------

import { useMutation } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import type { ChangePasswordInput } from '@trainer-app/shared'

interface MessageResponse { message: string }

/** PATCH /auth/password — re-proves the current password; other devices are signed out. */
export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordInput) => apiClient.patch<MessageResponse>('/auth/password', body),
  })
}
