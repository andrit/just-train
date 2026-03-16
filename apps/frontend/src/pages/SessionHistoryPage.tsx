// ------------------------------------------------------------
// pages/SessionHistoryPage.tsx — /session/:id/history (v1.5.1)
//
// Summary layout for reviewing a past session from the timeline.
// NOT the live session screen — lighter, scan-optimised.
//
// Layout:
//   1. Stats row (sets, volume, duration)
//   2. Flat exercise list — ExerciseName · weight×reps per set, missed in amber
//   3. Subjective scores (energy, mobility, stress)
//   4. Session notes
//
// Back button restores exact scroll position and tab state on
// the client profile page via useRestoreScroll.
// Slide transition: enter from right, back to left.
// ------------------------------------------------------------

import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { cn }                                   from '@/lib/cn'
import { useSession }                           from '@/lib/queries/sessions'
import { useRestoreScroll }                     from '@/hooks/useScrollRestoration'
import { Spinner }                              from '@/components/ui/Spinner'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(startTime: string | null, endTime: string | null): string | null {
  if (!startTime || !endTime) return null
  const mins = Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
  )
  return mins >= 60
    ? `${Math.floor(mins / 60)}h ${mins % 60}m`
    : `${mins} min`
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreRow({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-highlight rounded-full"
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="font-mono text-xs text-gray-300 w-6 text-right">{value}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SessionHistoryPage(): React.JSX.Element {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const location  = useLocation()

  // Restore scroll on return (this page is the destination — runs on mount)
  useRestoreScroll()

  const { data: session, isLoading } = useSession(id ?? null)

  const handleBack = (): void => {
    const state = location.state as { from?: string; scrollKey?: string; clientName?: string; returnTab?: string } | null
    if (state?.from) {
      navigate(state.from, {
        state: {
          scrollKey: state.scrollKey,
          returnTab: state.returnTab,
        },
      })
    } else {
      navigate(-1)
    }
  }

  const backLabel = (location.state as { clientName?: string } | null)?.clientName
    ?? session?.client?.name
    ?? 'Back'

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Session not found.</p>
        <button type="button" onClick={handleBack} className="mt-4 text-sm text-brand-highlight hover:underline">
          Go back
        </button>
      </div>
    )
  }

  const workouts    = session.workouts ?? []
  const totalSets   = workouts.reduce((a, w) => a + w.sessionExercises.reduce((b, se) => b + se.sets.length, 0), 0)
  const totalVolume = workouts.reduce((a, w) => w.sessionExercises.reduce(
    (b, se) => b + se.sets.reduce((c, s) => c + ((s.weight ?? 0) * (s.reps ?? 0)), 0), a
  ), 0)
  const duration = formatDuration(session.startTime, session.endTime)

  // Workout type label
  const workoutTypeLabels = [...new Set(workouts.map((w) => w.workoutType))]
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' · ')

  return (
    <div
      className="min-h-screen bg-brand-primary animate-slide-in-right"
      style={{ '--slide-direction': '1' } as React.CSSProperties}
    >
      <div className="max-w-xl mx-auto px-4 pb-24">

        {/* Header */}
        <div className="py-4 flex items-center gap-3 border-b border-surface-border">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {backLabel}
          </button>
        </div>

        {/* Session identity */}
        <div className="py-5 border-b border-surface-border">
          <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">
            {workoutTypeLabels}
          </p>
          <h1 className="font-display text-2xl uppercase tracking-wide text-white">
            {session.name ?? 'Training Session'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{formatDate(session.date)}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 py-4 border-b border-surface-border">
          <div className="text-center">
            <p className="font-mono text-2xl font-bold text-white">{totalSets}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mt-0.5">sets</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-2xl font-bold text-white">
              {totalVolume > 0 ? Math.round(totalVolume).toLocaleString() : '—'}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mt-0.5">lbs</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-2xl font-bold text-white">{duration ?? '—'}</p>
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mt-0.5">duration</p>
          </div>
        </div>

        {/* Exercise list */}
        {workouts.length > 0 && (
          <div className="py-4 border-b border-surface-border">
            <h2 className="section-label mb-3">Exercises</h2>
            <div className="space-y-5">
              {workouts.map((workout) =>
                workout.sessionExercises.map((se) => {
                  const name = se.exercise?.name ?? 'Unknown'

                  return (
                    <div key={se.id}>
                      {/* Exercise name + target */}
                      <div className="flex items-baseline justify-between mb-2">
                        <p className="text-sm font-medium text-gray-200">{name}</p>
                        {(se.targetSets || se.targetReps || se.targetWeight) && (
                          <p className="text-xs text-gray-600 font-mono">
                            target{se.targetSets ? ` ${se.targetSets}×` : ''}{se.targetReps ?? ''}{se.targetWeight ? ` @ ${se.targetWeight}` : ''}
                          </p>
                        )}
                      </div>

                      {/* Set rows */}
                      {se.sets.length === 0 ? (
                        <p className="text-xs text-gray-700 italic pl-1">no sets logged</p>
                      ) : (
                        <div className="space-y-1.5">
                          {se.sets.map((s, i) => {
                            const missedReps   = se.targetReps   != null && (s.reps   ?? 0) < se.targetReps
                            const missedWeight = se.targetWeight != null && (s.weight ?? 0) < se.targetWeight
                            const missed       = missedReps || missedWeight
                            const surpassed    =
                              !missed &&
                              ((se.targetReps   != null && (s.reps   ?? 0) > se.targetReps) ||
                               (se.targetWeight != null && (s.weight ?? 0) > se.targetWeight))

                            return (
                              <div
                                key={s.id}
                                className="flex items-center gap-3 px-2 py-1.5 rounded-lg"
                              >
                                {/* Set number dot */}
                                <div className={cn(
                                  'w-4 h-4 rounded-full flex items-center justify-center shrink-0',
                                  missed    ? 'bg-amber-500/20'  :
                                  surpassed ? 'bg-emerald-500/30' :
                                              'bg-emerald-500/20',
                                )}>
                                  <div className={cn(
                                    'w-1.5 h-1.5 rounded-full',
                                    missed    ? 'bg-amber-400'  :
                                    surpassed ? 'bg-emerald-300' :
                                                'bg-emerald-400',
                                  )} />
                                </div>

                                {/* Set number */}
                                <span className="text-xs text-gray-600 font-mono w-4 shrink-0">
                                  {i + 1}
                                </span>

                                {/* Actual values */}
                                <span className={cn(
                                  'font-mono text-sm font-medium',
                                  missed    ? 'text-amber-400'  :
                                  surpassed ? 'text-emerald-300' :
                                              'text-gray-300',
                                )}>
                                  {[
                                    s.weight != null ? `${s.weight}` : null,
                                    s.reps   != null ? `${s.reps} reps` : null,
                                    s.durationSeconds != null ? `${s.durationSeconds}s` : null,
                                  ].filter(Boolean).join(' × ')}
                                </span>

                                {/* Target */}
                                {(se.targetReps != null || se.targetWeight != null) && (
                                  <span className="text-xs text-gray-700 font-mono ml-auto">
                                    /{[
                                      se.targetWeight != null ? `${se.targetWeight}` : null,
                                      se.targetReps   != null ? `${se.targetReps}` : null,
                                    ].filter(Boolean).join('×')}
                                  </span>
                                )}

                                {/* RPE */}
                                {s.rpe != null && (
                                  <span className="text-xs text-gray-700">RPE {s.rpe}</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Subjective scores */}
        {(session.energyLevel || session.mobilityFeel || session.stressLevel) && (
          <div className="py-4 border-b border-surface-border">
            <h2 className="section-label mb-3">How it felt</h2>
            <div className="space-y-2.5">
              {session.energyLevel  != null && <ScoreRow label="Energy"   value={session.energyLevel}  />}
              {session.mobilityFeel != null && <ScoreRow label="Mobility" value={session.mobilityFeel} />}
              {session.stressLevel  != null && <ScoreRow label="Stress"   value={session.stressLevel}  />}
            </div>
          </div>
        )}

        {/* Session notes */}
        {session.sessionNotes && (
          <div className="py-4">
            <h2 className="section-label mb-2">Notes</h2>
            <p className="text-sm text-gray-300 leading-relaxed">{session.sessionNotes}</p>
          </div>
        )}

      </div>
    </div>
  )
}
