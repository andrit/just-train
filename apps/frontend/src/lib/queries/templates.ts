// ------------------------------------------------------------
// lib/queries/templates.ts — TanStack Query hooks for templates
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
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
    queryFn:  () => apiClient<TemplateListResponse>('/templates'),
    staleTime: 1000 * 60 * 5,
  })
}

export function useTemplate(id: string | null): UseQueryResult<TemplateDetailResponse> {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    queryFn:  () => apiClient<TemplateDetailResponse>(`/templates/${id}`),
    enabled:  !!id,
    staleTime: 1000 * 60 * 5,
  })
}
