// ------------------------------------------------------------
// pages/SessionsPage.tsx (v2.2.0)
//
// Full sessions view — list, filter, search, detail.
//
// LAYOUT:
//   Header — title + "New Plan" button
//   Search + client filter (trainer mode)
//   Status tabs — All / Planned / In Progress / Completed
//   Grouped session list — grouped by date label
//
// Session cards:
//   Planned    — name, client, block count, Execute + Edit buttons
//   In Progress — name, client, elapsed timer, Resume button
//   Completed  — name, client, duration, volume, scores, tap to view detail
//
// Tapping a completed session opens SessionHistoryPanel (SPA panel).
// In Progress tapping re-expands the overlay.
// ------------------------------------------------------------

import { useState, useDeferredValue }    from 'react'
import { cn }                            from '@/lib/cn'
import { interactions }                  from '@/lib/interactions'
import { useNav }                        from '@/services/navService'
import { usePreferences }                from '@/hooks/usePreferences'
import { useSessionStore }               from '@/store/sessionStore'
import { useOverlayStore }               from '@/store/overlayStore'
import { useClients, useSelfClient }     from '@/lib/queries/clients'
import {
  useSessions,
  useExecuteSession,
}                                        from '@/lib/queries/sessions'
import { Spinner }                       from '@/components/ui/Spinner'
import type { SessionSummaryResponse }   from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusTab = 'all' | 'planned' | 'in_progress' | 'completed'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d         = new Date(dateStr + 'T00:00:00')
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  // Within the last week — show weekday
  const daysAgo = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (daysAgo < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return ''
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function groupByDate(sessions: SessionSummaryResponse[]): Array<{ label: string; sessions: SessionSummaryResponse[] }> {
  const map = new Map<string, SessionSummaryResponse[]>()
  for (const s of sessions) {
    const label = formatDate(s.date)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(s)
  }
  return Array.from(map.entries()).map(([label, sessions]) => ({ label, sessions }))
}


// ── Score dots ────────────────────────────────────────────────────────────────

function ScoreDot({ value, label }: { value: number | null; label: string }): React.JSX.Element | null {
  if (!value) return null
  const color = value >= 7 ? 'bg-emerald-400' : value >= 4 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span className="flex items-center gap-1 text-[10px] text-gray-500">
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', color)} />
      {label} {value}
    </span>
  )
}

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  clientName,
  onTap,
  onExecute,
  onResume,
  isExecuting,
}: {
  session:     SessionSummaryResponse
  clientName:  string
  onTap:       () => void
  onExecute:   () => void
  onResume:    () => void
  isExecuting: boolean
}): React.JSX.Element {
  const duration = formatDuration(session.startTime, session.endTime)
  const isPlanned    = session.status === 'planned'
  const isInProgress = session.status === 'in_progress'
  const isCompleted  = session.status === 'completed'

  return (
    <div
      role={isCompleted ? 'button' : undefined}
      tabIndex={isCompleted ? 0 : undefined}
      onClick={isCompleted ? onTap : undefined}
      onKeyDown={isCompleted ? (e) => { if (e.key === 'Enter' || e.key === ' ') onTap() } : undefined}
      className={cn(
        'w-full text-left bg-brand-secondary rounded-2xl border overflow-hidden',
        'transition-all duration-150',
        isCompleted && [interactions.card.base, interactions.card.hover, interactions.card.press, 'cursor-pointer'],
        isPlanned    && 'border-surface-border',
        isInProgress && 'border-brand-highlight/30',
        isCompleted  && 'border-surface-border',
      )}
    >
      {/* In-progress accent */}
      {isInProgress && (
        <div className="h-0.5 bg-brand-highlight w-full" />
      )}

      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Client name */}
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
              {clientName}
            </p>

            {/* Session name */}
            <p className="font-display text-lg uppercase tracking-wide text-white leading-tight truncate">
              {session.name || (isPlanned ? 'Untitled Plan' : 'Training Session')}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {isInProgress && (
                <span className="flex items-center gap-1.5 text-xs text-brand-highlight font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-highlight animate-pulse" />
                  In progress
                </span>
              )}

              {duration && (
                <span className="text-xs text-gray-500">{duration}</span>
              )}

              {isCompleted && session.energyLevel && (
                <ScoreDot value={session.energyLevel} label="Energy" />
              )}
              {isCompleted && session.stressLevel && (
                <ScoreDot value={session.stressLevel} label="Stress" />
              )}
              {isCompleted && session.mobilityFeel && (
                <ScoreDot value={session.mobilityFeel} label="Mobility" />
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            {isPlanned && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onTap}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs text-gray-400 border border-surface-border',
                    'hover:text-gray-200 hover:border-gray-500 transition-colors',
                    interactions.button.base,
                  )}
                >
                  Edit
                </button>
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
            )}

            {isInProgress && (
              <button
                type="button"
                onClick={onResume}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  'bg-brand-highlight/20 border border-brand-highlight/40 text-brand-highlight',
                  interactions.button.base,
                  interactions.button.press,
                )}
              >
                Resume
              </button>
            )}

            {isCompleted && (
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gray-600">
                <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionsPage(): React.JSX.Element {
  const nav                   = useNav()
  const { trainerMode }       = usePreferences()
  const { activeSessions, removePlannedSession, startSession } = useSessionStore()
  const { expand }            = useOverlayStore()
  const { data: clients }     = useClients()
  const { data: selfClient }  = useSelfClient()
  const executeSession        = useExecuteSession()

  const [tab,            setTab]            = useState<StatusTab>('all')
  const [clientFilter,   setClientFilter]   = useState<string>('')
  const [rawSearch,      setRawSearch]      = useState('')
  const [executingId,    setExecutingId]    = useState<string | null>(null)

  const search = useDeferredValue(rawSearch.trim().toLowerCase())

  // Fetch by status tab
  const statusFilter = tab === 'all' ? undefined : tab
  const { data: sessions, isLoading } = useSessions({
    ...(statusFilter  && { status: statusFilter }),
    ...(clientFilter  && { clientId: clientFilter }),
  })

  const getClientName = (clientId: string): string => {
    if (selfClient?.id === clientId) return trainerMode === 'athlete' ? 'My Training' : 'Me'
    return clients?.find(c => c.id === clientId)?.name ?? '—'
  }

  // Client-side search filter
  const filtered = (sessions ?? []).filter((s) => {
    if (!search) return true
    const name   = (s.name ?? '').toLowerCase()
    const client = getClientName(s.clientId).toLowerCase()
    return name.includes(search) || client.includes(search)
  })

  const grouped = groupByDate(filtered)

  const handleExecute = async (session: SessionSummaryResponse): Promise<void> => {
    setExecutingId(session.id)
    try {
      await executeSession.mutateAsync({ id: session.id })
      const clientName = getClientName(session.clientId)
      removePlannedSession(session.id)
      startSession(session.clientId, session.id, clientName)
      expand(session.clientId)
    } finally {
      setExecutingId(null)
    }
  }

  const handleResume = (session: SessionSummaryResponse): void => {
    // Ensure the session is in the active store — it may not be if
    // the store was cleared or the session was started elsewhere
    if (!activeSessions[session.clientId]) {
      startSession(session.clientId, session.id, getClientName(session.clientId))
    }
    expand(session.clientId)
  }

  const allClients = [
    ...(selfClient && trainerMode === 'trainer' ? [selfClient] : []),
    ...(clients ?? []).filter(c => !c.isSelf),
  ]

  const STATUS_TABS: Array<{ id: StatusTab; label: string }> = [
    { id: 'all',         label: 'All' },
    { id: 'planned',     label: 'Planned' },
    { id: 'in_progress', label: 'Active' },
    { id: 'completed',   label: 'Done' },
  ]

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-brand-primary/90 backdrop-blur-md border-b border-surface-border">

        {/* Title + New Plan */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3">
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

        {/* Search */}
        <div className="px-4 md:px-6 pb-3">
          <div className="relative">
            <svg viewBox="0 0 16 16" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search sessions…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="field pl-9"
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 px-4 md:px-6 pb-3 overflow-x-auto scrollbar-hidden">
          {STATUS_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'shrink-0 px-4 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                tab === id
                  ? 'bg-brand-highlight text-white border-brand-highlight'
                  : 'border-surface-border text-gray-500 hover:border-gray-500 hover:text-gray-300',
              )}
            >
              {label}
            </button>
          ))}

          {/* Client filter — trainer mode only */}
          {trainerMode === 'trainer' && allClients.length > 0 && (
            <>
              <div className="w-px bg-surface-border shrink-0 mx-1" />
              {allClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => setClientFilter(clientFilter === client.id ? '' : client.id)}
                  className={cn(
                    'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                    clientFilter === client.id
                      ? 'bg-brand-highlight/20 border-brand-highlight/60 text-brand-highlight'
                      : 'border-surface-border text-gray-500 hover:border-gray-500 hover:text-gray-300',
                  )}
                >
                  {client.isSelf ? 'Me' : client.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 md:px-6 py-4 space-y-6">

        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-brand-highlight" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-3xl mb-3" aria-hidden>
              {tab === 'planned' ? '📋' : tab === 'in_progress' ? '🏋️' : '📅'}
            </p>
            <p className="text-gray-400 font-medium">
              {search
                ? 'No sessions match'
                : tab === 'all'       ? 'No sessions yet'
                : tab === 'planned'   ? 'No planned sessions'
                : tab === 'in_progress' ? 'No active sessions'
                : 'No completed sessions'}
            </p>
            {!search && tab !== 'in_progress' && (
              <button
                type="button"
                onClick={() => nav.openSessionPlan()}
                className="mt-4 text-sm text-brand-highlight hover:underline"
              >
                Plan a session
              </button>
            )}
          </div>
        )}

        {/* Grouped list */}
        {grouped.map(({ label, sessions: group }) => (
          <div key={label}>
            {/* Date label */}
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{label}</p>

            <div className="space-y-2">
              {group.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  clientName={getClientName(session.clientId)}
                  onTap={() => {
                    if (session.status === 'planned') {
                      nav.openSessionPlan(session.id, session.clientId)
                    } else if (session.status === 'completed' || session.status === 'cancelled') {
                      nav.openSessionHistory(session.id)
                    }
                  }}
                  onExecute={() => handleExecute(session)}
                  onResume={() => handleResume(session)}
                  isExecuting={executingId === session.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
