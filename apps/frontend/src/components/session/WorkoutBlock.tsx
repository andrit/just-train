// ------------------------------------------------------------
// components/session/WorkoutBlock.tsx (v2.5.0 — execution redesign)
//
// EXECUTION MODE (live session):
//   Exercises navigate horizontally — same snap-scroll pattern
//   as blocks. Left peek = past exercise + final value (tappable).
//   Right peek = next exercise + targets (tappable).
//   Set spine runs vertically within current exercise only.
//   Footer bar: carved "Add exercise | New block" sections.
//   After set log: footer replaced by rest timer ("Rest 1:30 · Skip").
//   PR flash: amber overlay on log, settles as chip on set row.
//
// OVERVIEW MODE (plan builder):
//   Exercises stacked vertically — full session visible at once.
//   No peeks, no rest timer. Same footer bar layout.
//
// Two dot rows in execution:
//   Top    — block position (managed by parent)
//   Middle — exercise position within this block
// ------------------------------------------------------------

import { useState } from 'react'
import { cn }                            from '@/lib/cn'
import { interactions }                  from '@/lib/interactions'
import { formatSeconds }                 from '@/lib/formatters'
import { WORKOUT_TYPE_LABEL, WORKOUT_TYPE_COLOR } from '@/lib/exerciseLabels'
import { ExerciseBlock }                 from './ExerciseBlock'
import { AddExerciseSheet }              from './AddExerciseSheet'
import { useDeleteWorkout }              from '@/lib/queries/sessions'
import type { WorkoutResponse }          from '@trainer-app/shared'

interface WorkoutBlockProps {
  workout:            WorkoutResponse
  sessionId:          string
  weightUnit:         string
  layout:             'horizontal' | 'vertical'
  clientId:           string | null
  onSetLogged:        (restSeconds?: number) => void
  onAddBlock?:        () => void
  restDurationSeconds?: number
  restTimer?: {
    isRunning:  boolean
    remaining:  number
    skip:       () => void
  }
}

export function WorkoutBlock({
  workout, sessionId, weightUnit, layout, clientId, onSetLogged, onAddBlock, restDurationSeconds = 90, restTimer,
}: WorkoutBlockProps): React.JSX.Element {
  const [exerciseIndex,   setExerciseIndex]   = useState(0)
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(false)
  const [prFlash,         setPrFlash]         = useState<{ label: string } | null>(null)

  const deleteWorkout = useDeleteWorkout()

  const exercises    = workout.sessionExercises
  const totalEx      = exercises.length
  const clampedIdx   = Math.min(exerciseIndex, Math.max(0, totalEx - 1))
  const currentEx    = exercises[clampedIdx]
  const prevEx       = exercises[clampedIdx - 1]
  const nextEx       = exercises[clampedIdx + 1]

  const typeColor = WORKOUT_TYPE_COLOR[workout.workoutType] ?? 'text-gray-400 border-gray-500/60'
  const typeLabel = WORKOUT_TYPE_LABEL[workout.workoutType] ?? workout.workoutType

  const handleDeleteBlock = (): void => {
    deleteWorkout.mutate(
      { workoutId: workout.id, sessionId },
      { onSuccess: () => setConfirmDelete(false) },
    )
  }

  const handleExerciseAdded = (): void => {
    setAddExerciseOpen(false)
    setExerciseIndex(exercises.length) // jump to newly added exercise
  }

  // PR flash — shown for ~1.5s then fades, chip stays on set row
  const handleSetLoggedWithPR = (restSeconds = restDurationSeconds, pr?: { isPR: boolean; isPRVolume: boolean; weight?: number | null; reps?: number | null }): void => {
    onSetLogged(restSeconds)
    if (pr?.isPR || pr?.isPRVolume) {
      const label = pr.weight && pr.reps
        ? `${pr.weight} × ${pr.reps}`
        : 'New best'
      setPrFlash({ label })
      setTimeout(() => setPrFlash(null), 1800)
    }
  }

  // Footer content: rest timer when running, otherwise Add exercise / New block
  const showRestTimer = restTimer?.isRunning

  return (
    <>
      <div className={cn(
        'flex flex-col bg-brand-secondary rounded-2xl border border-surface-border',
        layout === 'horizontal' ? 'w-[85vw] max-w-sm shrink-0 h-full' : 'w-full',
      )}>

        {/* Block header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] uppercase tracking-widest font-medium', typeColor.split(' ')[0])}>
              {typeLabel}
            </span>
            {totalEx > 0 && layout === 'horizontal' && (
              <span className="text-[10px] text-gray-600">· {clampedIdx + 1}/{totalEx}</span>
            )}
          </div>

          {/* Delete block — inline confirm */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Remove block?</span>
              <button
                type="button"
                onClick={handleDeleteBlock}
                disabled={deleteWorkout.isPending}
                className="text-xs text-red-400 hover:text-red-300 font-medium"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="Remove block"
              className="text-gray-600 hover:text-red-400 transition-colors p-1"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* ── EXECUTION MODE: horizontal exercise nav with peeks ──────── */}
        {layout === 'horizontal' ? (
          <>
            {/* Exercise position dots */}
            {totalEx > 1 && (
              <div className="flex justify-center gap-1.5 py-2">
                {exercises.map((_, i) => (
                  <button
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    type="button"
                    onClick={() => setExerciseIndex(i)}
                    className={cn(
                      'rounded-full transition-all duration-150',
                      i === clampedIdx
                        ? 'w-3 h-1.5 bg-brand-highlight'
                        : 'w-1.5 h-1.5 bg-surface-border hover:bg-gray-500',
                    )}
                    aria-label={`Exercise ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Exercise row: left peek + current + right peek */}
            <div className="flex items-stretch gap-2 px-2 flex-1 overflow-hidden">

              {/* Left peek — tappable, shows prev exercise final value */}
              <button
                type="button"
                onClick={() => clampedIdx > 0 && setExerciseIndex(clampedIdx - 1)}
                disabled={!prevEx}
                className={cn(
                  'w-9 min-w-9 flex flex-col justify-center rounded-xl border border-surface-border bg-brand-primary',
                  'transition-opacity duration-150',
                  prevEx ? 'opacity-50 hover:opacity-70 cursor-pointer' : 'opacity-0 pointer-events-none',
                )}
                aria-label="Previous exercise"
              >
                {prevEx && (
                  <div className="px-1.5 py-2">
                    <p className="text-[8px] text-gray-500 truncate leading-tight">
                      {prevEx.exercise?.name ?? '—'}
                    </p>
                    {prevEx.sets.length > 0 && (() => {
                      const last = prevEx.sets[prevEx.sets.length - 1]
                      return (
                        <p className="text-[9px] font-mono text-gray-400 mt-1 truncate">
                          {last.weight != null ? `${last.weight}×` : ''}{last.reps ?? last.durationSeconds ?? '—'}
                        </p>
                      )
                    })()}
                  </div>
                )}
              </button>

              {/* Current exercise — fills remaining space */}
              <div className="flex-1 overflow-y-auto min-w-0 py-2">
                {exercises.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600 text-sm">No exercises yet</p>
                    <p className="text-gray-700 text-xs mt-1">Tap + below to add one</p>
                  </div>
                ) : currentEx ? (
                  <ExerciseBlock
                    key={currentEx.id}
                    sessionExercise={currentEx}
                    sessionId={sessionId}
                    workoutId={workout.id}
                    workoutType={workout.workoutType}
                    weightUnit={weightUnit}
                    clientId={clientId}
                    restDurationSeconds={restDurationSeconds}
                    onSetLogged={handleSetLoggedWithPR}
                  />
                ) : null}
              </div>

              {/* Right peek — tappable, shows next exercise name + targets */}
              <button
                type="button"
                onClick={() => nextEx && setExerciseIndex(clampedIdx + 1)}
                disabled={!nextEx}
                className={cn(
                  'w-9 min-w-9 flex flex-col justify-center rounded-xl border border-surface-border bg-brand-primary',
                  'transition-opacity duration-150',
                  nextEx ? 'opacity-40 hover:opacity-60 cursor-pointer' : 'opacity-0 pointer-events-none',
                )}
                aria-label="Next exercise"
              >
                {nextEx && (
                  <div className="px-1.5 py-2">
                    <p className="text-[8px] text-gray-500 truncate leading-tight">
                      {nextEx.exercise?.name ?? '—'}
                    </p>
                    {(nextEx.targetSets || nextEx.targetReps) && (
                      <p className="text-[9px] font-mono text-gray-500 mt-1 truncate">
                        {nextEx.targetSets && `${nextEx.targetSets}×`}{nextEx.targetReps ?? nextEx.targetDurationSeconds ?? ''}
                      </p>
                    )}
                  </div>
                )}
              </button>
            </div>
          </>
        ) : (
          /* ── OVERVIEW MODE: vertical exercise list ──────────────────── */
          <div className="flex-1 p-4 space-y-3">
            {exercises.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm">No exercises yet</p>
                <p className="text-gray-700 text-xs mt-1">Tap + below to add one</p>
              </div>
            ) : (
              exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between py-2.5 border-b border-surface-border/50 last:border-0"
                >
                  <p className="text-sm text-gray-200 truncate flex-1">{ex.exercise?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-500 font-mono ml-3 shrink-0">
                    {ex.targetSets && `${ex.targetSets}×`}
                    {ex.targetReps ?? (ex.targetDurationSeconds ? `${ex.targetDurationSeconds}s` : null) ?? '—'}
                    {ex.targetWeight ? ` · ${ex.targetWeight}` : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PR Flash overlay ─────────────────────────────────────────── */}
        {prFlash && (
          <div className={cn(
            'mx-2 mb-2 px-4 py-3 rounded-xl',
            'bg-amber-500/15 border border-amber-500/30',
            'flex items-center justify-center gap-2',
            'animate-slide-up',
          )}>
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-amber-400 shrink-0">
              <path d="M8 1l1.8 4H14l-3.4 2.5 1.3 4L8 9l-3.9 2.5 1.3-4L2 5h4.2L8 1z" fill="currentColor" />
            </svg>
            <div className="text-center">
              <p className="text-xs font-medium text-amber-400">New PR</p>
              <p className="text-[10px] text-amber-400/80 font-mono">{prFlash.label}</p>
            </div>
          </div>
        )}

        {/* ── Footer bar ───────────────────────────────────────────────── */}
        <div className="border-t border-surface-border">
          {showRestTimer ? (
            /* Rest timer replaces footer while counting down */
            <div className="flex items-center overflow-hidden rounded-b-2xl">
              <div className="flex-1 flex items-center justify-center gap-2 py-3 px-4">
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-brand-highlight shrink-0">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-sm font-mono font-medium text-brand-highlight">
                  {formatSeconds(restTimer?.remaining ?? 0)}
                </span>
                <span className="text-xs text-gray-500">rest</span>
              </div>
              <button
                type="button"
                onClick={() => restTimer?.skip()}
                className="px-4 py-3 text-xs text-gray-500 hover:text-gray-300 border-l border-surface-border transition-colors"
              >
                Skip
              </button>
            </div>
          ) : (
            /* Normal footer: Add exercise | New block */
            <div className="flex overflow-hidden rounded-b-2xl">
              <button
                type="button"
                onClick={() => setAddExerciseOpen(true)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-3 px-3',
                  'text-xs font-medium text-gray-400 hover:text-gray-200',
                  'border-r border-surface-border',
                  'transition-colors duration-150',
                  interactions.button.base,
                  interactions.button.press,
                )}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add exercise
              </button>
              {onAddBlock ? (
                <button
                  type="button"
                  onClick={onAddBlock}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-3 px-3',
                    'text-xs text-gray-500 hover:text-gray-300',
                    'transition-colors duration-150',
                    interactions.button.base,
                    interactions.button.press,
                  )}
                >
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                    <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  New block
                </button>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          )}
        </div>
      </div>

      <AddExerciseSheet
        open={addExerciseOpen}
        workoutId={workout.id}
        sessionId={sessionId}
        workoutType={workout.workoutType}
        onClose={handleExerciseAdded}
      />
    </>
  )
}
