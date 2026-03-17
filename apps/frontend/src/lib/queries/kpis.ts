// ------------------------------------------------------------
// lib/queries/kpis.ts — TanStack Query hook for client KPIs
// ------------------------------------------------------------

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { apiClient }                     from '@/lib/api'
import type { ClientKpiResponse }        from '@trainer-app/shared'

export const kpiKeys = {
  client: (clientId: string) => ['kpis', 'client', clientId] as const,
}

export function useClientKpis(clientId: string | null): UseQueryResult<ClientKpiResponse> {
  return useQuery({
    queryKey: kpiKeys.client(clientId ?? ''),
    queryFn:  () => apiClient<ClientKpiResponse>(`/clients/${clientId}/kpis`),
    enabled:  !!clientId,
    staleTime: 1000 * 60 * 2, // 2 min — recompute after new sessions logged
  })
}
