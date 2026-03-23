// ------------------------------------------------------------
// components/shell/SessionHistoryPanel.tsx (v2.2.0)
//
// Wraps the session history view as a slide-in panel.
// Accepts sessionId as a prop instead of useParams().
// Uses the same content as SessionHistoryPage — avoids
// full refactor of that page for now.
// ------------------------------------------------------------

import { useState }             from 'react'
import { cn }                  from '@/lib/cn'
import { interactions }        from '@/lib/interactions'
import { useSession }          from '@/lib/queries/sessions'
import { formatDate, formatDuration, formatTotalVolume } from '@/lib/formatters'
import { Spinner }             from '@/components/ui/Spinner'

function ScoreRow({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
        <div className="h-full bg-brand-highlight rounded-full" style={{ width: `${value * 10}%` }} />
      </div>
      <span className="font-mono text-xs text-gray-300 w-6 text-right">{value}</span>
    </div>
  )
}

interface SessionHistoryPanelProps {
  sessionId: string
  onClose:   () => void
}

export function SessionHistoryPanel({ sessionId, onClose }: SessionHistoryPanelProps): React.JSX.Element {
  const { data: session, isLoading } = useSession(sessionId)
  const [prFilterOn, setPrFilterOn]  = useState(false)

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full pt-20">
        <Spinner size="lg" className="text-brand-highlight" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-6 text-center pt-20">
        <p className="text-gray-400">Session not found.</p>
        <button type="button" onClick={onClose} className="mt-4 text-sm text-brand-highlight hover:underline">
          Go back
        </button>
      </div>
    )
  }

  const duration    = formatDuration(session.startTime ?? null, session.endTime ?? null)
  const totalSets   = session.workouts?.reduce((acc, w) =>
    acc + w.sessionExercises.reduce((a, se) => a + se.sets.length, 0), 0
  ) ?? 0
  const totalVolume = session.workouts?.reduce((acc, w) =>
    acc + w.sessionExercises.reduce((a, se) =>
      a + se.sets.reduce((s, set) =>
        s + ((set.reps ?? 0) * (set.weight ?? 0)), 0
      ), 0
    ), 0
  ) ?? 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-surface-border shrink-0">
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 mb-4',
            interactions.button.base,
          )}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">
          {session.client?.name ?? 'Session'}
        </p>
        <h1 className="font-display text-2xl uppercase tracking-wide text-white leading-tight">
          {session.name ?? 'Training Session'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{formatDate(session.date)}</p>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 px-4 py-4 border-b border-surface-border shrink-0">
        {duration && (
          <div className="flex-1 text-center">
            <p className="font-display text-xl text-white">{duration}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Duration</p>
          </div>
        )}
        <div className="flex-1 text-center">
          <p className="font-display text-xl text-white">{totalSets}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Sets</p>
        </div>
        {totalVolume > 0 && (
          <div className="flex-1 text-center">
            <p className="font-display text-xl text-white">
              {formatTotalVolume(totalVolume)}
            </p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Volume</p>
          </div>
        )}
      </div>

      {/* PR filter */}
      <div className="px-4 pb-3 border-b border-surface-border shrink-0">
        <button
          type="button"
          onClick={() => setPrFilterOn(!prFilterOn)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
            prFilterOn
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'border-surface-border text-gray-500 hover:border-gray-500 hover:text-gray-300',
          )}
        >
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
            <path d="M6 1l1.2 2.8H10L7.6 5.5l.9 2.8L6 6.8l-2.5 1.5.9-2.8L2 3.8h2.8L6 1z" fill="currentColor" />
          </svg>
          PRs only
        </button>
      </div>

      {/* Exercise breakdown */}
      <div className="px-4 py-4 space-y-5 flex-1">
        {(session.workouts ?? []).map((workout) => (
          <div key={workout.id}>
            {/* Block type label */}
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
              {workout.workoutType}
            </p>

            <div className="space-y-2">
              {workout.sessionExercises.map((se) => (
                <div key={se.id} className="bg-surface rounded-xl px-3 py-3 border border-surface-border">
                  <p className="font-medium text-sm text-gray-200 mb-2">
                    {se.exercise?.name ?? 'Unknown'}
                  </p>
                  <div className="space-y-1">
                    {se.sets
                      .filter(set => !prFilterOn || set.isPR || set.isPRVolume)
                      .map((set, i) => {
                      const hitReps   = !se.targetReps   || (set.reps ?? 0) >= se.targetReps
                      const hitWeight = !se.targetWeight || (set.weight ?? 0) >= se.targetWeight
                      const hit = hitReps && hitWeight

                      return (
                        <div key={set.id} className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-gray-600 w-5">{i + 1}</span>
                          <div className={cn(
                            'flex items-center gap-1 flex-1',
                            hit ? 'text-emerald-400' : 'text-amber-400',
                          )}>
                            {set.weight != null && <span>{set.weight}</span>}
                            {set.weight != null && set.reps != null && <span className="text-gray-600">×</span>}
                            {set.reps != null && <span>{set.reps}</span>}
                            {set.durationSeconds != null && <span>{set.durationSeconds}s</span>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {set.isPR && (
                              <span className="text-[9px] font-medium bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-full">
                                1RM
                              </span>
                            )}
                            {set.isPRVolume && (
                              <span className="text-[9px] font-medium bg-brand-highlight/10 border border-brand-highlight/30 text-brand-highlight px-1.5 py-0.5 rounded-full">
                                Vol
                              </span>
                            )}
                            {!set.isPR && !set.isPRVolume && (se.targetReps || se.targetWeight) && (
                              <span className="text-gray-700 text-[10px]">
                                {se.targetWeight && `${se.targetWeight}×`}{se.targetReps}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {se.sets.length === 0 && (
                      <p className="text-xs text-gray-600 italic">No sets logged</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Subjective scores */}
        {(session.energyLevel || session.mobilityFeel || session.stressLevel) && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">Session Scores</p>
            <div className="space-y-2">
              {session.energyLevel  != null && <ScoreRow label="Energy"   value={session.energyLevel} />}
              {session.mobilityFeel != null && <ScoreRow label="Mobility" value={session.mobilityFeel} />}
              {session.stressLevel  != null && <ScoreRow label="Stress"   value={session.stressLevel} />}
            </div>
          </div>
        )}

        {/* Notes */}
        {session.sessionNotes && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Notes</p>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {session.sessionNotes}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
