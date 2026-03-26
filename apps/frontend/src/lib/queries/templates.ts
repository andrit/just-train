// ------------------------------------------------------------
// lib/queries/templates.ts — TanStack Query hooks for templates
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type {
  TemplateListResponse,
  TemplateDetailResponse,
  TemplateSummaryResponse,
} from '@trainer-app/shared'

export const templateKeys = {
  all:    ()           => ['templates'] as const,
  detail: (id: string) => ['templates', id] as const,
}

export function useTemplates(search?: string): UseQueryResult<TemplateListResponse> {
  const accessToken = useAuthStore((s) => s.accessToken)
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return useQuery({
    queryKey: [...templateKeys.all(), { search }],
    queryFn:  () => apiClient.get<TemplateListResponse>(`/templates${qs}`),
    enabled:  !!accessToken,
    staleTime: 1000 * 60 * 5,
  })
}

export function useTemplate(id: string | null): UseQueryResult<TemplateDetailResponse> {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    queryFn:  () => apiClient.get<TemplateDetailResponse>(`/templates/${id}`),
    enabled:  !!accessToken && !!id,
    staleTime: 1000 * 60 * 5,
  })
}

// ── Create ────────────────────────────────────────────────────────────────────

interface CreateTemplateInput {
  name:        string
  description?: string
  notes?:       string
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateTemplateInput) =>
      apiClient.post<TemplateSummaryResponse>('/templates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all() }),
  })
}

// ── Update ────────────────────────────────────────────────────────────────────

interface UpdateTemplateInput {
  id:           string
  name?:        string
  description?: string
  notes?:       string
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateTemplateInput) =>
      apiClient.patch<TemplateSummaryResponse>(`/templates/${id}`, body),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: templateKeys.all() })
      qc.invalidateQueries({ queryKey: templateKeys.detail(id) })
    },
  })
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all() }),
  })
}

// ── Fork ──────────────────────────────────────────────────────────────────────

export function useForkTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      apiClient.post<TemplateDetailResponse>(`/templates/${id}/fork`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all() }),
  })
}

// ── Add workout block ─────────────────────────────────────────────────────────

export function useAddTemplateBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, workoutType, orderIndex }: {
      templateId: string; workoutType: string; orderIndex: number
    }) =>
      apiClient.post(`/templates/${templateId}/workouts`, { workoutType, orderIndex }),
    onSuccess: (_data, { templateId }) =>
      qc.invalidateQueries({ queryKey: templateKeys.detail(templateId) }),
  })
}

// ── Add exercise to block ─────────────────────────────────────────────────────

export function useAddTemplateExercise() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ templateWorkoutId, exerciseId, orderIndex }: {
      templateId: string; templateWorkoutId: string
      exerciseId: string; orderIndex: number
    }) =>
      apiClient.post(`/template-workouts/${templateWorkoutId}/exercises`, {
        exerciseId, orderIndex,
      }),
    onSuccess: (_data, { templateId }) =>
      qc.invalidateQueries({ queryKey: templateKeys.detail(templateId) }),
  })
}
