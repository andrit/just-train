// ------------------------------------------------------------
// components/shell/ClientProfilePanel.tsx (v2.0.0)
//
// Client profile as a slide-in panel. The client list stays
// mounted underneath — no navigation, no unmount.
//
// Accepts clientId as a prop (from navService / location.state)
// instead of useParams(). All navigate() calls replaced with
// navService calls or onClose() callbacks.
//
// Used in the SPA model when on the /clients tab.
// ClientProfilePage (route) is kept as a URL-addressable fallback.
// ------------------------------------------------------------

import { useState }                          from 'react'
import { cn }                                from '@/lib/cn'
import { interactions }                      from '@/lib/interactions'
import { usePreferences }                    from '@/hooks/usePreferences'
import { useSessionStore }                   from '@/store/sessionStore'
import { useOverlayStore }                   from '@/store/overlayStore'
import { useNav }                            from '@/services/navService'
import { KpiHero }                           from '@/components/kpi/KpiHero'
import { OverviewTab }                       from '@/components/client-profile/OverviewTab'
import { TimelineTab }                       from '@/components/client-profile/TimelineTab'
import { BaselineTab }                       from '@/components/client-profile/BaselineTab'
import { PersonalBestsTab }                  from '@/components/client-profile/PersonalBestsTab'
import { ReportPreviewModal }                from '@/components/reports/ReportPreviewModal'
import { useClient, useClientSnapshots, useClientKpis } from '@/lib/queries/clients'
import { SilhouetteAvatar }                  from '@/components/clients/SilhouetteAvatar'
import { ClientDrawer }                      from '@/components/clients/ClientDrawer'
import { Spinner }                           from '@/components/ui/Spinner'
import {
  PROGRESSION_STATE_LABEL,
  PROGRESSION_STATE_COLOR,
  isOverviewIncomplete,
  isBaselineIncomplete,
} from '@/components/clients/utils'

type Tab = 'overview' | 'timeline' | 'baseline' | 'prs'

function TabButton({ id: _id, label, active, incomplete, onClick }: {
  id: Tab; label: string; active: boolean; incomplete?: boolean; onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
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
        <span className="absolute top-2 right-[calc(50%-16px)] w-1.5 h-1.5 rounded-full bg-amber-400" />
      )}
    </button>
  )
}

interface ClientProfilePanelProps {
  clientId: string
  onClose:  () => void
}

export function ClientProfilePanel({ clientId, onClose }: ClientProfilePanelProps): React.JSX.Element {
  const [tab,        setTab]        = useState<Tab>('overview')
  const [editOpen,   setEditOpen]   = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportSentLabel, setReportSentLabel] = useState<string | null>(null)

  const { trainerMode }           = usePreferences()
  const { hasSession } = useSessionStore()
  const { expand }                = useOverlayStore()
  const nav                       = useNav()

  const { data: client,    isLoading, error } = useClient(clientId)
  const { data: snapshots }                   = useClientSnapshots(clientId)
  const { data: kpis, isLoading: kpisLoading } = useClientKpis(clientId)

  const handleStartOrContinueSession = (): void => {
    if (hasSession(clientId)) {
      // Resume — expand the overlay
      expand(clientId)
    } else {
      // Start new — open launcher sheet
      nav.openSessionLauncher(clientId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full pt-20">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="p-6 text-center pt-20">
        <p className="text-gray-400">Client not found.</p>
        <button type="button" onClick={onClose} className="mt-4 text-sm text-brand-highlight hover:underline">
          Go back
        </button>
      </div>
    )
  }

  const overviewIncomplete = isOverviewIncomplete(client)
  const baselineIncomplete = isBaselineIncomplete((snapshots?.length ?? 0) > 0)
  const sessionActive      = hasSession(clientId)

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-0 md:px-6 shrink-0">

        {/* Nav row */}
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={onClose}
            className={cn('flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300', interactions.button.base)}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden>
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Clients
          </button>

          <div className="flex items-center gap-2">
            {/* Report button */}
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              disabled={(kpis?.sessionsThisMonth ?? 0) === 0}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
                'bg-surface border border-surface-border',
                (kpis?.sessionsThisMonth ?? 0) > 0
                  ? 'text-gray-300 hover:border-brand-highlight/40 hover:text-white'
                  : 'text-gray-600 cursor-not-allowed opacity-50',
                interactions.button.base,
                interactions.button.press,
              )}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
                <path d="M2 4l6 5 6-5M2 4h12v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {(kpis?.sessionsThisMonth ?? 0) === 0 ? 'No Sessions' : 'Send Report'}
            </button>

            {/* Start / Continue session */}
            <button
              type="button"
              onClick={handleStartOrContinueSession}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
                sessionActive
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-brand-highlight text-white',
                interactions.button.base,
                interactions.button.press,
              )}
            >
              {sessionActive ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Continue
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Start Session
                </>
              )}
            </button>

            {/* Edit */}
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm',
                'bg-surface border border-surface-border text-gray-300',
                'hover:border-brand-highlight/40 hover:text-white',
                interactions.button.base,
                interactions.button.press,
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
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
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
              {/* Report status */}
              {!client.isSelf && (() => {
                const now            = new Date()
                const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
                const sentAt         = client.lastReportSentAt ? new Date(client.lastReportSentAt) : null
                const sentThisMonth  = sentAt && sentAt >= monthStart
                const hasSessions    = (kpis?.sessionsThisMonth ?? 0) > 0
                if (sentThisMonth) return (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400/80 uppercase tracking-wider">
                    Report Sent
                  </span>
                )
                if (hasSessions) return (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400/80 uppercase tracking-wider">
                    Report Due
                  </span>
                )
                return null
              })()}
            </div>
          </div>
        </div>

        {/* KPI hero */}
        <KpiHero
          client={client}
          kpis={kpis}
          isLoading={kpisLoading}
          isAthlete={trainerMode === 'athlete'}
        />

        {/* Tabs */}
        <div role="tablist" className="flex border-b border-surface-border">
          <TabButton id="overview" label="Overview" active={tab === 'overview'} incomplete={overviewIncomplete} onClick={() => setTab('overview')} />
          <TabButton id="timeline" label="Timeline" active={tab === 'timeline'} onClick={() => setTab('timeline')} />
          <TabButton id="baseline" label="Baseline" active={tab === 'baseline'} incomplete={baselineIncomplete} onClick={() => setTab('baseline')} />
          <TabButton id="prs" label="PRs" active={tab === 'prs'} onClick={() => setTab('prs')} />
        </div>
      </div>

      {/* Tab content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-24 md:px-6">
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
        {tab === 'timeline' && <TimelineTab clientId={client.id} clientName={client.name} />}
        {tab === 'baseline' && <BaselineTab clientId={client.id} />}
        {tab === 'prs'      && <PersonalBestsTab clientId={client.id} />}
      </div>

      {/* Edit drawer */}
      <ClientDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
        onSuccess={() => setEditOpen(false)}
      />

      {/* Report modal */}
      <ReportPreviewModal
        open={reportOpen}
        clientId={client.id}
        clientName={client.name}
        onClose={() => setReportOpen(false)}
        onSent={(label) => {
          setReportOpen(false)
          setReportSentLabel(label)
          setTimeout(() => setReportSentLabel(null), 5000)
        }}
      />

      {/* Report sent toast */}
      {reportSentLabel && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 animate-slide-up shadow-lg">
          Report sent — {reportSentLabel}
        </div>
      )}
    </div>
  )
}
