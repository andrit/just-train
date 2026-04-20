// ------------------------------------------------------------
// lib/queries/snapshot-media.ts — TanStack Query hooks for progress photos (v2.12.0)
//
// Components never call apiClient directly — they use these hooks.
//
// CACHE KEYS:
//   ['clients', id, 'progress-photos'] → progress photos grouped by snapshot
//
// MUTATION PATTERNS:
//   Upload/delete/update invalidate the progress-photos list so the
//   timeline stays in sync.
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { apiClient }   from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type {
  SnapshotMediaResponse,
  ProgressPhotoGroupListResponse,
  UpdateSnapshotMediaInput,
} from '@trainer-app/shared'

// ── Query key factory ─────────────────────────────────────────────────────────

export const snapshotMediaKeys = {
  progressPhotos: (clientId: string) => ['clients', clientId, 'progress-photos'] as const,
}

// ── Progress photos list ──────────────────────────────────────────────────────

/**
 * Fetch all progress photos for a client, grouped by snapshot date.
 * Powers the ProgressPhotoTimeline component.
 */
export function useProgressPhotos(clientId: string | null): UseQueryResult<ProgressPhotoGroupListResponse> {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: snapshotMediaKeys.progressPhotos(clientId ?? ''),
    queryFn:  () => apiClient<ProgressPhotoGroupListResponse>(`/clients/${clientId}/progress-photos`),
    enabled:  !!accessToken && !!clientId,
  })
}

// ── Upload progress photo ─────────────────────────────────────────────────────

export interface UploadSnapshotMediaInput {
  snapshotId: string
  clientId:   string  // for cache invalidation
  file:       File
  pose:       string
  caption?:   string
}

export function useUploadSnapshotMedia(): UseMutationResult<SnapshotMediaResponse, Error, UploadSnapshotMediaInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ snapshotId, file, pose, caption }) => {
      const formData = new FormData()
      formData.append('file', file)

      const params = new URLSearchParams({ pose })
      if (caption) params.set('caption', caption)

      return apiClient<SnapshotMediaResponse>(
        `/snapshots/${snapshotId}/media?${params.toString()}`,
        { method: 'POST', body: formData },
      )
    },
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: snapshotMediaKeys.progressPhotos(clientId) })
    },
  })
}

// ── Update progress photo ─────────────────────────────────────────────────────

export interface UpdateSnapshotMediaVars {
  mediaId:  string
  clientId: string  // for cache invalidation
  body:     UpdateSnapshotMediaInput
}

export function useUpdateSnapshotMedia(): UseMutationResult<SnapshotMediaResponse, Error, UpdateSnapshotMediaVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mediaId, body }) =>
      apiClient<SnapshotMediaResponse>(`/snapshot-media/${mediaId}`, {
        method: 'PATCH',
        body:   JSON.stringify(body),
      }),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: snapshotMediaKeys.progressPhotos(clientId) })
    },
  })
}

// ── Delete progress photo ─────────────────────────────────────────────────────

export interface DeleteSnapshotMediaVars {
  mediaId:  string
  clientId: string  // for cache invalidation
}

export function useDeleteSnapshotMedia(): UseMutationResult<void, Error, DeleteSnapshotMediaVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mediaId }) =>
      apiClient<void>(`/snapshot-media/${mediaId}`, { method: 'DELETE' }),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: snapshotMediaKeys.progressPhotos(clientId) })
    },
  })
}
