// ------------------------------------------------------------
// lib/queries/exercises.ts — TanStack Query hooks for the exercise library
//
// All server state for exercises lives here.
// Components never call apiClient directly — they use these hooks.
//
// CACHE KEYS:
//   ['exercises']              → exercise list (with optional filters)
//   ['exercises', id]          → single exercise detail
//   ['bodyParts']              → body part list (rarely changes — long staleTime)
//
// MUTATION PATTERNS:
//   All mutations invalidate relevant list queries on success so the UI
//   stays in sync without manual cache updates. For create/update we also
//   set the individual exercise in the cache to avoid a redundant fetch.
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { apiClient }  from '@/lib/api'
import type {
  ExerciseListResponse,
  ExerciseDetailResponse,
  ExerciseSummaryResponse,
  BodyPartListResponse,
  ExerciseMediaResponse,
} from '@trainer-app/shared'

// ── Query key factory ─────────────────────────────────────────────────────────

export const exerciseKeys = {
  all:    () => ['exercises'] as const,
  list:   (filters?: ExerciseFilters) => ['exercises', 'list', filters ?? {}] as const,
  detail: (id: string) => ['exercises', id] as const,
  bodyParts: () => ['bodyParts'] as const,
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface ExerciseFilters {
  search?:     string
  bodyPartId?: string
  workoutType?: string
  equipment?:  string
  isDraft?:    boolean
}

// ── Body Parts ────────────────────────────────────────────────────────────────

/**
 * Fetch all body parts. Used to populate the filter chips and the exercise form.
 * Body parts change extremely rarely — stale after 24 hours.
 */
export function useBodyParts(): UseQueryResult<BodyPartListResponse> {
  return useQuery({
    queryKey: exerciseKeys.bodyParts(),
    queryFn:  () => apiClient<BodyPartListResponse>('/body-parts'),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

// ── Exercise List ─────────────────────────────────────────────────────────────

/**
 * Fetch the exercise library with optional filters.
 * Re-fetches automatically when filters change.
 */
export function useExercises(filters?: ExerciseFilters): UseQueryResult<ExerciseListResponse> {
  // Build query string from filters
  const params = new URLSearchParams()
  if (filters?.search)     params.set('search', filters.search)
  if (filters?.bodyPartId) params.set('bodyPartId', filters.bodyPartId)
  if (filters?.workoutType) params.set('workoutType', filters.workoutType)
  if (filters?.equipment)  params.set('equipment', filters.equipment)
  if (filters?.isDraft !== undefined) params.set('isDraft', String(filters.isDraft))

  const qs = params.toString()

  return useQuery({
    queryKey: exerciseKeys.list(filters),
    queryFn:  () => apiClient<ExerciseListResponse>(`/exercises${qs ? `?${qs}` : ''}`),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

// ── Exercise Detail ───────────────────────────────────────────────────────────

/**
 * Fetch full exercise detail including all media.
 * Only called when the trainer opens an exercise drawer/modal.
 */
export function useExercise(id: string | null): UseQueryResult<ExerciseDetailResponse> {
  return useQuery({
    queryKey: exerciseKeys.detail(id ?? ''),
    queryFn:  () => apiClient<ExerciseDetailResponse>(`/exercises/${id}`),
    enabled:  !!id,
  })
}

// ── Create Exercise ───────────────────────────────────────────────────────────

export interface CreateExerciseInput {
  name:        string
  workoutType: string
  bodyPartId:  string
  equipment?:  string
  difficulty?: string
  description?: string
  instructions?: string
}

export function useCreateExercise(): UseMutationResult<ExerciseSummaryResponse, Error, CreateExerciseInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiClient<ExerciseSummaryResponse>('/exercises', {
      method: 'POST',
      body:   JSON.stringify(body),
    }),
    onSuccess: () => {
      // Invalidate all exercise lists — new exercise should appear
      qc.invalidateQueries({ queryKey: exerciseKeys.all() })
    },
  })
}

// ── Update Exercise ───────────────────────────────────────────────────────────

export interface UpdateExerciseInput extends Partial<CreateExerciseInput> {
  id: string
}

export function useUpdateExercise(): UseMutationResult<ExerciseDetailResponse, Error, UpdateExerciseInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => apiClient<ExerciseDetailResponse>(`/exercises/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(body),
    }),
    onSuccess: (data) => {
      // Update the individual cache entry
      qc.setQueryData(exerciseKeys.detail(data.id), data)
      // Invalidate lists so the summary card reflects changes
      qc.invalidateQueries({ queryKey: exerciseKeys.all() })
    },
  })
}

// ── Delete Exercise ───────────────────────────────────────────────────────────

export function useDeleteExercise(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient<void>(`/exercises/${id}`, { method: 'DELETE' }),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: exerciseKeys.detail(id) })
      qc.invalidateQueries({ queryKey: exerciseKeys.all() })
    },
  })
}

// ── Upload Media ──────────────────────────────────────────────────────────────

export interface UploadMediaInput {
  exerciseId: string
  file:       File
  isPrimary?: boolean
}

export function useUploadMedia(): UseMutationResult<ExerciseMediaResponse, Error, UploadMediaInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ exerciseId, file, isPrimary }) => {
      const formData = new FormData()
      formData.append('file', file)

      const qs = isPrimary ? '?isPrimary=true' : ''

      // Pass FormData as body. api.ts detects non-string body and omits
      // Content-Type so the browser sets it with the correct multipart boundary.
      return apiClient<ExerciseMediaResponse>(
        `/exercises/${exerciseId}/media${qs}`,
        { method: 'POST', body: formData },
      )
    },
    onSuccess: (_, { exerciseId }) => {
      qc.invalidateQueries({ queryKey: exerciseKeys.detail(exerciseId) })
    },
  })
}

// ── Delete Media ──────────────────────────────────────────────────────────────

export function useDeleteMedia(): UseMutationResult<void, Error, { exerciseId: string; mediaId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ exerciseId, mediaId }) =>
      apiClient<void>(`/exercises/${exerciseId}/media/${mediaId}`, { method: 'DELETE' }),
    onSuccess: (_, { exerciseId }) => {
      qc.invalidateQueries({ queryKey: exerciseKeys.detail(exerciseId) })
    },
  })
}

// ── Set Primary Media ─────────────────────────────────────────────────────────

export function useSetPrimaryMedia(): UseMutationResult<ExerciseMediaResponse, Error, { exerciseId: string; mediaId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ exerciseId, mediaId }) =>
      apiClient<ExerciseMediaResponse>(`/exercises/${exerciseId}/media/${mediaId}/primary`, { method: 'PATCH' }),
    onSuccess: (_, { exerciseId }) => {
      qc.invalidateQueries({ queryKey: exerciseKeys.detail(exerciseId) })
      qc.invalidateQueries({ queryKey: exerciseKeys.all() })
    },
  })
}
