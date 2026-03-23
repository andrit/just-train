// ------------------------------------------------------------
// components/session/WorkoutBlock.tsx (v1.8.0 — redesign)
//
// Shows one exercise at a time (full focus), with prev/next
// navigation between exercises in the block.
//
// Block type + progress shown in header.
// Delete block button in header (with confirmation).
// Add Exercise button at bottom.
// ------------------------------------------------------------

import { useState }          from 'react'
import { cn }                from '@/lib/cn'
import { interactions }      from '@/lib/interactions'
import { ExerciseBlock }     from './ExerciseBlock'
import { AddExerciseSheet }  from './AddExerciseSheet'
import { useDeleteWorkout }  from '@/lib/queries/sessions'
import type { WorkoutResponse } from '@trainer-app/shared'

const WORKOUT_TYPE_STYLE: Record<string, { label: string; color: string; dot: string }> = {
  resistance:   { label: 'Resistance',   color: 'text-brand-highlight',  dot: 'bg-brand-highlight' },
  cardio:       { label: 'Cardio',       color: 'text-sky-400',          dot: 'bg-sky-400' },
  calisthenics: { label: 'Calisthenics', color: 'text-emerald-400',      dot: 'bg-emerald-400' },
  stretching:   { label: 'Stretching',   color: 'text-violet-400',       dot: 'bg-violet-400' },
  cooldown:     { label: 'Cooldown',     color: 'text-gray-400',         dot: 'bg-gray-400' },
}

interface WorkoutBlockProps {
  workout:    WorkoutResponse
  sessionId:  string
  weightUnit: string
  layout:     'horizontal' | 'vertical'
  onSetLogged: (restSeconds?: number) => void
  onAddBlock?: () => void   // opens AddBlockSheet from within the block
}

export function WorkoutBlock({
  workout, sessionId, weightUnit, layout, onSetLogged, onAddBlock,
}: WorkoutBlockProps): React.JSX.Element {
  const [exerciseIndex,   setExerciseIndex]   = useState(0)
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(false)

  const deleteWorkout = useDeleteWorkout()
  const style = WORKOUT_TYPE_STYLE[workout.workoutType] ?? { label: workout.workoutType, color: 'text-gray-400', dot: 'bg-gray-400' }

  const exercises    = workout.sessionExercises
  const totalEx      = exercises.length
  const currentEx    = exercises[Math.min(exerciseIndex, Math.max(0, totalEx - 1))]
  const clampedIndex = Math.min(exerciseIndex, Math.max(0, totalEx - 1))

  const handleDeleteBlock = (): void => {
    deleteWorkout.mutate(
      { workoutId: workout.id, sessionId },
      { onSuccess: () => setConfirmDelete(false) },
    )
  }

  // When an exercise is added, jump to it
  const handleExerciseAdded = (): void => {
    setAddExerciseOpen(false)
    // New exercise is appended — jump to end
    setExerciseIndex(Math.max(0, exercises.length))
  }

  return (
    <>
      <div className={cn(
        'flex flex-col bg-brand-secondary rounded-2xl border border-surface-border',
        layout === 'horizontal' ? 'w-[85vw] max-w-sm shrink-0 h-full' : 'w-full',
      )}>

        {/* Block header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} />
            <span className={cn('text-[10px] uppercase tracking-widest font-medium', style.color)}>
              {style.label}
            </span>
            {totalEx > 0 && (
              <span className="text-[10px] text-gray-600">
                · {clampedIndex + 1}/{totalEx}
              </span>
            )}
          </div>

          {/* Delete block */}
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

        {/* Exercise content */}
        <div className={cn('flex-1 p-4', layout === 'horizontal' && 'overflow-y-auto')}>
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
              onSetLogged={onSetLogged}
            />
          ) : null}
        </div>

        {/* Exercise navigation */}
        {totalEx > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-surface-border/50">
            <button
              type="button"
              onClick={() => setExerciseIndex(Math.max(0, clampedIndex - 1))}
              disabled={clampedIndex === 0}
              className={cn(
                'flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 transition-colors',
                clampedIndex === 0 && 'opacity-20 pointer-events-none',
              )}
            >
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {exercises[clampedIndex - 1]?.exercise?.name ?? 'Prev'}
            </button>

            {/* Dots */}
            <div className="flex gap-1">
              {exercises.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setExerciseIndex(i)}
                  className={cn(
                    'rounded-full transition-all duration-150',
                    i === clampedIndex ? 'w-3 h-1.5 bg-brand-highlight' : 'w-1.5 h-1.5 bg-surface-border',
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setExerciseIndex(Math.min(totalEx - 1, clampedIndex + 1))}
              disabled={clampedIndex === totalEx - 1}
              className={cn(
                'flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 transition-colors',
                clampedIndex === totalEx - 1 && 'opacity-20 pointer-events-none',
              )}
            >
              {exercises[clampedIndex + 1]?.exercise?.name ?? 'Next'}
              <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Add exercise button */}
        <div className="px-4 pb-4 pt-2 border-t border-surface-border/50">
          <button
            type="button"
            onClick={() => setAddExerciseOpen(true)}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl',
              'border border-dashed border-surface-border',
              'text-sm text-gray-500 hover:text-gray-300 hover:border-brand-highlight/30',
              'transition-all duration-150',
              interactions.button.base,
              interactions.button.press,
            )}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Exercise
          </button>

          {/* New Block — only shown when onAddBlock is provided (live session) */}
          {onAddBlock && (
            <button
              type="button"
              onClick={onAddBlock}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm',
                'border border-surface-border text-gray-500',
                'hover:border-brand-highlight/40 hover:text-gray-300',
                interactions.button.base,
                interactions.button.press,
              )}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <rect x="2" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="9" y="3" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              New Block
            </button>
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
