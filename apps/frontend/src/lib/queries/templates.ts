// ------------------------------------------------------------
// lib/queries/templates.ts — TanStack Query hooks for templates
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import type {
  TemplateListResponse,
  TemplateDetailResponse,
  TemplateSummaryResponse,
} from '@trainer-app/shared'

export const templateKeys = {
  all:    ()           => ['templates'] as const,
  detail: (id: string) => ['templates', id] as const,
}

export function useTemplates(): UseQueryResult<TemplateListResponse> {
  return useQuery({
    queryKey: templateKeys.all(),
    queryFn:  () => apiClient.get<TemplateListResponse>('/templates'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useTemplate(id: string | null): UseQueryResult<TemplateDetailResponse> {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    queryFn:  () => apiClient.get<TemplateDetailResponse>(`/templates/${id}`),
    enabled:  !!id,
    staleTime: 1000 * 60 * 5,
  })
}

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

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all() }),
  })
}

export function useForkTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      apiClient.post<TemplateDetailResponse>(`/templates/${id}/fork`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: templateKeys.all() }),
  })
}
