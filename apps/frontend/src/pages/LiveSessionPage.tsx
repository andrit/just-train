// ------------------------------------------------------------
// pages/LiveSessionPage.tsx — /session/:id (v1.5.0)
//
// The active workout screen. Layout branches on sessionLayout preference:
//   horizontal — workout blocks scroll left/right (default, focus mode)
//   vertical   — blocks stacked top-to-bottom (overview mode)
//
// Nav is collapsed to a thin strip during the session.
// Rest timer banner floats at the top of the screen.
// End Session flow → EndSessionModal → subjective scores → /session/:id/summary
// ------------------------------------------------------------

import { useState }                      from 'react'
import { useParams, useNavigate }         from 'react-router-dom'
import { cn }                             from '@/lib/cn'
import { interactions }                   from '@/lib/interactions'
import { usePreferences }                 from '@/hooks/usePreferences'
import { useUXEvent }                     from '@/hooks/useUXEvent'
import { useRestTimer }                   from '@/hooks/useRestTimer'
import { useAuthStore }                   from '@/store/authStore'
import { useSession, useEndSession }      from '@/lib/queries/sessions'
import { WorkoutBlock }                   from '@/components/session/WorkoutBlock'
import { AddBlockSheet }                  from '@/components/session/AddBlockSheet'
import { RestTimerBanner }                from '@/components/session/RestTimerBanner'
import { EndSessionModal }                from '@/components/session/EndSessionModal'
import { Spinner }                        from '@/components/ui/Spinner'

export default function LiveSessionPage(): React.JSX.Element {
  const { id }      = useParams<{ id: string }>()
  const navigate    = useNavigate()
  const trainer     = useAuthStore((s) => s.trainer)
  const { sessionLayout } = usePreferences()
  const { fire }    = useUXEvent()
  const restTimer   = useRestTimer()

  const { data: session, isLoading, error } = useSession(id ?? null)
  const endSession = useEndSession()

  const [showEndModal,   setShowEndModal]  = useState(false)
  const [navExpanded,    setNavExpanded]   = useState(false)
  const [addBlockOpen,   setAddBlockOpen]  = useState(false)

  const weightUnit = trainer?.weightUnitPreference ?? 'lbs'

  // ── Handler: set logged → start rest timer ──────────────────────────────

  const handleSetLogged = (restSeconds = 90): void => {
    restTimer.start(restSeconds)
  }

  // ── Handler: end session ─────────────────────────────────────────────────

  const handleEndSession = (scores: {
    energyLevel:  number
    mobilityFeel: number
    stressLevel:  number
    sessionNotes?: string
  }): void => {
    if (!id) return
    endSession.mutate(
      { id, ...scores },
      {
        onSuccess: () => {
          fire('session_end', { entityId: id })
          navigate(`/session/${id}/summary`)
        },
      },
    )
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Session not found.</p>
        <button type="button" onClick={() => navigate('/')} className="mt-4 text-sm text-brand-highlight hover:underline">
          Go home
        </button>
      </div>
    )
  }

  const workouts = session.workouts ?? []
  const clientName = session.client?.name ?? 'Unknown'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Rest timer — floats above everything */}
      <RestTimerBanner timer={restTimer} />

      <div className={cn(
        'flex flex-col',
        'min-h-screen bg-brand-primary',
        restTimer.isRunning && 'pt-14', // Push content down when timer banner visible
      )}>

        {/* Session header */}
        <header className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-gray-600 uppercase tracking-wider">
              {clientName}
            </p>
            <h1 className="font-display text-xl uppercase tracking-wide text-white truncate">
              {session.name ?? 'Training Session'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Layout toggle */}
            <button
              type="button"
              onClick={() => {/* Phase 4.5: toggle via updatePreference */}}
              aria-label="Toggle layout"
              title={`Switch to ${sessionLayout === 'horizontal' ? 'vertical' : 'horizontal'} layout`}
              className={cn(
                'p-2 rounded-lg text-gray-500 hover:text-gray-300',
                interactions.icon.base,
                interactions.icon.hover,
              )}
            >
              {sessionLayout === 'horizontal' ? (
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                  <rect x="2" y="2" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="2" y="8" width="12" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </button>

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

          // ── Horizontal scroll layout ──────────────────────────────────────
          <div className="flex-1 flex flex-col">
            {/* Workout nav dots */}
            {workouts.length > 1 && (
              <div className="flex justify-center gap-1.5 py-3">
                {workouts.map((w, i) => (
                  <div
                    key={w.id}
                    className="w-1.5 h-1.5 rounded-full bg-surface-border"
                  />
                ))}
              </div>
            )}

            <div
              className="flex-1 flex gap-3 overflow-x-auto scrollbar-hidden px-4 pb-24 snap-x snap-mandatory"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {workouts.map((workout) => (
                <div key={workout.id} className="snap-center">
                  <WorkoutBlock
                    workout={workout}
                    sessionId={id!}
                    weightUnit={weightUnit}
                    layout="horizontal"
                    onSetLogged={handleSetLogged}
                  />
                </div>
              ))}
            </div>
          </div>

        ) : (

          // ── Vertical stack layout ─────────────────────────────────────────
          <div className="flex-1 space-y-4 p-4 pb-24">
            {workouts.map((workout) => (
              <WorkoutBlock
                key={workout.id}
                workout={workout}
                sessionId={id!}
                weightUnit={weightUnit}
                layout="vertical"
                onSetLogged={handleSetLogged}
              />
            ))}
          </div>
        )}

      </div>

      {/* Add Block FAB — shown when blocks exist */}
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

      {/* Add block sheet */}
      <AddBlockSheet
        open={addBlockOpen}
        sessionId={id!}
        onClose={() => setAddBlockOpen(false)}
      />

      {/* End session modal */}
      <EndSessionModal
        open={showEndModal}
        onConfirm={handleEndSession}
        onCancel={() => setShowEndModal(false)}
        loading={endSession.isPending}
      />
    </>
  )
}
