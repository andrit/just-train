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
import { useSession, useEndSession }      from '@/lib/queries/sessions'
import { WorkoutBlock }                   from '@/components/session/WorkoutBlock'
import { AddBlockSheet }                  from '@/components/session/AddBlockSheet'
import { RestTimerBanner }                from '@/components/session/RestTimerBanner'
import { EndSessionModal }                from '@/components/session/EndSessionModal'
import { Spinner }                        from '@/components/ui/Spinner'

interface LiveSessionContentProps {
  sessionId:    string
  /** Called when the user minimises the overlay. Undefined in page mode. */
  onMinimise?:  () => void
}

export default function LiveSessionContent({
  sessionId,
  onMinimise,
}: LiveSessionContentProps): React.JSX.Element {
  const navigate          = useNavigate()
  const trainer           = useAuthStore((s) => s.trainer)
  const { sessionLayout } = usePreferences()
  const { fire }          = useUXEvent()
  const restTimer         = useRestTimer()

  const { data: session, isLoading, error } = useSession(sessionId)
  const endSession                           = useEndSession()
  const { endSession: clearSessionStore }    = useSessionStore()

  const [showEndModal, setShowEndModal] = useState(false)
  const [addBlockOpen, setAddBlockOpen] = useState(false)

  const weightUnit = trainer?.weightUnitPreference ?? 'lbs'

  const handleSetLogged = (restSeconds = 90): void => {
    restTimer.start(restSeconds)
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
          // Navigate to summary — works in both overlay and page context
          navigate(`/session/${sessionId}/summary`)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" className="text-brand-highlight" />
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
          className="mt-4 text-sm text-brand-highlight hover:underline"
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
      <RestTimerBanner timer={restTimer} />

      <div className={cn(
        'flex flex-col h-full bg-brand-primary',
        restTimer.isRunning && 'pt-14',
      )}>
        {/* Session header */}
        <header className="px-4 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-600 uppercase tracking-wider">{clientName}</p>
            <h1 className="font-display text-xl uppercase tracking-wide text-white truncate">
              {session.name ?? 'Training Session'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* End session */}
            <button
              type="button"
              onClick={() => setShowEndModal(true)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium',
                'bg-brand-highlight/10 border border-brand-highlight/30 text-brand-highlight',
                'hover:bg-brand-highlight/20',
                interactions.button.base,
                interactions.button.press,
              )}
            >
              End
            </button>
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
                  'bg-brand-highlight text-white font-medium',
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
                    onSetLogged={handleSetLogged}
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
                onSetLogged={handleSetLogged}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add block FAB */}
      {workouts.length > 0 && (
        <button
          type="button"
          onClick={() => setAddBlockOpen(true)}
          aria-label="Add workout block"
          className={cn(
            'fixed bottom-6 right-4 z-30',
            'w-12 h-12 rounded-full',
            'bg-brand-highlight text-white shadow-lg',
            'flex items-center justify-center',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
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
        loading={endSession.isPending}
      />
    </>
  )
}
