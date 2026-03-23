// ------------------------------------------------------------
// components/exercises/ExerciseCard.tsx
//
// Card shown in the exercise library grid.
// Displays primary thumbnail, name, workout type badge,
// body part, equipment, difficulty, and draft status.
// ------------------------------------------------------------

import { cn }                            from '@/lib/cn'
import { Badge }                         from '@/components/ui/Badge'
import { getThumbnailUrl }               from './utils'
import {
  WORKOUT_TYPE_BADGE_VARIANT,
  WORKOUT_TYPE_LABEL,
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
  const primaryMedia = exercise.media?.[0]
  const thumbnailUrl = primaryMedia?.cloudinaryUrl
    ? getThumbnailUrl(primaryMedia.cloudinaryUrl)
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'card w-full text-left group cursor-pointer overflow-hidden',
        'hover:bg-surface-raised hover:border-brand-highlight/30',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-brand-highlight focus-visible:ring-offset-2',
        'focus-visible:ring-offset-brand-primary',
      )}
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-brand-accent overflow-hidden relative">
        {thumbnailUrl != null ? (
          <img
            src={thumbnailUrl}
            alt=""
            aria-hidden
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            aria-hidden
          >
            <span className="text-4xl opacity-20">💪</span>
          </div>
        )}

        {exercise.isDraft && (
          <div className="absolute top-2 left-2">
            <span className="badge-draft">✏️ Draft</span>
          </div>
        )}

        <div className="absolute top-2 right-2">
          <Badge variant={WORKOUT_TYPE_BADGE_VARIANT[exercise.workoutType] ?? 'default'}>
            {WORKOUT_TYPE_LABEL[exercise.workoutType] ?? exercise.workoutType}
          </Badge>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3.5">
        <h3 className="font-display text-base text-gray-100 leading-tight mb-2 truncate group-hover:text-white transition-colors">
          {exercise.name}
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {exercise.bodyPart != null && (
            <span className="text-xs text-gray-400 capitalize">
              {exercise.bodyPart.name.replace('_', ' ')}
            </span>
          )}

          <span className="text-xs text-gray-500">
            {EQUIPMENT_LABEL[exercise.equipment] ?? exercise.equipment}
          </span>

          <span className={cn('text-xs ml-auto', DIFFICULTY_TEXT_COLOR[exercise.difficulty] ?? 'text-gray-400')}>
            {exercise.difficulty}
          </span>
        </div>
      </div>
    </button>
  )
}
