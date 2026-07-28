// ------------------------------------------------------------
// components/session/SessionExerciseBreakdown.tsx
//
// Shared per-exercise breakdown: each exercise → its sets (reps × weight,
// colour-coded vs target), Load/Vol record chips, optional per-exercise volume
// subtotal + est. 1RM, and an optional grand-total volume footer.
//
// Used by the post-completion summary (SessionSummaryPage) and session history
// (SessionHistoryPanel). Keep the two in lockstep — render here, not in both.
// ------------------------------------------------------------

import type { ReactNode } from 'react'
import type { SessionExerciseResponse } from '@trainer-app/shared'
import { cn }           from '@/lib/cn'
import { formatEpley }  from '@/lib/formatters'

interface SessionExerciseBreakdownProps {
  sessionExercises:  SessionExerciseResponse[]
  /** Per-exercise volume subtotal + grand-total footer row. */
  showVolumeTotals?: boolean
  /** Per-exercise estimated 1RM (Epley of the best set). */
  showEst1rm?:       boolean
  /** Filter each exercise's sets to record-holders only. */
  prFilter?:         boolean
  /** Optional media thumbnails rendered beside each exercise name. */
  renderMediaThumbs?: (se: SessionExerciseResponse) => ReactNode
}

function exerciseVolume(se: SessionExerciseResponse): number {
  return se.sets.reduce((sum, set) => sum + ((set.weight ?? 0) * (set.reps ?? 0)), 0)
}

/** Best Epley 1RM estimate across an exercise's sets; null for non-resistance. */
function bestEpley(se: SessionExerciseResponse): number | null {
  let best: number | null = null
  for (const set of se.sets) {
    const e = formatEpley(set.weight, set.reps)
    if (e != null && (best == null || e > best)) best = e
  }
  return best
}

export function SessionExerciseBreakdown({
  sessionExercises,
  showVolumeTotals = false,
  showEst1rm = false,
  prFilter = false,
  renderMediaThumbs,
}: SessionExerciseBreakdownProps): React.JSX.Element {
  const grandTotalVolume = sessionExercises.reduce((acc, se) => acc + exerciseVolume(se), 0)

  return (
    <div className="space-y-3">
      {sessionExercises.map((se) => {
        const vol    = exerciseVolume(se)
        const est1rm = showEst1rm ? bestEpley(se) : null
        const showFooter = (showEst1rm && est1rm != null) || (showVolumeTotals && vol > 0)

        return (
          <div key={se.id} className="bg-surface rounded-xl px-3 py-3 border border-surface-border">
            <div className="flex items-center gap-2 mb-2">
              <p className="font-medium text-sm text-gray-200">{se.exercise?.name ?? 'Unknown'}</p>
              {renderMediaThumbs?.(se)}
            </div>

            <div className="space-y-1">
              {se.sets
                .filter((set) => !prFilter || set.isLoadRecord || set.isVolumeRecord)
                .map((set, i) => {
                  const hitReps   = !se.targetReps   || (set.reps ?? 0)   >= se.targetReps
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
                        {set.isLoadRecord && (
                          <span className="text-[9px] font-medium bg-amber-500/15 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-full">
                            Load
                          </span>
                        )}
                        {set.isVolumeRecord && (
                          <span className="text-[9px] font-medium bg-command-blue/10 border border-command-blue/30 text-command-blue px-1.5 py-0.5 rounded-full">
                            Vol
                          </span>
                        )}
                        {!set.isLoadRecord && !set.isVolumeRecord && (se.targetReps || se.targetWeight) && (
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

            {showFooter && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-border/60 text-[11px]">
                <span className="text-gray-500">
                  {showEst1rm && est1rm != null && (
                    <>est. 1RM <span className="font-mono text-gray-300">{est1rm}</span></>
                  )}
                </span>
                {showVolumeTotals && vol > 0 && (
                  <span className="text-gray-500">
                    vol <span className="font-mono text-gray-300">{Math.round(vol).toLocaleString()}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {showVolumeTotals && grandTotalVolume > 0 && (
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface border border-surface-border">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">Total volume</span>
          <span className="font-mono text-lg font-bold text-white">
            {Math.round(grandTotalVolume).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}
