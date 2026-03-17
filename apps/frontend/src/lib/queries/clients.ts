// ------------------------------------------------------------
// lib/queries/clients.ts — TanStack Query hooks for client data
//
// All server state for clients, goals, and snapshots lives here.
// Components never call apiClient directly — they use these hooks.
//
// CACHE KEYS:
//   ['clients']                     → external client list
//   ['clients', 'self']             → self-client record
//   ['clients', id]                 → single client detail
//   ['clients', id, 'goals']        → goal list for a client
//   ['clients', id, 'snapshots']    → snapshot list for a client
//   ['clients', id, 'snapshots', 'latest'] → most recent snapshot
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import type {
  ClientResponse,
  ClientListResponse,
  ClientGoalResponse,
  ClientGoalListResponse,
  ClientSnapshotResponse,
  ClientSnapshotListResponse,
  CreateClientGoalInput,
  UpdateClientGoalInput,
  CreateClientSnapshotInput,
  ClientKpiResponse,
} from '@trainer-app/shared'

// ── Query key factory ─────────────────────────────────────────────────────────

export const clientKeys = {
  all:            ()         => ['clients'] as const,
  self:           ()         => ['clients', 'self'] as const,
  detail:         (id: string) => ['clients', id] as const,
  goals:          (id: string) => ['clients', id, 'goals'] as const,
  snapshots:      (id: string) => ['clients', id, 'snapshots'] as const,
  latestSnapshot: (id: string) => ['clients', id, 'snapshots', 'latest'] as const,
}

// ── Client list ───────────────────────────────────────────────────────────────

export function useClients(): UseQueryResult<ClientListResponse> {
  return useQuery({
    queryKey: clientKeys.all(),
    queryFn:  () => apiClient<ClientListResponse>('/clients'),
    staleTime: 1000 * 60 * 2,
  })
}

// ── Self-client ───────────────────────────────────────────────────────────────

export function useSelfClient(): UseQueryResult<ClientResponse> {
  return useQuery({
    queryKey: clientKeys.self(),
    queryFn:  () => apiClient<ClientResponse>('/clients/self'),
    staleTime: 1000 * 60 * 5,
  })
}

// ── Single client ─────────────────────────────────────────────────────────────

export function useClient(id: string | null): UseQueryResult<ClientResponse> {
  return useQuery({
    queryKey: clientKeys.detail(id ?? ''),
    queryFn:  () => apiClient<ClientResponse>(`/clients/${id}`),
    enabled:  !!id,
    staleTime: 1000 * 60 * 2,
  })
}

// ── Create client ─────────────────────────────────────────────────────────────

export interface CreateClientInput {
  name:                string
  email?:              string
  phone?:              string
  primaryFocus?:       string
  secondaryFocus?:     string
  progressionState?:   string
  startDate?:          string
  notes?:              string
  weeklySessionTarget?: number
  show1rmEstimate?:    boolean
}

export function useCreateClient(): UseMutationResult<ClientResponse, Error, CreateClientInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiClient.post<ClientResponse>('/clients', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all() })
    },
  })
}

// ── Update client ─────────────────────────────────────────────────────────────

export interface UpdateClientInput extends Partial<CreateClientInput> {
  id: string
}

export function useUpdateClient(): UseMutationResult<ClientResponse, Error, UpdateClientInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => apiClient.patch<ClientResponse>(`/clients/${id}`, body),
    onSuccess: (data) => {
      qc.setQueryData(clientKeys.detail(data.id), data)
      qc.invalidateQueries({ queryKey: clientKeys.all() })
      // If it's the self-client, invalidate that too
      if (data.isSelf) qc.invalidateQueries({ queryKey: clientKeys.self() })
    },
  })
}

// ── Deactivate client ─────────────────────────────────────────────────────────

export function useDeactivateClient(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => apiClient.delete<void>(`/clients/${id}`),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: clientKeys.detail(id) })
      qc.invalidateQueries({ queryKey: clientKeys.all() })
    },
  })
}

// ── Goals ─────────────────────────────────────────────────────────────────────

export function useClientGoals(clientId: string | null): UseQueryResult<ClientGoalListResponse> {
  return useQuery({
    queryKey: clientKeys.goals(clientId ?? ''),
    queryFn:  () => apiClient<ClientGoalListResponse>(`/clients/${clientId}/goals`),
    enabled:  !!clientId,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCreateGoal(): UseMutationResult<ClientGoalResponse, Error, { clientId: string } & CreateClientGoalInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, ...body }) =>
      apiClient.post<ClientGoalResponse>(`/clients/${clientId}/goals`, body),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: clientKeys.goals(clientId) })
    },
  })
}

export function useUpdateGoal(): UseMutationResult<ClientGoalResponse, Error, { clientId: string; goalId: string } & UpdateClientGoalInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, goalId, ...body }) =>
      apiClient.patch<ClientGoalResponse>(`/clients/${clientId}/goals/${goalId}`, body),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: clientKeys.goals(clientId) })
    },
  })
}

export function useDeleteGoal(): UseMutationResult<void, Error, { clientId: string; goalId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, goalId }) =>
      apiClient.delete<void>(`/clients/${clientId}/goals/${goalId}`),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: clientKeys.goals(clientId) })
    },
  })
}

// ── Snapshots ─────────────────────────────────────────────────────────────────

export function useClientSnapshots(clientId: string | null): UseQueryResult<ClientSnapshotListResponse> {
  return useQuery({
    queryKey: clientKeys.snapshots(clientId ?? ''),
    queryFn:  () => apiClient<ClientSnapshotListResponse>(`/clients/${clientId}/snapshots`),
    enabled:  !!clientId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useLatestSnapshot(clientId: string | null): UseQueryResult<ClientSnapshotResponse> {
  return useQuery({
    queryKey: clientKeys.latestSnapshot(clientId ?? ''),
    queryFn:  () => apiClient<ClientSnapshotResponse>(`/clients/${clientId}/snapshots/latest`),
    enabled:  !!clientId,
    staleTime: 1000 * 60 * 5,
    retry: false, // 404 = no snapshots yet — don't retry
  })
}

export function useCreateSnapshot(): UseMutationResult<ClientSnapshotResponse, Error, { clientId: string } & CreateClientSnapshotInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, ...body }) =>
      apiClient.post<ClientSnapshotResponse>(`/clients/${clientId}/snapshots`, body),
    onSuccess: (_, { clientId }) => {
      qc.invalidateQueries({ queryKey: clientKeys.snapshots(clientId) })
      qc.invalidateQueries({ queryKey: clientKeys.latestSnapshot(clientId) })
    },
  })
}

// ── Client KPIs ───────────────────────────────────────────────────────────────

export function useClientKpis(clientId: string | null | undefined): UseQueryResult<ClientKpiResponse> {
  return useQuery({
    queryKey: ['clients', clientId, 'kpis'],
    queryFn:  () => apiClient<ClientKpiResponse>(`/clients/${clientId}/kpis`),
    enabled:  !!clientId,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}
