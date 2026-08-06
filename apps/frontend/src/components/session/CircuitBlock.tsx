// ------------------------------------------------------------
// components/session/CircuitBlock.tsx
//
// Live execution of a circuit (interwoven exercises). Walks round-major:
// log the current exercise's set → advance to the next exercise in the box →
// after the last one, the round ticks over and rest fires. Reuses ExerciseBlock
// for the current member's input (per-side, prefill, cardio all come free); the
// round-major position is DERIVED from each member's logged set count, so it's
// robust to reload and to logging the wrong order.
// ------------------------------------------------------------

import { useState }              from 'react'
import { cn }                    from '@/lib/cn'
import { formatSeconds }         from '@/lib/formatters'
import { ExerciseBlock }         from './ExerciseBlock'
import type { SessionExerciseResponse } from '@trainer-app/shared'

interface CircuitBlockProps {
  sessionExercises:    SessionExerciseResponse[]   // circuit members, in round order
  sessionId:           string
  weightUnit:          string
  layout:              'horizontal' | 'vertical'
  clientId:            string | null
  onSetLogged:         (restSeconds?: number) => void
  restDurationSeconds?: number
  restTimer?: {
    isRunning:  boolean
    remaining:  number
    skip:       () => void
  }
}

// "Shoulder Circuit" when every member shares a body part, else "Circuit".
function circuitLabel(members: SessionExerciseResponse[]): string {
  const parts = new Set(members.map((m) => m.exercise?.bodyPart?.name).filter(Boolean))
  if (parts.size === 1) {
    const p = [...parts][0] as string
    const nice = p.replace('_', ' ')
    return `${nice.charAt(0).toUpperCase()}${nice.slice(1)} Circuit`
  }
  return 'Circuit'
}

export function CircuitBlock({
  sessionExercises: members, sessionId, weightUnit, layout, clientId,
  onSetLogged, restDurationSeconds = 90, restTimer,
}: CircuitBlockProps): React.JSX.Element {
  const [prFlash, setPrFlash] = useState<{ label: string } | null>(null)

  // Rounds = the shared target_sets (enforced equal at creation; fall back to max).
  const rounds = Math.max(1, ...members.map((m) => m.targetSets ?? 0))

  // Round-major position, derived from logged set counts.
  const counts   = members.map((m) => m.sets.length)
  const maxCount = counts.length ? Math.max(...counts) : 0
  const allEqual = counts.every((c) => c === maxCount)
  const isComplete   = allEqual && maxCount >= rounds
  const currentRound = Math.min(allEqual ? maxCount + 1 : maxCount, rounds)
  const nextIndex    = allEqual ? 0 : counts.findIndex((c) => c < maxCount)
  const currentMember = members[nextIndex]

  const label = circuitLabel(members)

  // Fire rest ONLY when the last exercise of a round is logged; PR flash always.
  // nextIndex is the member being logged (invalidation advances it afterward).
  const roundCompletesOnThisLog = nextIndex === members.length - 1
  const handleMemberSetLogged = (
    restSeconds = restDurationSeconds,
    pr?: { isLoadRecord: boolean; isVolumeRecord: boolean; weight?: number | null; reps?: number | null },
  ): void => {
    if (pr?.isLoadRecord || pr?.isVolumeRecord) {
      setPrFlash({ label: pr.weight && pr.reps ? `${pr.weight} × ${pr.reps}` : 'New best' })
      setTimeout(() => setPrFlash(null), 1800)
    }
    if (roundCompletesOnThisLog) onSetLogged(restSeconds)
  }

  const showRestTimer = restTimer?.isRunning

  return (
    <div className={cn(
      'flex flex-col bg-brand-secondary rounded-2xl border border-surface-border',
      layout === 'horizontal' ? 'w-[85vw] max-w-sm shrink-0 h-full' : 'w-full',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="text-[10px] uppercase tracking-widest font-medium text-command-blue">{label}</span>
        <span className="text-[10px] text-gray-500">
          {isComplete ? 'Complete' : `Round ${currentRound} of ${rounds}`}
        </span>
      </div>

      {/* Progress grid — one row per exercise, one dot per round */}
      <div className="px-4 py-3 space-y-1.5 border-b border-surface-border">
        {members.map((m, mi) => (
          <div key={m.id} className="flex items-center gap-2">
            <span className={cn(
              'text-[11px] truncate flex-1',
              mi === nextIndex && !isComplete ? 'text-white font-medium' : 'text-gray-500',
            )}>
              {m.exercise?.name ?? 'Exercise'}
            </span>
            <div className="flex gap-1 shrink-0">
              {Array.from({ length: rounds }).map((_, ri) => {
                const round = ri + 1
                const done    = m.sets.length >= round
                const current = mi === nextIndex && round === currentRound && !isComplete
                return (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={ri}
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      done ? 'bg-command-blue' : 'border border-surface-border',
                      current && 'ring-2 ring-command-blue ring-offset-1 ring-offset-brand-secondary',
                    )}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Current exercise — or a complete state */}
      <div className="flex-1 overflow-y-auto min-w-0 py-2 px-2">
        {isComplete || !currentMember ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
              <svg viewBox="0 0 12 12" fill="none" className="w-5 h-5 text-emerald-400">
                <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-sm text-emerald-400">Circuit complete</p>
            <p className="text-xs text-gray-600 mt-1">{rounds} rounds · {members.length} exercises</p>
          </div>
        ) : (
          <ExerciseBlock
            key={currentMember.id}
            sessionExercise={currentMember}
            sessionId={sessionId}
            workoutType={currentMember.workoutType}
            weightUnit={weightUnit}
            clientId={clientId}
            restDurationSeconds={restDurationSeconds}
            onSetLogged={handleMemberSetLogged}
          />
        )}
      </div>

      {/* PR flash */}
      {prFlash && (
        <div className="mx-2 mb-2 px-4 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center gap-2 animate-slide-up">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-amber-400 shrink-0">
            <path d="M8 1l1.8 4H14l-3.4 2.5 1.3 4L8 9l-3.9 2.5 1.3-4L2 5h4.2L8 1z" fill="currentColor" />
          </svg>
          <div className="text-center">
            <p className="text-xs font-medium text-amber-400">New PR</p>
            <p className="text-[10px] text-amber-400/80 font-mono">{prFlash.label}</p>
          </div>
        </div>
      )}

      {/* Rest footer (between rounds) */}
      {showRestTimer && (
        <div className="border-t border-surface-border flex items-center overflow-hidden rounded-b-2xl">
          <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4">
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-command-blue shrink-0">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-mono font-medium text-command-blue">{formatSeconds(restTimer?.remaining ?? 0)}</span>
            <span className="text-xs text-gray-500">rest · next round</span>
          </div>
          <button
            type="button"
            onClick={() => restTimer?.skip()}
            className="px-4 py-3 text-xs text-gray-500 hover:text-gray-300 border-l border-surface-border transition-colors"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  )
}
