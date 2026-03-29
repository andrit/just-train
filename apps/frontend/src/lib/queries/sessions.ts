// ------------------------------------------------------------
// lib/queries/sessions.ts — TanStack Query hooks for session data
//
// CACHE KEYS:
//   ['sessions']                    → session list (filtered)
//   ['sessions', id]                → single session detail (full tree)
//
// SESSION LIFECYCLE:
//   1. POST /sessions                     → creates session, status=planned
//   2. PATCH /sessions/:id status=in_progress → starts session (sets startTime)
//   3. POST /sessions/:id/workouts        → add workout block
//   4. POST /workouts/:id/exercises       → add exercise to block
//   5. POST /session-exercises/:id/sets   → log a set
//   6. PATCH /sessions/:id status=completed → end session (sets endTime)
// ------------------------------------------------------------

import {
  useQuery, useMutation, useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { apiClient }        from '@/lib/api'
import { useAuthStore }     from '@/store/authStore'
import { offlineAwareApi }  from '@/lib/offlineAwareApi'
import type {
  SessionDetailResponse,
  SessionListResponse,
  SessionSummaryResponse,
  WorkoutResponse,
  SessionExerciseResponse,
  SetResponse,
} from '@trainer-app/shared'

// ── Query key factory ─────────────────────────────────────────────────────────

export const sessionKeys = {
  all:    ()         => ['sessions'] as const,
  list:   (filters?: SessionFilters) => ['sessions', 'list', filters ?? {}] as const,
  detail: (id: string) => ['sessions', id] as const,
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface SessionFilters {
  clientId?: string
  status?:   'planned' | 'in_progress' | 'completed' | 'cancelled'
}

// ── Session list ──────────────────────────────────────────────────────────────

export function useSessions(filters?: SessionFilters): UseQueryResult<SessionListResponse> {
  const accessToken = useAuthStore((s) => s.accessToken)
  const params = new URLSearchParams()
  if (filters?.clientId) params.set('clientId', filters.clientId)
  if (filters?.status)   params.set('status', filters.status)
  const qs = params.toString()

  return useQuery({
    queryKey: sessionKeys.list(filters),
    queryFn:  () => apiClient<SessionListResponse>(`/sessions${qs ? `?${qs}` : ''}`),
    enabled:  !!accessToken,
    staleTime: 1000 * 30,
  })
}

// ── Active session (in_progress) ──────────────────────────────────────────────

export function useActiveSession(): UseQueryResult<SessionSummaryResponse | null> {
  return useQuery({
    queryKey: ['sessions', 'active'],
    queryFn:  async () => {
      const list = await apiClient<SessionListResponse>('/sessions?status=in_progress')
      return list[0] ?? null
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 30, // Poll every 30s to detect session started elsewhere
  })
}

// ── Session detail ────────────────────────────────────────────────────────────

export function useSession(id: string | null): UseQueryResult<SessionDetailResponse> {
  return useQuery({
    queryKey: sessionKeys.detail(id ?? ''),
    queryFn:  () => apiClient<SessionDetailResponse>(`/sessions/${id}`),
    enabled:  !!id,
    staleTime: 1000 * 10,
  })
}

// ── Create session ────────────────────────────────────────────────────────────

export interface CreateSessionInput {
  clientId:   string
  date:       string       // YYYY-MM-DD
  templateId?: string | null
  name?:      string
}

export function useCreateSession(): UseMutationResult<SessionSummaryResponse, Error, CreateSessionInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiClient.post<SessionSummaryResponse>('/sessions', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionKeys.all() })
    },
  })
}

// ── Update session (status, notes, subjective scores) ────────────────────────

export interface UpdateSessionInput {
  id:           string
  status?:      'planned' | 'in_progress' | 'completed' | 'cancelled'
  name?:        string
  notes?:       string
  energyLevel?: number
  mobilityFeel?: number
  stressLevel?: number
  sessionNotes?: string
}

export function useUpdateSession(): UseMutationResult<SessionSummaryResponse, Error, UpdateSessionInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      apiClient.patch<SessionSummaryResponse>(`/sessions/${id}`, body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: sessionKeys.all() })
    },
  })
}

// ── Start session ─────────────────────────────────────────────────────────────

export function useStartSession(): UseMutationResult<SessionSummaryResponse, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) =>
      apiClient.patch<SessionSummaryResponse>(`/sessions/${id}`, { status: 'in_progress' }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: sessionKeys.all() })
    },
  })
}

// ── End session ───────────────────────────────────────────────────────────────

export interface EndSessionInput {
  id:           string
  energyLevel:  number
  mobilityFeel: number
  stressLevel:  number
  sessionNotes?: string
}

export function useEndSession(): UseMutationResult<SessionSummaryResponse, Error, EndSessionInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      offlineAwareApi.patch<SessionSummaryResponse>(
        `/sessions/${id}`,
        { ...body, status: 'completed', endTime: new Date().toISOString() },
        `End session`,
      ),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(data.id) })
      qc.invalidateQueries({ queryKey: sessionKeys.all() })
    },
  })
}

// ── Add workout block ─────────────────────────────────────────────────────────

export interface AddWorkoutInput {
  sessionId:   string
  workoutType: string
  orderIndex?: number
  notes?:      string
}

export function useAddWorkout(): UseMutationResult<WorkoutResponse, Error, AddWorkoutInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, ...body }) =>
      offlineAwareApi.post<WorkoutResponse>(
        `/sessions/${sessionId}/workouts`,
        body,
        `Add ${(body as { workoutType?: string }).workoutType ?? ''} workout block`,
      ),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) })
    },
  })
}

// ── Add exercise to workout ───────────────────────────────────────────────────

export interface AddExerciseInput {
  workoutId:   string
  sessionId:   string   // for cache invalidation
  exerciseId:  string
  orderIndex?: number
  targetSets?:            number
  targetReps?:            number
  targetWeight?:          number
  targetWeightUnit?:      string
  targetDurationSeconds?: number
  targetDistance?:        number
  targetIntensity?:       'low' | 'moderate' | 'high' | 'max'
}

export function useAddExercise(): UseMutationResult<SessionExerciseResponse, Error, AddExerciseInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workoutId, sessionId: _sessionId, ...body }) =>
      offlineAwareApi.post<SessionExerciseResponse>(
        `/workouts/${workoutId}/exercises`,
        body,
        `Add exercise to workout`,
      ),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) })
    },
  })
}

// ── Log a set ─────────────────────────────────────────────────────────────────

export interface LogSetInput {
  sessionExerciseId: string
  sessionId:         string
  setNumber:         number
  reps?:             number
  weight?:           number
  weightUnit?:       string
  durationSeconds?:  number
  distance?:         number
  intensity?:        string
  rpe?:              number
  notes?:            string
}

export function useLogSet(): UseMutationResult<SetResponse, Error, LogSetInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionExerciseId, sessionId: _sid, ...body }) =>
      offlineAwareApi.post<SetResponse>(
        `/session-exercises/${sessionExerciseId}/sets`,
        body,
        `Log set — set ${body.setNumber}`,
      ),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) })
    },
  })
}

// ── Edit a set ────────────────────────────────────────────────────────────────

export interface EditSetInput {
  setId:     string
  sessionId: string
  reps?:     number
  weight?:   number
  rpe?:      number
  notes?:    string
}

export function useEditSet(): UseMutationResult<SetResponse, Error, EditSetInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ setId, sessionId: _sid, ...body }) =>
      apiClient.patch<SetResponse>(`/sets/${setId}`, body),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) })
    },
  })
}

// ── Delete workout block ──────────────────────────────────────────────────────

export function useDeleteWorkout(): UseMutationResult<void, Error, { workoutId: string; sessionId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workoutId, sessionId }) =>
      apiClient.delete<void>(`/sessions/${sessionId}/workouts/${workoutId}`),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) })
    },
  })
}

// ── Delete session exercise ───────────────────────────────────────────────────

export function useDeleteSessionExercise(): UseMutationResult<void, Error, { sessionExerciseId: string; workoutId: string; sessionId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workoutId, sessionExerciseId }) =>
      apiClient.delete<void>(`/workouts/${workoutId}/exercises/${sessionExerciseId}`),
    onSuccess: (_, { sessionId }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) })
    },
  })
}

// ── Planned sessions ──────────────────────────────────────────────────────────

export function usePlannedSessions(clientId?: string): UseQueryResult<SessionListResponse> {
  const filters = { status: 'planned' as const, ...(clientId && { clientId }) }
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)) as Record<string, string>
  ).toString()

  return useQuery({
    queryKey: sessionKeys.list(filters),
    queryFn:  () => apiClient<SessionListResponse>(`/sessions?${qs}`),
    staleTime: 30_000,
  })
}

// ── Execute a planned session (planned → in_progress) ────────────────────────

export interface ExecuteSessionInput {
  id: string
}

export function useExecuteSession(): UseMutationResult<void, Error, ExecuteSessionInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) =>
      apiClient.patch<void>(`/sessions/${id}`, {
        status:    'in_progress',
        startTime: new Date().toISOString(),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(id) })
      qc.invalidateQueries({ queryKey: sessionKeys.all() })
    },
  })
}

// ── Update session name ───────────────────────────────────────────────────────

export interface UpdateSessionNameInput {
  id:   string
  name: string
}

export function useUpdateSessionName(): UseMutationResult<void, Error, UpdateSessionNameInput> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }) => apiClient.patch<void>(`/sessions/${id}`, { name }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: sessionKeys.detail(id) })
      qc.invalidateQueries({ queryKey: sessionKeys.all() })
    },
  })
}

// ── Discard (delete) a session ────────────────────────────────────────────────

export function useDiscardSession(): UseMutationResult<void, Error, { id: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }) => apiClient.delete<void>(`/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: sessionKeys.all() })
    },
  })
}

// ── Reorder workout blocks ────────────────────────────────────────────────────

export function useReorderWorkouts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, orderedIds }: { sessionId: string; orderedIds: string[] }) =>
      apiClient.patch(`/sessions/${sessionId}/workouts/reorder`, { orderedIds }),
    onSuccess: (_data, { sessionId }) =>
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) }),
  })
}

// ── Reorder exercises within a workout block ──────────────────────────────────

export function useReorderExercises() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workoutId, orderedIds }: { sessionId: string; workoutId: string; orderedIds: string[] }) =>
      apiClient.patch(`/workouts/${workoutId}/exercises/reorder`, { orderedIds }),
    onSuccess: (_data, { sessionId }) =>
      qc.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) }),
  })
}
