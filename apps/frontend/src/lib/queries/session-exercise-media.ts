// ------------------------------------------------------------
// lib/queries/session-exercise-media.ts — TanStack Query hooks for form check clips (v2.12.0)
//
// CACHE KEYS:
//   ['session-exercise-media', sessionExerciseId] → media list for one exercise
//
// MUTATION PATTERNS:
//   Upload/delete invalidate the media list so the badge count stays in sync.
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { apiClient }   from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type {
  SessionExerciseMediaResponse,
  SessionExerciseMediaListResponse,
} from '@trainer-app/shared'

// ── Query key factory ─────────────────────────────────────────────────────────

export const sessionExerciseMediaKeys = {
  list: (sessionExerciseId: string) => ['session-exercise-media', sessionExerciseId] as const,
}

// ── List media ────────────────────────────────────────────────────────────────

export function useSessionExerciseMedia(
  sessionExerciseId: string | null,
): UseQueryResult<SessionExerciseMediaListResponse> {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: sessionExerciseMediaKeys.list(sessionExerciseId ?? ''),
    queryFn:  () => apiClient<SessionExerciseMediaListResponse>(
      `/session-exercises/${sessionExerciseId}/media`,
    ),
    enabled: !!accessToken && !!sessionExerciseId,
  })
}

// ── Upload media ──────────────────────────────────────────────────────────────

export interface UploadSessionExerciseMediaInput {
  sessionExerciseId: string
  file:              File | Blob
  durationSeconds?:  number  // for video
  caption?:          string
}

export function useUploadSessionExerciseMedia(): UseMutationResult<
  SessionExerciseMediaResponse, Error, UploadSessionExerciseMediaInput
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ sessionExerciseId, file, durationSeconds, caption }) => {
      const formData = new FormData()
      formData.append('file', file)

      const params = new URLSearchParams()
      if (durationSeconds != null) params.set('durationSeconds', String(durationSeconds))
      if (caption) params.set('caption', caption)

      const qs = params.toString()

      return apiClient<SessionExerciseMediaResponse>(
        `/session-exercises/${sessionExerciseId}/media${qs ? `?${qs}` : ''}`,
        { method: 'POST', body: formData },
      )
    },
    onSuccess: (_, { sessionExerciseId }) => {
      qc.invalidateQueries({ queryKey: sessionExerciseMediaKeys.list(sessionExerciseId) })
    },
  })
}

// ── Delete media ──────────────────────────────────────────────────────────────

export interface DeleteSessionExerciseMediaInput {
  mediaId:           string
  sessionExerciseId: string  // for cache invalidation
}

export function useDeleteSessionExerciseMedia(): UseMutationResult<
  void, Error, DeleteSessionExerciseMediaInput
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mediaId }) =>
      apiClient<void>(`/session-exercise-media/${mediaId}`, { method: 'DELETE' }),
    onSuccess: (_, { sessionExerciseId }) => {
      qc.invalidateQueries({ queryKey: sessionExerciseMediaKeys.list(sessionExerciseId) })
    },
  })
}
