// ------------------------------------------------------------
// pages/ClientProfilePage.tsx — /clients/:id (v1.6.1)
//
// Orchestration-only page. All tab content lives in:
//   components/client-profile/OverviewTab.tsx
//   components/client-profile/TimelineTab.tsx
//   components/client-profile/BaselineTab.tsx
//
// This file is responsible for:
//   - Loading the client record
//   - Tab state + restoration on back-navigation
//   - KPI hero above tabs
//   - Header (avatar, name, badge, start session, edit)
//   - Edit drawer
// ------------------------------------------------------------

import { useState }                          from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { cn }                                from '@/lib/cn'
import { interactions }                      from '@/lib/interactions'
import { useRestoreScroll }                  from '@/hooks/useScrollRestoration'
import { usePreferences }                    from '@/hooks/usePreferences'
import { KpiHero }                           from '@/components/kpi/KpiHero'
import { OverviewTab }                       from '@/components/client-profile/OverviewTab'
import { TimelineTab }                       from '@/components/client-profile/TimelineTab'
import { BaselineTab }                       from '@/components/client-profile/BaselineTab'
import {
  useClient, useClientSnapshots,
  useClientKpis,
} from '@/lib/queries/clients'
import { SilhouetteAvatar }                  from '@/components/clients/SilhouetteAvatar'
import { ClientDrawer }                      from '@/components/clients/ClientDrawer'
import { Spinner }                           from '@/components/ui/Spinner'
import {
  PROGRESSION_STATE_LABEL,
  PROGRESSION_STATE_COLOR,
  isOverviewIncomplete,
  isBaselineIncomplete,
} from '@/components/clients/utils'

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'timeline' | 'baseline'

// ── Tab button ────────────────────────────────────────────────────────────────

function TabButton({ id, label, active, incomplete, onClick }: {
  id:          Tab
  label:       string
  active:      boolean
  incomplete?: boolean
  onClick:     () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      id={`tab-${id}`}
      aria-controls={`panel-${id}`}
      onClick={onClick}
      className={cn(
        'relative flex-1 py-3 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
        active
          ? 'text-white border-b-2 border-brand-highlight'
          : 'text-gray-500 hover:text-gray-300 border-b-2 border-transparent',
      )}
    >
      {label}
      {incomplete && !active && (
        <span
          className="absolute top-2 right-[calc(50%-16px)] w-1.5 h-1.5 rounded-full bg-amber-400"
          aria-label="Incomplete — some information is missing"
        />
      )}
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ClientProfilePage(): React.JSX.Element {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Restore tab + scroll position when returning from session history
  const returnTab = (location.state as { returnTab?: Tab } | null)?.returnTab
  const [tab,      setTab]      = useState<Tab>(returnTab ?? 'overview')
  const [editOpen, setEditOpen] = useState(false)

  useRestoreScroll()

  const { trainerMode } = usePreferences()

  const { data: client,    isLoading, error } = useClient(id ?? null)
  const { data: snapshots }                   = useClientSnapshots(id ?? null)
  const { data: kpis, isLoading: kpisLoading } = useClientKpis(id)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Client not found.</p>
        <button type="button" onClick={() => navigate('/clients')} className="mt-4 text-sm text-brand-highlight hover:underline">
          Back to clients
        </button>
      </div>
    )
  }

  const overviewIncomplete = isOverviewIncomplete(client)
  const baselineIncomplete = isBaselineIncomplete((snapshots?.length ?? 0) > 0)

  return (
    <div className="max-w-2xl mx-auto">

      {/* Profile header */}
      <div className="px-4 pt-5 pb-0 md:px-6">

        {/* Nav row */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate('/clients')}
            className={cn('flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300', interactions.button.base)}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Clients
          </button>

          <div className="flex items-center gap-2">
            {/* Start Session */}
            <Link
              to={`/session/new?clientId=${client.id}`}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                'bg-brand-highlight text-white',
                interactions.button.base,
                interactions.fab.hover,
                interactions.button.press,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
              )}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Start Session
            </Link>

            {/* Edit */}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label={`Edit ${client.name}`}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
                'bg-surface border border-surface-border text-gray-300',
                'hover:border-brand-highlight/40 hover:text-white',
                interactions.button.base,
                interactions.button.hover,
                interactions.button.press,
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
              )}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
                <path d="M11 2l3 3-9 9H2v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit
            </button>
          </div>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-5">
          <SilhouetteAvatar name={client.name} photoUrl={client.photoUrl} size="lg" />
          <div>
            <h1 className="font-display text-3xl uppercase tracking-wide text-white leading-none">
              {client.name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider',
                PROGRESSION_STATE_COLOR[client.progressionState],
              )}>
                {PROGRESSION_STATE_LABEL[client.progressionState]}
              </span>
              {client.isSelf && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-brand-highlight/30 text-brand-highlight/80 uppercase tracking-wider">
                  My Training
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI Hero */}
        <KpiHero
          client={client}
          kpis={kpis}
          isLoading={kpisLoading}
          isAthlete={trainerMode === 'athlete'}
        />

        {/* Tabs */}
        <div role="tablist" aria-label="Client profile sections" className="flex border-b border-surface-border">
          <TabButton id="overview" label="Overview" active={tab === 'overview'} incomplete={overviewIncomplete} onClick={() => setTab('overview')} />
          <TabButton id="timeline" label="Timeline" active={tab === 'timeline'} onClick={() => setTab('timeline')} />
          <TabButton id="baseline" label="Baseline" active={tab === 'baseline'} incomplete={baselineIncomplete} onClick={() => setTab('baseline')} />
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 pt-5 pb-24 md:px-6">
        {tab === 'overview' && (
          <OverviewTab
            clientId={client.id}
            progressionState={client.progressionState}
            primaryFocus={client.primaryFocus}
            secondaryFocus={client.secondaryFocus}
            startDate={client.startDate}
            lastActiveAt={client.lastActiveAt}
          />
        )}
        {tab === 'timeline' && <TimelineTab clientId={client.id} clientName={client.name} />}
        {tab === 'baseline' && <BaselineTab clientId={client.id} />}
      </div>

      {/* Edit drawer */}
      <ClientDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
        onSuccess={() => setEditOpen(false)}
      />
    </div>
  )
}
