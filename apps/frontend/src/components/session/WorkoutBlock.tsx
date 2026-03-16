// ------------------------------------------------------------
// components/session/WorkoutBlock.tsx (v1.5.0)
//
// One workout block (e.g. "Resistance", "Cardio Finisher").
// Contains all exercises for that block, each with set accordion rows.
// Used in both horizontal scroll and vertical stack layouts.
// ------------------------------------------------------------

import { cn }             from '@/lib/cn'
import { ExerciseBlock }  from './ExerciseBlock'
import type { WorkoutResponse } from '@trainer-app/shared'

// Workout type display labels and accent colors
const WORKOUT_TYPE_STYLE: Record<string, { label: string; color: string }> = {
  resistance:   { label: 'Resistance',   color: 'text-brand-highlight border-brand-highlight/30 bg-brand-highlight/5' },
  cardio:       { label: 'Cardio',       color: 'text-sky-400 border-sky-400/30 bg-sky-400/5'       },
  calisthenics: { label: 'Calisthenics', color: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' },
  stretching:   { label: 'Stretching',   color: 'text-violet-400 border-violet-400/30 bg-violet-400/5'   },
  cooldown:     { label: 'Cooldown',     color: 'text-gray-400 border-gray-400/30 bg-gray-400/5'         },
}

interface WorkoutBlockProps {
  workout:     WorkoutResponse
  sessionId:   string
  weightUnit:  string
  /** horizontal: fixed width card for scrolling. vertical: full width */
  layout:      'horizontal' | 'vertical'
  onSetLogged: (restSeconds?: number) => void
}

export function WorkoutBlock({
  workout,
  sessionId,
  weightUnit,
  layout,
  onSetLogged,
}: WorkoutBlockProps): React.JSX.Element {
  const style = WORKOUT_TYPE_STYLE[workout.workoutType] ?? {
    label: workout.workoutType,
    color: 'text-gray-400 border-gray-400/30 bg-gray-400/5',
  }

  const completedExercises = workout.sessionExercises.filter(
    (se) => se.sets.length >= (se.targetSets ?? 3)
  ).length
  const totalExercises = workout.sessionExercises.length

  return (
    <div
      className={cn(
        'flex flex-col bg-brand-secondary rounded-2xl border border-surface-border overflow-hidden',
        layout === 'horizontal'
          ? 'w-[85vw] max-w-sm shrink-0 h-full'
          : 'w-full',
      )}
    >
      {/* Block header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-surface-border',
        style.color,
      )}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-medium">
            {style.label}
          </span>
        </div>
        <span className="text-xs opacity-60">
          {completedExercises}/{totalExercises}
        </span>
      </div>

      {/* Exercises */}
      <div className={cn(
        'flex-1 p-4 space-y-6',
        layout === 'horizontal' && 'overflow-y-auto',
      )}>
        {workout.sessionExercises.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 text-sm">No exercises in this block</p>
          </div>
        ) : (
          workout.sessionExercises.map((se) => (
            <ExerciseBlock
              key={se.id}
              sessionExercise={se}
              sessionId={sessionId}
              weightUnit={weightUnit}
              onSetLogged={onSetLogged}
            />
          ))
        )}
      </div>

      {workout.notes && (
        <div className="px-4 py-2 border-t border-surface-border">
          <p className="text-xs text-gray-600">{workout.notes}</p>
        </div>
      )}
    </div>
  )
}
