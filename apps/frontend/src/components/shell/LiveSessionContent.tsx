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

import { useState }                      from 'react'
import { useNavigate }                   from 'react-router-dom'
import { cn }                             from '@/lib/cn'
import { interactions }                   from '@/lib/interactions'
import { usePreferences }                 from '@/hooks/usePreferences'
import { useUXEvent }                     from '@/hooks/useUXEvent'
import { useRestTimer }                   from '@/hooks/useRestTimer'
import { useAuthStore }                   from '@/store/authStore'
import { useSessionStore }                from '@/store/sessionStore'
import { useOverlayStore }                from '@/store/overlayStore'
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

  const { data: session, isLoading, error } = useSession(sessionId)
  const endSession                           = useEndSession()
  const discardSession                       = useDiscardSession()
  const updateSession                        = useUpdateSession()
  const { endSession: clearSessionStore }    = useSessionStore()

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
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Session not found.</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 text-sm text-command-blue hover:underline"
        >
          Go home
        </button>
      </div>
    )
  }

  const workouts   = session.workouts ?? []
  const clientName = session.client?.name ?? 'Training Session'

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

        {/* Workout blocks */}
        {workouts.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <p className="text-4xl mb-4" aria-hidden>🏋️</p>
              <p className="text-gray-300 font-medium mb-1">Ready to train</p>
              <p className="text-gray-600 text-sm mb-6">Add your first workout block to get started</p>
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
                Add Block
              </button>
            </div>
          </div>
        ) : sessionLayout === 'horizontal' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {workouts.length > 1 && (
              <div className="flex justify-center gap-1.5 py-3 shrink-0">
                {workouts.map((w) => (
                  <div key={w.id} className="w-1.5 h-1.5 rounded-full bg-surface-border" />
                ))}
              </div>
            )}
            <div
              className="flex-1 flex gap-3 overflow-x-auto scrollbar-hidden px-4 pb-6 snap-x snap-mandatory"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {workouts.map((workout) => (
                <div key={workout.id} className="snap-center">
                  <WorkoutBlock
                    workout={workout}
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
            {workouts.map((workout) => (
              <WorkoutBlock
                key={workout.id}
                workout={workout}
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

      {/* Add Block FAB — labelled so its purpose is clear */}
      {workouts.length > 0 && (
        <button
          type="button"
          onClick={() => setAddBlockOpen(true)}
          aria-label="Add workout block"
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
          <span className="text-sm font-medium pr-1">Add Block</span>
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
        hasWork={(workouts ?? []).some(w => w.sessionExercises.some(se => se.sets.length > 0))}
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
