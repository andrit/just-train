// ------------------------------------------------------------
// pages/SessionsPage.tsx (v2.1.0)
//
// Two sections:
//   TODAY — today's planned sessions per client + "New Plan" CTA
//   RECENT — completed sessions, most recent first
//
// "New Plan" opens the SessionPlanPanel.
// Planned sessions show an Execute button → starts the session.
// ------------------------------------------------------------

import { useState }                     from 'react'
import { cn }                           from '@/lib/cn'
import { interactions }                 from '@/lib/interactions'
import { useNav }                       from '@/services/navService'
import { usePreferences }               from '@/hooks/usePreferences'
import { useSessionStore }              from '@/store/sessionStore'
import { useOverlayStore }              from '@/store/overlayStore'
import { useClients, useSelfClient }    from '@/lib/queries/clients'
import {
  usePlannedSessions,
  useSessions,
  useExecuteSession,
}                                       from '@/lib/queries/sessions'
import { Spinner }                      from '@/components/ui/Spinner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today    = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return ''
  const mins = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ── Planned session card ──────────────────────────────────────────────────────

function PlannedCard({
  session,
  clientName,
  onEdit,
  onExecute,
  isExecuting,
}: {
  session:     any
  clientName:  string
  onEdit:      () => void
  onExecute:   () => void
  isExecuting: boolean
}): React.JSX.Element {
  const blockCount   = session.workouts?.length ?? 0
  const exerciseCount = session.workouts?.reduce(
    (acc: number, w: any) => acc + (w.sessionExercises?.length ?? 0), 0
  ) ?? 0

  return (
    <div className={cn(
      'bg-brand-secondary rounded-2xl border border-surface-border overflow-hidden',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border/50">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider">{clientName}</p>
          <p className="font-display text-lg uppercase tracking-wide text-white truncate">
            {session.name || 'Untitled Plan'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
          {/* Edit */}
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-surface-border',
              'hover:text-gray-200 hover:border-gray-500 transition-colors',
              interactions.button.base,
            )}
          >
            Edit
          </button>
          {/* Execute */}
          <button
            type="button"
            onClick={onExecute}
            disabled={isExecuting}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-brand-highlight text-white',
              interactions.button.base,
              interactions.button.press,
              isExecuting && 'opacity-50',
            )}
          >
            {isExecuting ? <Spinner size="sm" /> : (
              <>
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                  <path d="M2.5 2l7 4-7 4V2z" fill="currentColor" />
                </svg>
                Start
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 px-4 py-3">
        <span className="text-xs text-gray-500">
          {blockCount} block{blockCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-gray-500">
          {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
        </span>
        {blockCount === 0 && (
          <span className="text-xs text-amber-500/70">Empty — tap Edit to add exercises</span>
        )}
      </div>
    </div>
  )
}

// ── Recent session row ────────────────────────────────────────────────────────

function RecentRow({ session, clientName }: { session: any; clientName: string }): React.JSX.Element {
  const blockCount    = session.workouts?.length ?? 0
  const duration      = formatDuration(session.startTime, session.endTime)

  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">
          {session.name || 'Training Session'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {clientName} · {formatDate(session.date)}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3 text-xs text-gray-500">
        {duration && <span>{duration}</span>}
        <span>{blockCount} block{blockCount !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionsPage(): React.JSX.Element {
  const nav                                 = useNav()
  const { trainerMode }                     = usePreferences()
  const { getPlannedSessions, removePlannedSession, startSession } = useSessionStore()
  const { expand }                          = useOverlayStore()
  const { data: clients }                   = useClients()
  const { data: selfClient }                = useSelfClient()
  const executeSession                      = useExecuteSession()

  const [executingId, setExecutingId]       = useState<string | null>(null)

  // Planned: from DB (source of truth) + store (for new ones not yet fetched)
  const { data: plannedFromDB, isLoading: plannedLoading } = usePlannedSessions()
  const plannedFromStore = getPlannedSessions()

  // Merge: DB planned sessions + any from store not yet in DB response
  const dbIds     = new Set((plannedFromDB ?? []).map(s => s.id))
  const storePlans = plannedFromStore.filter(p => !dbIds.has(p.sessionId))
  const allPlanned = [...(plannedFromDB ?? []), ...storePlans.map(p => ({ id: p.sessionId, name: p.name, clientId: p.clientId, date: new Date().toISOString().split('T')[0], workouts: [] }))]

  // Recent: completed sessions
  const { data: recent, isLoading: recentLoading } = useSessions({ status: 'completed' })

  const getClientName = (clientId: string): string => {
    if (selfClient?.id === clientId) return trainerMode === 'athlete' ? 'My Training' : `${selfClient.name} (Me)`
    return clients?.find(c => c.id === clientId)?.name ?? 'Unknown'
  }

  const handleExecute = async (session: any): Promise<void> => {
    setExecutingId(session.id)
    try {
      await executeSession.mutateAsync({ id: session.id })

      const clientName = getClientName(session.clientId)
      removePlannedSession(session.id)
      startSession(session.clientId, session.id, clientName)
      expand(session.clientId)
    } catch {
      // error handled silently — user sees no change
    } finally {
      setExecutingId(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl uppercase tracking-wide text-white">Sessions</h1>
        <button
          type="button"
          onClick={() => nav.openSessionPlan()}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
            'bg-brand-highlight text-white',
            interactions.button.base,
            interactions.button.press,
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New Plan
        </button>
      </div>

      {/* ── Planned ──────────────────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">Planned</h2>

        {plannedLoading && (
          <div className="flex justify-center py-8">
            <Spinner size="sm" className="text-gray-500" />
          </div>
        )}

        {!plannedLoading && allPlanned.length === 0 && (
          <div className="text-center py-10 bg-brand-secondary rounded-2xl border border-dashed border-surface-border">
            <p className="text-gray-500 text-sm">No planned sessions</p>
            <p className="text-gray-600 text-xs mt-1">Tap "New Plan" to build your next session</p>
          </div>
        )}

        {allPlanned.length > 0 && (
          <div className="space-y-3">
            {allPlanned.map((session) => (
              <PlannedCard
                key={session.id}
                session={session}
                clientName={getClientName((session as any).clientId)}
                onEdit={() => nav.openSessionPlan(session.id, (session as any).clientId)}
                onExecute={() => handleExecute(session)}
                isExecuting={executingId === session.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Recent ───────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">Recent</h2>

        {recentLoading && (
          <div className="flex justify-center py-8">
            <Spinner size="sm" className="text-gray-500" />
          </div>
        )}

        {!recentLoading && (recent ?? []).length === 0 && (
          <p className="text-center text-gray-600 text-sm py-8">No completed sessions yet</p>
        )}

        {(recent ?? []).length > 0 && (
          <div className="bg-brand-secondary rounded-2xl border border-surface-border px-4">
            {(recent ?? []).slice(0, 20).map((session) => (
              <RecentRow
                key={session.id}
                session={session}
                clientName={getClientName(session.clientId)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
