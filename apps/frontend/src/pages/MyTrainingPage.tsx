// ------------------------------------------------------------
// pages/MyTrainingPage.tsx — /my-training
//
// Athlete-first training profile. Replaces the redirect to /clients/:id
// that leaked an internal URL to athletes (policy P8/P9, UF-A-05).
//
// No trainer-specific UI: no "← Clients" back button, no "Send Report",
// no "Report Due/Sent" badge. All copy is first-person.
//
// Accepts { state: { tab: Tab } } from navigate() for deep-linking
// (e.g. Log Snapshot on dashboard navigates with tab: 'baseline').
// ------------------------------------------------------------

import { useState }                          from 'react'
import { useLocation }                       from 'react-router-dom'
import { cn }                                from '@/lib/cn'
import { interactions }                      from '@/lib/interactions'
import { usePreferences }                    from '@/hooks/usePreferences'
import { useSessionStore }                   from '@/store/sessionStore'
import { useNav }                            from '@/services/navService'
import { KpiHero }                           from '@/components/kpi/KpiHero'
import { OverviewTab }                       from '@/components/client-profile/OverviewTab'
import { TimelineTab }                       from '@/components/client-profile/TimelineTab'
import { BaselineTab }                       from '@/components/client-profile/BaselineTab'
import { PersonalBestsTab }                  from '@/components/client-profile/PersonalBestsTab'
import { ChallengesTab }                     from '@/components/client-profile/ChallengesTab'
import { SilhouetteAvatar }                  from '@/components/clients/SilhouetteAvatar'
import { Spinner }                           from '@/components/ui/Spinner'
import {
  PROGRESSION_STATE_LABEL,
  PROGRESSION_STATE_COLOR,
  isOverviewIncomplete,
  isBaselineIncomplete,
} from '@/components/clients/utils'
import {
  useSelfClient, useClientSnapshots, useClientKpis,
} from '@/lib/queries/clients'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'timeline' | 'baseline' | 'prs' | 'challenges'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',   label: 'Overview'    },
  { id: 'timeline',   label: 'Timeline'    },
  { id: 'baseline',   label: 'Baseline'    },
  { id: 'prs',        label: 'PRs'         },
  { id: 'challenges', label: 'Challenges'  },
]

// ── Tab button (same pattern as ClientProfilePage) ────────────────────────────

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
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
        active
          ? 'text-white border-b-2 border-command-blue'
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

export default function MyTrainingPage(): React.JSX.Element {
  const location   = useLocation()
  const defaultTab = (location.state as { tab?: Tab } | null)?.tab ?? 'overview'
  const [tab, setTab] = useState<Tab>(defaultTab)

  const { trainerMode }        = usePreferences()
  const { hasSession }         = useSessionStore()
  const { openSessionLauncher } = useNav()

  const { data: client,    isLoading, error } = useSelfClient()
  const { data: snapshots }                   = useClientSnapshots(client?.id ?? null)
  const { data: kpis, isLoading: kpisLoading } = useClientKpis(client?.id)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" className="text-command-blue" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Your training profile could not be found.</p>
      </div>
    )
  }

  const overviewIncomplete = isOverviewIncomplete(client)
  const baselineIncomplete = isBaselineIncomplete((snapshots?.length ?? 0) > 0)

  const isInSession = hasSession(client.id)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-5 pb-0 md:px-6">

        {/* Header row — no "← Clients" back, no report actions */}
        <div className="flex items-center justify-end mb-5">
          <button
            type="button"
            onClick={() => openSessionLauncher(client.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
              'bg-command-blue text-white',
              interactions.button.base,
              interactions.button.press,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
            )}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {isInSession ? 'Continue Session' : 'Start Training'}
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-4 mb-5">
          <SilhouetteAvatar name={client.name} photoUrl={client.photoUrl} size="lg" />
          <div>
            <h1 className="font-display text-3xl uppercase tracking-wide text-white leading-none">
              {trainerMode === 'athlete' ? 'Your Training' : client.name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider',
                PROGRESSION_STATE_COLOR[client.progressionState],
              )}>
                {PROGRESSION_STATE_LABEL[client.progressionState]}
              </span>
            </div>
          </div>
        </div>

        {/* KPI hero */}
        <KpiHero
          client={client}
          kpis={kpis}
          isLoading={kpisLoading}
          isAthlete={true}
        />

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Your training profile"
          className="flex border-b border-surface-border"
        >
          {TABS.map(({ id, label }) => (
            <TabButton
              key={id}
              id={id}
              label={label}
              active={tab === id}
              incomplete={
                id === 'overview' ? overviewIncomplete
                : id === 'baseline' ? baselineIncomplete
                : undefined
              }
              onClick={() => setTab(id)}
            />
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="px-4 pt-5 pb-24 md:px-6">
        {tab === 'overview' && (
          <OverviewTab
            clientId={client.id}
            progressionState={client.progressionState}
            primaryFocus={client.primaryFocus}
            secondaryFocus={client.secondaryFocus}
            startDate={client.startDate}
            lastActiveAt={client.lastActiveAt}
            progressPhotosOptedOut={client.progressPhotosOptedOut}
          />
        )}
        {tab === 'timeline'   && <TimelineTab clientId={client.id} clientName={client.name} />}
        {tab === 'baseline'   && <BaselineTab clientId={client.id} />}
        {tab === 'prs'        && <PersonalBestsTab clientId={client.id} />}
        {tab === 'challenges' && <ChallengesTab clientId={client.id} clientName={client.name} isSelf={true} />}
      </div>
    </div>
  )
}
