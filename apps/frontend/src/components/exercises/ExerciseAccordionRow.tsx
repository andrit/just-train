// ------------------------------------------------------------
// components/exercises/ExerciseAccordionRow.tsx (v2.10.0)
//
// Reusable exercise row with expand/collapse accordion.
// Collapsed: name + body part tag + difficulty badge.
// Expanded: description, instructions, body part + equipment.
// Optionally supports swipe-right-to-add gesture.
//
// USAGE:
//   <ExerciseAccordionRow
//     exercise={ex}
//     expanded={expandedId === ex.id}
//     onToggle={() => toggle(ex.id)}
//     swipeEnabled            // enables swipe-right-to-add
//     onAdd={() => add(ex)}   // called on swipe or tap Add
//   />
//
// CONTEXTS:
//   - TemplateExercisePickerSheet  → swipe enabled
//   - AddExerciseSheet             → swipe enabled
//   - ExercisesPage                → swipe disabled (view-only)
// ------------------------------------------------------------

import { useState, useRef, useCallback } from 'react'
import { cn }                            from '@/lib/cn'
import { interactions }                  from '@/lib/interactions'
import { Spinner }                       from '@/components/ui/Spinner'
import { useExercise }                   from '@/lib/queries/exercises'
import {
  WORKOUT_TYPE_LABEL,
  EQUIPMENT_LABEL,
  DIFFICULTY_COLOR,
}                                        from '@/lib/exerciseLabels'
import type { ExerciseSummaryResponse }  from '@trainer-app/shared'

interface ExerciseAccordionRowProps {
  exercise:      ExerciseSummaryResponse
  expanded:      boolean
  onToggle:      () => void
  swipeEnabled?: boolean
  onAdd?:        () => void
  disabled?:     boolean
  /** Custom action buttons to render inside the expanded section.
   *  If omitted, renders a default "Add to block" button using onAdd. */
  renderActions?: () => React.ReactNode
}

// Swipe threshold in pixels
const SWIPE_THRESHOLD = 80

export function ExerciseAccordionRow({
  exercise,
  expanded,
  onToggle,
  swipeEnabled = false,
  onAdd,
  disabled = false,
  renderActions,
}: ExerciseAccordionRowProps): React.JSX.Element {
  // Lazy-load full detail when expanded
  const { data: detail, isLoading: detailLoading } = useExercise(expanded ? exercise.id : null)

  // Swipe state
  const [translateX, setTranslateX] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const touchStartX  = useRef(0)
  const touchStartY  = useRef(0)
  const swiping      = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!swipeEnabled || disabled) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    swiping.current = false
  }, [swipeEnabled, disabled])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeEnabled || disabled) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // If vertical movement dominates, don't swipe — let scroll happen
    if (!swiping.current && Math.abs(dy) > Math.abs(dx)) return
    swiping.current = true

    // Only allow right swipe (positive dx), capped at 120px
    const clamped = Math.max(0, Math.min(dx, 120))
    setTranslateX(clamped)
  }, [swipeEnabled, disabled])

  const handleTouchEnd = useCallback(() => {
    if (!swipeEnabled || disabled) return
    if (translateX >= SWIPE_THRESHOLD) {
      // Trigger add
      setShowConfirm(true)
      setTranslateX(0)
      onAdd?.()
      // Flash resets after animation
      setTimeout(() => setShowConfirm(false), 600)
    } else {
      setTranslateX(0)
    }
    swiping.current = false
  }, [swipeEnabled, disabled, translateX, onAdd])

  const difficultyClasses = DIFFICULTY_COLOR[exercise.difficulty] ?? ''

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Green background revealed on swipe */}
      {swipeEnabled && (
        <div className={cn(
          'absolute inset-0 flex items-center pl-4 rounded-xl transition-colors',
          translateX > 0 ? 'bg-emerald-600/20' : 'bg-transparent',
        )}>
          <svg viewBox="0 0 20 20" fill="currentColor"
            className={cn(
              'w-5 h-5 text-emerald-400 transition-opacity',
              translateX > SWIPE_THRESHOLD * 0.6 ? 'opacity-100' : 'opacity-0',
            )}
          >
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Confirm flash */}
      {showConfirm && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-emerald-500/20 z-10 animate-pulse">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-emerald-400">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Row content */}
      <div
        className={cn(
          'relative bg-brand-primary border border-surface-border rounded-xl transition-transform',
          expanded && 'border-brand-highlight/20',
        )}
        style={{
          transform: translateX > 0 ? `translateX(${translateX}px)` : undefined,
          transition: translateX > 0 ? 'none' : 'transform 200ms ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Collapsed header — always visible, tap to toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'w-full text-left px-3 py-3 flex items-center gap-2',
            interactions.button.base,
          )}
        >
          {/* Chevron */}
          <svg
            viewBox="0 0 16 16"
            fill="none"
            className={cn(
              'w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform duration-200',
              expanded && 'rotate-90',
            )}
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Name */}
          <span className="text-sm text-gray-200 flex-1 truncate">{exercise.name}</span>

          {/* Tags */}
          {exercise.bodyPart && (
            <span className="text-[10px] text-gray-500 capitalize shrink-0">
              {exercise.bodyPart.name.replace('_', ' ')}
            </span>
          )}
          {exercise.difficulty && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded border shrink-0',
              difficultyClasses || 'text-gray-400',
            )}>
              {exercise.difficulty}
            </span>
          )}

          {exercise.isDraft && (
            <span className="text-[10px] uppercase tracking-wider text-amber-500/70 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
              Draft
            </span>
          )}
        </button>

        {/* Expanded detail */}
        <div
          className={cn(
            'overflow-hidden transition-all duration-200',
            expanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <div className="px-3 pb-3 pt-0 border-t border-surface-border/50">
            {detailLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" className="text-gray-500" />
              </div>
            ) : detail ? (
              <div className="space-y-2 pt-2.5">
                {/* Description */}
                {detail.description && (
                  <p className="text-xs text-gray-400 leading-relaxed">{detail.description}</p>
                )}

                {/* Instructions */}
                {detail.instructions && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-1">Instructions</p>
                    <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{detail.instructions}</p>
                  </div>
                )}

                {/* No content fallback */}
                {!detail.description && !detail.instructions && (
                  <p className="text-xs text-gray-600 italic">No description yet</p>
                )}

                {/* Tags row */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-accent text-gray-400 capitalize">
                    {WORKOUT_TYPE_LABEL[exercise.workoutType] ?? exercise.workoutType}
                  </span>
                  {exercise.bodyPart && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-accent text-gray-400 capitalize">
                      {exercise.bodyPart.name.replace('_', ' ')}
                    </span>
                  )}
                  {exercise.equipment && exercise.equipment !== 'none' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-accent text-gray-400">
                      {EQUIPMENT_LABEL[exercise.equipment] ?? exercise.equipment}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                {renderActions ? (
                  renderActions()
                ) : swipeEnabled && onAdd ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onAdd() }}
                    disabled={disabled}
                    className={cn(
                      'w-full mt-1 py-2 rounded-lg text-xs font-medium',
                      'bg-brand-highlight/10 text-brand-highlight border border-brand-highlight/30',
                      'hover:bg-brand-highlight/20 transition-colors',
                      interactions.button.base,
                      disabled && 'opacity-50 pointer-events-none',
                    )}
                  >
                    Add to block
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-gray-600 py-2 italic">Failed to load details</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
