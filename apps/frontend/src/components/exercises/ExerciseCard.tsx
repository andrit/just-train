// ------------------------------------------------------------
// components/exercises/ExerciseCard.tsx
//
// Card shown in the exercise library grid.
// Displays primary thumbnail, name, workout type badge,
// body part, equipment, difficulty, and draft status.
// ------------------------------------------------------------

import { cn }                            from '@/lib/cn'
import { ExerciseTypeBadge, ExerciseTypeIcon } from './ExerciseTypeBadge'
import { exerciseTypeTheme }             from '@/lib/exerciseTypeTheme'
import {
  EQUIPMENT_LABEL,
  DIFFICULTY_TEXT_COLOR,
}                                        from '@/lib/exerciseLabels'
import type { ExerciseSummaryResponse }  from '@trainer-app/shared'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  exercise: ExerciseSummaryResponse
  onClick:  () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseCard({
  exercise,
  onClick,
}: ExerciseCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'card w-full text-left group cursor-pointer overflow-hidden',
        'hover:bg-surface-raised hover:border-command-blue/30',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-command-blue focus-visible:ring-offset-2',
        'focus-visible:ring-offset-brand-primary',
      )}
    >
      {/* Type art — the exercise photo lives in the detail drawer, not the card */}
      <div className="aspect-[4/3] bg-brand-accent overflow-hidden relative flex items-center justify-center">
        <ExerciseTypeIcon
          type={exercise.workoutType}
          className={cn(exerciseTypeTheme(exercise.workoutType).text, 'w-16 h-16 opacity-50')}
        />

        <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
          {exercise.isDraft && <span className="badge-draft">✏️ Draft</span>}
          {exercise.trainerId != null && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-surface/90 text-ink-muted border border-surface-border backdrop-blur-sm">
              Yours
            </span>
          )}
        </div>

        <div className="absolute top-2 right-2">
          <ExerciseTypeBadge type={exercise.workoutType} showIcon={false} />
        </div>
      </div>

      {/* Card body */}
      <div className="p-3.5">
        <h3 className="font-display text-base text-ink leading-tight mb-2 truncate group-hover:text-ink transition-colors">
          {exercise.name}
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {exercise.bodyPart != null && (
            <span className="text-xs text-ink-muted capitalize">
              {exercise.bodyPart.name.replace('_', ' ')}
            </span>
          )}

          <span className="text-xs text-ink-subtle">
            {EQUIPMENT_LABEL[exercise.equipment] ?? exercise.equipment}
          </span>

          <span className={cn('text-xs ml-auto', DIFFICULTY_TEXT_COLOR[exercise.difficulty] ?? 'text-ink-muted')}>
            {exercise.difficulty}
          </span>
        </div>
      </div>
    </button>
  )
}
