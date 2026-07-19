// ------------------------------------------------------------
// components/shell/LiveSessionContent.tsx (v2.0.0)
//
// The session UI, extracted from LiveSessionPage so it can be
// used both inside the persistent overlay AND as a standalone
// page (for direct URL navigation / PWA launch).
//
// Accepts sessionId as a prop instead of useParams().
// onMinimise — called when the user wants to minimise the
//              overlay (swipe down or minimise button).
//              In standalone page mode this is undefined.
// ------------------------------------------------------------

import { useState, useEffect }           from 'react'
import { useNavigate }                   from 'react-router-dom'
import { cn }                             from '@/lib/cn'
import { interactions }                   from '@/lib/interactions'
import { usePreferences }                 from '@/hooks/usePreferences'
import { useUXEvent }                     from '@/hooks/useUXEvent'
import { useRestTimer }                   from '@/hooks/useRestTimer'
import { useAuthStore }                   from '@/store/authStore'
import { useSessionStore }                from '@/store/sessionStore'
import { useOverlayStore }                from '@/store/overlayStore'
import { apiClient, ApiError }            from '@/lib/api'
import { useSession, useEndSession, useDiscardSession, useUpdateSession } from '@/lib/queries/sessions'
import { WorkoutBlock }                   from '@/components/session/WorkoutBlock'
import { AddBlockSheet }                  from '@/components/session/AddBlockSheet'
import { EndSessionModal }                from '@/components/session/EndSessionModal'
import { PostSessionWrapUp }              from '@/components/session/PostSessionWrapUp'
import { Spinner }                        from '@/components/ui/Spinner'

interface LiveSessionContentProps {
  sessionId:    string
  /** Called when the user minimises the overlay. Undefined in page mode. */
  onMinimise?:  () => void
}

export default function LiveSessionContent({
  sessionId,
  onMinimise: _onMinimise,
}: LiveSessionContentProps): React.JSX.Element {
  const navigate          = useNavigate()
  const trainer           = useAuthStore((s) => s.trainer)
  const { sessionLayout, restDurationSeconds } = usePreferences()
  const { fire }          = useUXEvent()
  const restTimer         = useRestTimer()

  const { data: session, isLoading, error, refetch } = useSession(sessionId)
  const endSession                           = useEndSession()
  const discardSession                       = useDiscardSession()
  const updateSession                        = useUpdateSession()
  const { activeSessions, endSession: clearSessionStore } = useSessionStore()

  // On mount: if the query is already in error state (e.g. network blip on a
  // previous open), fire a fresh fetch so re-opening the session always retries.
  useEffect(() => {
    if (error) void refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // If the session is 404 on the backend the store is stale — clean it up so the
  // user isn't stuck in a broken overlay with a phantom timer.
  useEffect(() => {
    if (error instanceof ApiError && error.status === 404) {
      const clientId = Object.keys(activeSessions).find(
        cid => activeSessions[cid]?.sessionId === sessionId
      )
      if (clientId) clearSessionStore(clientId)
      useOverlayStore.getState().hide()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])

  const [showEndModal,     setShowEndModal]     = useState(false)
  const [showDiscardMenu,  setShowDiscardMenu]  = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [addBlockOpen,     setAddBlockOpen]     = useState(false)
  const [showWrapUp,       setShowWrapUp]       = useState(false)

  const weightUnit = trainer?.weightUnitPreference ?? 'lbs'

  const handleSetLogged = (restSeconds = restDurationSeconds): void => {
    restTimer.start(restSeconds)
  }

  const handleDiscard = (): void => {
    discardSession.mutate(
      { id: sessionId },
      {
        onSuccess: () => {
          if (session?.clientId) clearSessionStore(session.clientId)
          useOverlayStore.getState().hide()
          navigate('/')
        },
      },
    )
  }

  const handleEndSession = (scores: {
    energyLevel:  number
    mobilityFeel: number
    stressLevel:  number
    sessionNotes?: string
  }): void => {
    endSession.mutate(
      { id: sessionId, ...scores },
      {
        onSuccess: () => {
          if (session?.clientId) clearSessionStore(session.clientId)
          fire('session_end', { entityId: sessionId })
          // Show wrap-up before navigating to summary
          setShowEndModal(false)
          setShowWrapUp(true)
        },
      },
    )
  }

  const handleWrapUpDone = (name?: string): void => {
    if (name && session?.id) {
      updateSession.mutate(
        { id: session.id, name },
        { onSuccess: () => navigate(`/session/${sessionId}/summary`) },
      )
    } else {
      navigate(`/session/${sessionId}/summary`)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" className="text-command-blue" />
      </div>
    )
  }

  if (error || !session) {
    // Distinguish the failure so the message is truthful and the actions fit:
    //   network error → transient, retry
    //   500+          → server error (e.g. a schema/query fault), transient-ish, retry
    //   404           → the session is genuinely gone, retry is pointless
    // Previously every error rendered "Session not found", which masked 500s
    // (e.g. a DB drift) and made real backend faults undiagnosable from the UI.
    const apiStatus      = error instanceof ApiError ? error.status : null
    const isNetworkError = !!error && !(error instanceof ApiError)
    const isServerError  = apiStatus !== null && apiStatus >= 500
    const isNotFound     = apiStatus === 404
    const canRetry       = isNetworkError || isServerError

    const message =
      isNetworkError ? "Can't reach server — check your connection."
      : isServerError ? `Something went wrong loading this session (server error ${apiStatus}). This is usually temporary — try again.`
      : isNotFound    ? 'Session not found.'
      :                 'Could not load this session.'

    const handleForceClose = (): void => {
      // Best-effort delete on the backend — ignore failures (may be offline or already gone).
      apiClient.delete(`/sessions/${sessionId}`).catch(() => {})
      const clientId = Object.keys(activeSessions).find(
        cid => activeSessions[cid]?.sessionId === sessionId
      )
      if (clientId) clearSessionStore(clientId)
      useOverlayStore.getState().hide()
    }

    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-gray-400">{message}</p>
        {canRetry && (
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-sm text-command-blue hover:underline block mx-auto"
          >
            Try again
          </button>
        )}
        <button
          type="button"
          onClick={handleForceClose}
          className="text-sm text-red-400 hover:underline block mx-auto"
        >
          Close session
        </button>
      </div>
    )
  }

  const sessionExercises = session.sessionExercises ?? []
  const clientName       = session.client?.name ?? 'Training Session'

  // Group exercises by workoutType for visual block rendering
  const exerciseGroups: { type: string; items: typeof sessionExercises }[] = []
  for (const ex of sessionExercises) {
    const last = exerciseGroups[exerciseGroups.length - 1]
    if (last && last.type === ex.workoutType) {
      last.items.push(ex)
    } else {
      exerciseGroups.push({ type: ex.workoutType, items: [ex] })
    }
  }

  return (
    <>
      <div className="flex flex-col h-full bg-brand-primary">
        {/* Session header */}
        <header className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-600 uppercase tracking-wider">{clientName}</p>
            <h1 className="font-display text-xl uppercase tracking-wide text-white truncate">
              {session.name ?? 'Training Session'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">

            {/* Discard confirm inline */}
            {showDiscardConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Discard session?</span>
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={discardSession.isPending}
                  className="text-xs text-red-400 hover:text-red-300 font-medium"
                >
                  {discardSession.isPending ? '…' : 'Discard'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : showDiscardMenu ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowDiscardMenu(false); setShowDiscardConfirm(true) }}
                  className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10"
                >
                  Discard Session
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscardMenu(false)}
                  className="text-xs text-gray-500 hover:text-gray-300 p-1"
                >
                  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                    <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                {/* ⋯ menu */}
                <button
                  type="button"
                  onClick={() => setShowDiscardMenu(true)}
                  aria-label="Session options"
                  className={cn(
                    'p-1.5 rounded-lg text-gray-500 hover:text-gray-300',
                    interactions.button.base,
                  )}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <circle cx="4" cy="8" r="1.25" />
                    <circle cx="8" cy="8" r="1.25" />
                    <circle cx="12" cy="8" r="1.25" />
                  </svg>
                </button>

                {/* End session */}
                <button
                  type="button"
                  onClick={() => setShowEndModal(true)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium',
                    'bg-command-blue/10 border border-command-blue/30 text-command-blue',
                    'hover:bg-command-blue/20',
                    interactions.button.base,
                    interactions.button.press,
                  )}
                >
                  End
                </button>
              </>
            )}
          </div>
        </header>

        {/* Session exercises (grouped by workoutType) */}
        {exerciseGroups.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-4xl mb-4" aria-hidden>🏋️</p>
              <p className="text-gray-300 font-medium mb-1">Ready to train</p>
              <p className="text-gray-600 text-sm mb-6">Add your first exercise to get started</p>
              <button
                type="button"
                onClick={() => setAddBlockOpen(true)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 rounded-xl mx-auto',
                  'bg-command-blue text-white font-medium',
                  interactions.button.base,
                  interactions.button.press,
                )}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add Exercise
              </button>
            </div>
          </div>
        ) : sessionLayout === 'horizontal' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {exerciseGroups.length > 1 && (
              <div className="flex justify-center gap-1.5 py-3 shrink-0">
                {exerciseGroups.map((g) => (
                  <div key={g.type} className="w-1.5 h-1.5 rounded-full bg-surface-border" />
                ))}
              </div>
            )}
            <div
              className="flex-1 flex gap-3 overflow-x-auto scrollbar-hidden px-4 pb-6 snap-x snap-mandatory"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {exerciseGroups.map((group) => (
                <div key={group.type} className="snap-center">
                  <WorkoutBlock
                    workoutType={group.type}
                    sessionExercises={group.items}
                    sessionId={sessionId}
                    weightUnit={weightUnit}
                    layout="horizontal"
                    clientId={session.clientId}
                    onSetLogged={handleSetLogged}
                    onAddBlock={() => setAddBlockOpen(true)}
                    restDurationSeconds={restDurationSeconds}
                    restTimer={restTimer}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 p-4 pb-6">
            {exerciseGroups.map((group) => (
              <WorkoutBlock
                key={group.type}
                workoutType={group.type}
                sessionExercises={group.items}
                sessionId={sessionId}
                weightUnit={weightUnit}
                layout="vertical"
                clientId={session.clientId}
                onSetLogged={handleSetLogged}
                onAddBlock={() => setAddBlockOpen(true)}
                restDurationSeconds={restDurationSeconds}
                restTimer={restTimer}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Exercise FAB */}
      {exerciseGroups.length > 0 && (
        <button
          type="button"
          onClick={() => setAddBlockOpen(true)}
          aria-label="Add exercise"
          className={cn(
            'fixed bottom-6 right-4 z-30',
            'flex items-center gap-2 px-4 h-12 rounded-full',
            'bg-command-blue text-white shadow-lg',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-medium pr-1">Add Exercise</span>
        </button>
      )}

      <AddBlockSheet
        open={addBlockOpen}
        sessionId={sessionId}
        onClose={() => setAddBlockOpen(false)}
      />

      <EndSessionModal
        open={showEndModal}
        onConfirm={handleEndSession}
        onCancel={() => setShowEndModal(false)}
        onDiscard={handleDiscard}
        loading={endSession.isPending || discardSession.isPending}
        hasWork={sessionExercises.some(se => se.sets.length > 0)}
      />

      {showWrapUp && session && (
        <PostSessionWrapUp
          session={session}
          onDone={handleWrapUpDone}
          isSaving={updateSession.isPending}
        />
      )}
    </>
  )
}
