// ------------------------------------------------------------
// components/session/AddExerciseSheet.tsx (v1.8.0)
//
// Bottom sheet for adding an exercise to a workout block.
//
// FLOW:
//   1. Trainer types to search the exercise library
//   2. Tap to select — shows target sets + reps steppers
//   3. Confirm → adds exercise with those targets
//
// QUICK-ADD (no match found):
//   If search text doesn't match any exercise, "Create as draft"
//   appears. Tapping creates a draft exercise (isDraft: true)
//   with the workout block's type, adds it immediately.
//   Post-session enrichment is deferred to Phase 9.
//
// DragStepper:
//   8px per step, 1-30 reps, 1-10 sets.
//   Linear — no velocity acceleration.
// ------------------------------------------------------------

import { useState, useMemo }    from 'react'
import { cn }                    from '@/lib/cn'
import { interactions }          from '@/lib/interactions'
import { BottomSheet }           from '@/components/ui/BottomSheet'
import { DragStepper }           from '@/components/ui/DragStepper'
import { Spinner }               from '@/components/ui/Spinner'
import {
  useExercises,
  useCreateExercise,
}                                from '@/lib/queries/exercises'
import { useAddExercise }        from '@/lib/queries/sessions'
import type { ExerciseSummaryResponse } from '@trainer-app/shared'

interface AddExerciseSheetProps {
  open:        boolean
  workoutId:   string
  sessionId:   string
  workoutType: string   // pre-filters search + used for quick-add
  onClose:     () => void
}

export function AddExerciseSheet({
  open, workoutId, sessionId, workoutType, onClose,
}: AddExerciseSheetProps): React.JSX.Element {
  const [search,      setSearch]      = useState('')
  const [selected,    setSelected]    = useState<ExerciseSummaryResponse | null>(null)
  const [targetSets,  setTargetSets]  = useState(3)
  const [targetReps,  setTargetReps]  = useState(10)
  const [isConfirming, setIsConfirming] = useState(false)

  const { data: exercises, isLoading } = useExercises()
  const addExercise                    = useAddExercise()
  const createExercise                 = useCreateExercise()

  // Filter exercises by search term
  const filtered = useMemo(() => {
    if (!exercises) return []
    const q = search.trim().toLowerCase()
    if (!q) return exercises.slice(0, 20)  // show first 20 when no search
    return exercises.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.bodyPart?.name ?? '').toLowerCase().includes(q)
    )
  }, [exercises, search])

  const hasExactMatch = filtered.some(
    e => e.name.toLowerCase() === search.trim().toLowerCase()
  )
  const showQuickAdd = search.trim().length > 1 && filtered.length === 0

  // Reset state when sheet closes
  const handleClose = (): void => {
    setSearch('')
    setSelected(null)
    setTargetSets(3)
    setTargetReps(10)
    setIsConfirming(false)
    onClose()
  }

  const handleSelect = (exercise: ExerciseSummaryResponse): void => {
    setSelected(exercise)
    setIsConfirming(true)
  }

  const handleConfirm = (): void => {
    if (!selected) return
    addExercise.mutate(
      {
        workoutId,
        sessionId,
        exerciseId:  selected.id,
        targetSets,
        targetReps,
      },
      { onSuccess: handleClose },
    )
  }

  const handleQuickAdd = (): void => {
    createExercise.mutate(
      {
        name:        search.trim(),
        workoutType: workoutType,
        isDraft:     true,
      } as any,
      {
        onSuccess: (newExercise) => {
          addExercise.mutate(
            { workoutId, sessionId, exerciseId: newExercise.id, targetSets, targetReps },
            { onSuccess: handleClose },
          )
        },
      }
    )
  }

  const isPending = addExercise.isPending || createExercise.isPending

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={isConfirming ? 'Set targets' : 'Add Exercise'}
      maxHeight="90vh"
    >
      {!isConfirming ? (
        // ── Search + list ───────────────────────────────────────────────────
        <div className="flex flex-col" style={{ height: 'calc(90vh - 100px)' }}>
          {/* Search input */}
          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises…"
              autoFocus
              className={cn(
                'w-full field text-sm',
                'placeholder-gray-600',
              )}
            />
          </div>

          {/* Exercise list */}
          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-1">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="sm" className="text-gray-500" />
              </div>
            )}

            {filtered.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => handleSelect(exercise)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                  'bg-surface border border-surface-border',
                  'hover:border-brand-highlight/30 hover:bg-brand-highlight/5',
                  'transition-all duration-100',
                  interactions.button.base,
                  interactions.button.press,
                  exercise.isDraft && 'border-dashed',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-200 truncate">{exercise.name}</p>
                  {exercise.bodyPart && (
                    <p className="text-xs text-gray-500 mt-0.5">{exercise.bodyPart.name}</p>
                  )}
                </div>
                {exercise.isDraft && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-500/70 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
                    Draft
                  </span>
                )}
              </button>
            ))}

            {/* Quick-add draft */}
            {showQuickAdd && (
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={isPending}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                  'border border-dashed border-brand-highlight/40 bg-brand-highlight/5',
                  'hover:bg-brand-highlight/10 transition-all duration-100',
                  interactions.button.base,
                  interactions.button.press,
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-brand-highlight/20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-brand-highlight">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-highlight">
                    Create "{search.trim()}"
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Added as a draft — fill in details after your session
                  </p>
                </div>
              </button>
            )}

            {!isLoading && filtered.length === 0 && !showQuickAdd && (
              <p className="text-center text-sm text-gray-600 py-8">
                No exercises found
              </p>
            )}
          </div>
        </div>
      ) : (
        // ── Target sets + reps ──────────────────────────────────────────────
        <div className="p-6 pb-8">
          {/* Selected exercise name */}
          <div className="mb-6 text-center">
            <p className="font-display text-xl uppercase tracking-wide text-white">
              {selected?.name}
            </p>
            {selected?.bodyPart && (
              <p className="text-sm text-gray-500 mt-1">{selected.bodyPart.name}</p>
            )}
          </div>

          {/* Steppers */}
          <div className="flex justify-around items-start mb-8">
            <DragStepper
              value={targetSets}
              onChange={setTargetSets}
              min={1}
              max={10}
              label="Sets"
            />
            <div className="text-2xl text-gray-700 pt-8">×</div>
            <DragStepper
              value={targetReps}
              onChange={setTargetReps}
              min={1}
              max={30}
              label="Reps"
            />
          </div>

          <p className="text-center text-xs text-gray-600 mb-6">
            Drag the number up or down to adjust — or tap ▲ ▼
          </p>

          {/* Confirm */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
              'bg-brand-highlight text-white',
              interactions.button.base,
              interactions.button.press,
              isPending && 'opacity-50',
            )}
          >
            {isPending ? <Spinner size="sm" className="mx-auto" /> : 'Add to Block'}
          </button>

          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-300"
          >
            ← Back to search
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
