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

import React, { useState, useDeferredValue } from 'react'
import { cn }                            from '@/lib/cn'
import { interactions }                  from '@/lib/interactions'
import { useMode }                       from '@/lib/mode'
import { useNav }                        from '@/services/navService'
import { useSessionStore }               from '@/store/sessionStore'
import { useOverlayStore }               from '@/store/overlayStore'
import { useClients, useSelfClient }     from '@/lib/queries/clients'
import {
  useSessions,
  useExecuteSession,
  useUpdateSession,
}                                        from '@/lib/queries/sessions'
import { formatDuration }                from '@/lib/formatters'
import { Spinner }                       from '@/components/ui/Spinner'
import { ErrorState }                   from '@/components/ui/ErrorState'
import type { SessionSummaryResponse }   from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusTab = 'all' | 'planned' | 'in_progress' | 'completed'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Sessions group into Monday-start weeks, newest first. The list shows a flat
// week header per week ("This week" / "Last week" / "Week of Mar 10") and a month
// divider wherever the month changes. A week is attributed to the month of its
// Monday, so a week straddling a month boundary sits under its start month.

function mondayOfDate(d0: Date): Date {
  const d    = new Date(d0)
  const back = (d.getDay() + 6) % 7   // getDay: 0=Sun..6=Sat → days since Monday
  d.setDate(d.getDate() - back)
  d.setHours(0, 0, 0, 0)
  return d
}

function mondayOf(dateStr: string): Date {
  return mondayOfDate(new Date(dateStr + 'T00:00:00'))
}

interface WeekGroup {
  key:      number
  monday:   Date
  sessions: SessionSummaryResponse[]
}

function groupByWeek(sessions: SessionSummaryResponse[]): WeekGroup[] {
  const map = new Map<number, WeekGroup>()
  for (const s of sessions) {
    const monday = mondayOf(s.date)
    const key    = monday.getTime()
    const group  = map.get(key)
    if (group) group.sessions.push(s)
    else map.set(key, { key, monday, sessions: [s] })
  }
  const groups = Array.from(map.values()).sort((a, b) => b.key - a.key)   // newest week first
  for (const g of groups) {
    g.sessions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))   // newest day first
  }
  return groups
}

function weekLabel(monday: Date): string {
  const thisMonday = mondayOfDate(new Date())
  const weeksAgo   = Math.round((thisMonday.getTime() - monday.getTime()) / (7 * 86_400_000))
  if (weeksAgo === 0) return 'This week'
  if (weeksAgo === 1) return 'Last week'
  return `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function monthKeyOf(monday: Date): string {
  return `${monday.getFullYear()}-${monday.getMonth()}`
}

function monthLabel(monday: Date): string {
  const sameYear = monday.getFullYear() === new Date().getFullYear()
  return monday.toLocaleDateString('en-US', sameYear
    ? { month: 'long' }
    : { month: 'long', year: 'numeric' })
}


// ── Score dots ────────────────────────────────────────────────────────────────

function ScoreDot({ value, label }: { value: number | null; label: string }): React.JSX.Element | null {
  if (!value) return null
  const color = value >= 7 ? 'bg-emerald-400' : value >= 4 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <span className="flex items-center gap-1 text-[10px] text-ink-subtle">
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
  onCancel,
  isExecuting,
  isCancelling,
}: {
  session:      SessionSummaryResponse
  clientName:   string
  onTap:        () => void
  onExecute:    () => void
  onResume:     () => void
  onCancel:     () => void
  isExecuting:  boolean
  isCancelling: boolean
}): React.JSX.Element {
  const [confirmCancel, setConfirmCancel] = React.useState(false)
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
        isInProgress && 'border-command-blue/30',
        isCompleted  && 'border-surface-border',
      )}
    >
      {/* In-progress accent */}
      {isInProgress && (
        <div className="h-0.5 bg-command-blue w-full" />
      )}

      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Client name */}
            <p className="text-[10px] uppercase tracking-wider text-ink-subtle mb-0.5">
              {clientName}
            </p>

            {/* Session name */}
            <p className="font-display text-lg uppercase tracking-wide text-ink leading-tight truncate">
              {session.name || (isPlanned ? 'Untitled Plan' : 'Training Session')}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {isInProgress && (
                <span className="flex items-center gap-1.5 text-xs text-command-blue font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-command-blue animate-pulse" />
                  In progress
                </span>
              )}

              {duration && (
                <span className="text-xs text-ink-subtle">{duration}</span>
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
                    'px-2.5 py-1.5 rounded-lg text-xs text-ink-muted border border-surface-border',
                    'hover:text-ink hover:border-gray-500 transition-colors',
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
                    'bg-command-blue text-white',
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
              <div className="flex items-center gap-1.5">
                {confirmCancel ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-ink-muted border border-surface-border hover:text-ink transition-colors"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirmCancel(false); onCancel() }}
                      disabled={isCancelling}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                        'bg-red-500/20 border border-red-500/40 text-red-400',
                        interactions.button.base,
                        interactions.button.press,
                        isCancelling && 'opacity-50',
                      )}
                    >
                      Cancel session
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(true)}
                      className="px-2 py-1.5 rounded-lg text-xs text-ink-subtle hover:text-red-400 transition-colors"
                      title="Cancel session"
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={onResume}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                        'bg-command-blue/20 border border-command-blue/40 text-command-blue',
                        interactions.button.base,
                        interactions.button.press,
                      )}
                    >
                      Resume
                    </button>
                  </>
                )}
              </div>
            )}

            {/* No delete here — a list row is for choosing, not for destroying.
                Deleting lives in the session view you land on after tapping in. */}
            {isCompleted && (
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-ink-faint">
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
  const mode                  = useMode()
  const { activeSessions, removePlannedSession, startSession, endSession } = useSessionStore()
  const { expand, focusedClientId, hide }  = useOverlayStore()
  const { data: clients }     = useClients()
  const { data: selfClient }  = useSelfClient()
  const executeSession        = useExecuteSession()
  const updateSession         = useUpdateSession()

  const [tab,            setTab]            = useState<StatusTab>('all')
  const [clientFilter,   setClientFilter]   = useState<string>('')
  const [rawSearch,      setRawSearch]      = useState('')
  const [executingId,    setExecutingId]    = useState<string | null>(null)
  const [cancellingId,   setCancellingId]   = useState<string | null>(null)

  const search = useDeferredValue(rawSearch.trim().toLowerCase())

  // Fetch by status tab
  const statusFilter = tab === 'all' ? undefined : tab
  const { data: sessions, isLoading, isError: sessionsError, refetch: refetchSessions } = useSessions({
    ...(statusFilter  && { status: statusFilter }),
    ...(clientFilter  && { clientId: clientFilter }),
  })

  const getClientName = (clientId: string): string => {
    if (selfClient?.id === clientId) return mode.labels.selfClientLabel
    return clients?.find(c => c.id === clientId)?.name ?? '—'
  }

  // Client-side search filter
  const filtered = (sessions ?? []).filter((s) => {
    if (!search) return true
    const name   = (s.name ?? '').toLowerCase()
    const client = getClientName(s.clientId).toLowerCase()
    return name.includes(search) || client.includes(search)
  })

  const weekGroups = groupByWeek(filtered)
  const decorated  = weekGroups.map((g, i) => ({
    ...g,
    showMonth: i === 0 || monthKeyOf(g.monday) !== monthKeyOf(weekGroups[i - 1].monday),
  }))

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

  const handleCancel = async (session: SessionSummaryResponse): Promise<void> => {
    setCancellingId(session.id)
    try {
      await updateSession.mutateAsync({ id: session.id, status: 'cancelled' })
      // Clear from client-side store and hide overlay if this was the focused session
      endSession(session.clientId)
      if (focusedClientId === session.clientId) hide()
    } finally {
      setCancellingId(null)
    }
  }

  const allClients = [
    ...(selfClient && mode.can.viewRoster ? [selfClient] : []),
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
      <div className="sticky top-0 z-20 header-crosshatch backdrop-blur-md border-b border-surface-border">

        {/* Title + New Plan */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3">
          <h1 className="font-display text-3xl uppercase tracking-wide text-ink">Sessions</h1>
          <button
            type="button"
            onClick={() => nav.openSessionPlan()}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium',
              'bg-command-blue text-white',
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
            <svg viewBox="0 0 16 16" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none">
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
                  ? 'bg-command-blue text-white border-command-blue'
                  : 'bg-[#1C1C1C] border-surface-border text-ink hover:border-gray-400 hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}

          {/* Client filter — trainer mode only */}
          {mode.can.viewRoster && allClients.length > 0 && (
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
                      ? 'bg-command-blue/20 border-command-blue/60 text-command-blue'
                      : 'bg-[#1C1C1C] border-surface-border text-ink hover:border-gray-400 hover:text-ink',
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
            <Spinner size="lg" className="text-command-blue" />
          </div>
        )}

        {!isLoading && sessionsError && (
          <ErrorState onRetry={() => void refetchSessions()} />
        )}

        {!isLoading && !sessionsError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-3xl mb-3" aria-hidden>
              {tab === 'planned' ? '📋' : tab === 'in_progress' ? '🏋️' : '📅'}
            </p>
            <p className="text-ink-muted font-medium">
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
                className="mt-4 text-sm text-command-blue hover:underline"
              >
                Plan a session
              </button>
            )}
          </div>
        )}

        {/* Grouped list — flat week headers with month dividers */}
        {!sessionsError && decorated.map(({ key, monday, sessions: group, showMonth }) => (
          <div key={key}>
            {showMonth && (
              <div className="flex items-center gap-3 mb-3">
                <span className="font-display text-sm uppercase tracking-widest text-ink-muted">
                  {monthLabel(monday)}
                </span>
                <span className="flex-1 h-px bg-surface-border" />
              </div>
            )}

            {/* Week label */}
            <p className="text-[10px] uppercase tracking-widest text-ink-subtle mb-2">{weekLabel(monday)}</p>

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
                  onCancel={() => handleCancel(session)}
                  isExecuting={executingId === session.id}
                  isCancelling={cancellingId === session.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
