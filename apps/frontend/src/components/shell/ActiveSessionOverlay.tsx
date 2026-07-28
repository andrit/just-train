// ------------------------------------------------------------
// components/shell/ActiveSessionOverlay.tsx (v2.0.0)
//
// Persistent live session overlay — the Spotify model.
//
// STATES:
//   expanded   — full screen, nav hidden, session UI visible
//   minimised  — pill above nav bar, session running in bg
//   hidden     — no active session
//
// TRANSITIONS:
//   Session starts   → expand automatically
//   Swipe down       → minimise
//   Tap pill         → expand
//   End session      → hide
//
// Always mounted when a session is active so the session UI
// (timer state, input focus) is never lost on navigation.
// ------------------------------------------------------------

import { useEffect, useState }            from 'react'
import { useSwipeDismiss }                from '@/hooks/useSwipeDismiss'
import { cn }                              from '@/lib/cn'
import { interactions }                    from '@/lib/interactions'
import { useSessionStore }                 from '@/store/sessionStore'
import { useOverlayStore }                 from '@/store/overlayStore'
import { useClients, useSelfClient }       from '@/lib/queries/clients'
import LiveSessionContent                  from './LiveSessionContent'
import { SessionErrorBoundary }            from './ErrorBoundary'

// ── Elapsed timer ─────────────────────────────────────────────────────────────

function useElapsedTime(startedAt: string): string {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

// ── Session pill (minimised state) ────────────────────────────────────────────

function SessionPill({
  clientName,
  startedAt,
  onExpand,
}: {
  clientName: string
  startedAt:  string
  onExpand:   () => void
}): React.JSX.Element {
  const elapsed = useElapsedTime(startedAt)

  return (
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-2xl',
        'bg-brand-secondary border border-command-blue/30',
        'shadow-lg shadow-black/40',
        'transition-all duration-200',
        interactions.button.base,
        interactions.button.press,
      )}
    >
      {/* Pulse indicator */}
      <div className="relative shrink-0 w-2 h-2">
        <div className="w-2 h-2 rounded-full bg-command-blue" />
        <div className="absolute inset-0 rounded-full bg-command-blue animate-ping opacity-60" />
      </div>

      <div className="text-left">
        <p className="text-xs font-medium text-white leading-tight">{clientName}</p>
        <p className="text-[10px] text-gray-500 leading-tight tabular-nums">{elapsed}</p>
      </div>

      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-500 ml-1 shrink-0">
        <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

// ── Main overlay ──────────────────────────────────────────────────────────────

export function ActiveSessionOverlay(): React.JSX.Element | null {
  const { activeSessions }                                     = useSessionStore()
  const { state, focusedClientId, expand, minimise, sidebarOpen } = useOverlayStore()
  const { data: clients }                                      = useClients()
  const { data: selfClient }                                   = useSelfClient()
  const swipeToMinimise                                        = useSwipeDismiss(minimise)

  // Match sidebar width: collapsed = w-14 (3.5rem), full = w-56 (14rem)
  const sidebarOffset = (state === 'expanded' && !sidebarOpen) ? 'md:left-14' : 'md:left-56'

  const sessionList  = Object.values(activeSessions)
  const sessionCount = sessionList.length

  // Auto-expand when a new session starts
  useEffect(() => {
    if (sessionCount > 0 && state === 'hidden') {
      const first = sessionList[0]
      expand(first.clientId)
    }
    if (sessionCount === 0) {
      useOverlayStore.getState().hide()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCount])

  if (sessionCount === 0) return null

  const focusedSession = (focusedClientId ? activeSessions[focusedClientId] : null)
    ?? sessionList[0]

  const getClientName = (clientId: string): string => {
    if (selfClient?.id === clientId) return selfClient.name
    return clients?.find(c => c.id === clientId)?.name
      ?? activeSessions[clientId]?.clientName
      ?? 'Session'
  }

  // ── Minimised pill(s) ────────────────────────────────────────────────────

  if (state === 'minimised') {
    return (
      <div
        className={cn('fixed bottom-[72px] left-0 right-0 z-[25] flex justify-center gap-2 px-4 pb-2', sidebarOffset)}
        style={{ pointerEvents: 'none' }}
      >
        {sessionList.map((session) => (
          <div key={session.clientId} style={{ pointerEvents: 'auto' }}>
            <SessionPill
              clientName={getClientName(session.clientId)}
              startedAt={session.startedAt}
              onExpand={() => expand(session.clientId)}
            />
          </div>
        ))}
      </div>
    )
  }

  // ── Expanded full screen ─────────────────────────────────────────────────

  if (state !== 'expanded') return null

  const sessionLabel = `Active session — ${getClientName(focusedSession.clientId)}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={sessionLabel}
      className={cn('fixed inset-0 z-[20] bg-brand-primary flex flex-col transition-all duration-300', sidebarOffset)}
    >
      {/* Drag handle — swipe down HERE to minimise. Scoped to the handle (not the
          whole overlay) so scrolling the content or tapping a control like "End"
          can never register as a downward swipe and minimise by accident. */}
      <div
        className="flex justify-center pt-2 pb-3 shrink-0 cursor-grab touch-none"
        {...swipeToMinimise}
      >
        <div className="w-10 h-1 rounded-full bg-surface-border" />
      </div>

      {/* Multi-session switcher */}
      {sessionCount > 1 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hidden shrink-0">
          {sessionList.map((session) => (
            <button
              key={session.clientId}
              type="button"
              onClick={() => useOverlayStore.getState().setFocused(session.clientId)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                session.clientId === focusedSession.clientId
                  ? 'bg-command-blue text-white border-command-blue'
                  : 'border-surface-border text-gray-500 hover:text-gray-300',
              )}
            >
              {getClientName(session.clientId)}
            </button>
          ))}
        </div>
      )}

      {/* Minimise control */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <button
          type="button"
          onClick={minimise}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Minimise
        </button>
        <p className="text-xs text-gray-600">{getClientName(focusedSession.clientId)}</p>
      </div>

      {/* Session content — wrapped so a crash minimises to pill rather than taking down the app */}
      <div className="flex-1 overflow-hidden">
        <SessionErrorBoundary onMinimise={minimise}>
          <LiveSessionContent
            sessionId={focusedSession.sessionId}
            onMinimise={minimise}
          />
        </SessionErrorBoundary>
      </div>
    </div>
  )
}
