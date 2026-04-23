// ------------------------------------------------------------
// lib/queries/challenges.ts — TanStack Query hooks for challenges (v2.12.0)
//
// CACHE KEYS:
//   ['clients', clientId, 'challenges']          → challenge list
//   ['clients', clientId, 'challenges', status]  → filtered by status
//
// Works identically for trainer-managed clients and self-clients.
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { apiClient }   from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import type {
  ChallengeResponse,
  ChallengeListResponse,
  CreateChallengeInput,
  UpdateChallengeInput,
} from '@trainer-app/shared'

// ── Query key factory ─────────────────────────────────────────────────────────

export const challengeKeys = {
  list:     (clientId: string, status?: string) =>
    status
      ? ['clients', clientId, 'challenges', status] as const
      : ['clients', clientId, 'challenges'] as const,
  allForClient: (clientId: string) => ['clients', clientId, 'challenges'] as const,
}

// ── List challenges ───────────────────────────────────────────────────────────

export function useChallenges(
  clientId: string | null,
  status?: string,
): UseQueryResult<ChallengeListResponse> {
  const accessToken = useAuthStore((s) => s.accessToken)
  const qs = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: challengeKeys.list(clientId ?? '', status),
    queryFn:  () => apiClient<ChallengeListResponse>(
      `/clients/${clientId}/challenges${qs}`,
    ),
    enabled: !!accessToken && !!clientId,
  })
}

// ── Create challenge ──────────────────────────────────────────────────────────

export interface CreateChallengeVars {
  clientId: string
  body:     CreateChallengeInput
}

export function useCreateChallenge(): UseMutationResult<ChallengeResponse, Error, CreateChallengeVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, body }) =>
      apiClient<ChallengeResponse>(`/clients/${clientId}/challenges`, {
        method: 'POST',
        body:   JSON.stringify(body),
      }),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: challengeKeys.allForClient(clientId) })
    },
  })
}

// ── Update challenge ──────────────────────────────────────────────────────────

export interface UpdateChallengeVars {
  challengeId: string
  clientId:    string   // for cache invalidation
  body:        UpdateChallengeInput
}

export function useUpdateChallenge(): UseMutationResult<ChallengeResponse, Error, UpdateChallengeVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ challengeId, body }) =>
      apiClient<ChallengeResponse>(`/challenges/${challengeId}`, {
        method: 'PATCH',
        body:   JSON.stringify(body),
      }),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: challengeKeys.allForClient(clientId) })
    },
  })
}

// ── Cancel challenge ──────────────────────────────────────────────────────────

export interface CancelChallengeVars {
  challengeId: string
  clientId:    string
}

export function useCancelChallenge(): UseMutationResult<ChallengeResponse, Error, CancelChallengeVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ challengeId }) =>
      apiClient<ChallengeResponse>(`/challenges/${challengeId}`, { method: 'DELETE' }),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: challengeKeys.allForClient(clientId) })
    },
  })
}
