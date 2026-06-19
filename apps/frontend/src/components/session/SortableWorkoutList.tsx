// ------------------------------------------------------------
// components/session/SortableWorkoutList.tsx (v3.0.0)
//
// Drag-to-reorder exercises in the session plan builder.
// Exercises are flat (Session → SessionExercises), grouped
// visually by workoutType with WorkoutBlock in vertical mode.
// Only used in overview (planning) mode — not during execution.
// ------------------------------------------------------------

import { useState, useCallback, useEffect }    from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
}                                              from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
}                                              from '@dnd-kit/sortable'
import { CSS }                                 from '@dnd-kit/utilities'
import { cn }                                  from '@/lib/cn'
import { WorkoutBlock }                        from './WorkoutBlock'
import { useReorderSessionExercises }          from '@/lib/queries/sessions'
import type { SessionExerciseResponse }        from '@trainer-app/shared'
import { WORKOUT_TYPE_LABEL }                  from '@/lib/exerciseLabels'

interface SortableExerciseListProps {
  exercises:   SessionExerciseResponse[]
  sessionId:   string
  weightUnit:  string
  clientId:    string | null
}

export function SortableWorkoutList({
  exercises: initialExercises,
  sessionId,
  weightUnit,
  clientId,
}: SortableExerciseListProps): React.JSX.Element {
  const [exercises, setExercises] = useState(initialExercises)
  const reorder = useReorderSessionExercises()

  const stableIds = initialExercises.map(e => e.id).join(',')
  useEffect(() => {
    setExercises(initialExercises)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setExercises(prev => {
      const oldIndex = prev.findIndex(e => e.id === active.id)
      const newIndex = prev.findIndex(e => e.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      reorder.mutate({ sessionId, orderedIds: reordered.map(e => e.id) })
      return reordered
    })
  }, [sessionId, reorder])

  // Group exercises by workoutType, preserving flat order
  const groups: { type: string; items: SessionExerciseResponse[] }[] = []
  for (const ex of exercises) {
    const last = groups[groups.length - 1]
    if (last && last.type === ex.workoutType) {
      last.items.push(ex)
    } else {
      groups.push({ type: ex.workoutType, items: [ex] })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={exercises.map(e => e.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={`${group.type}-${group.items[0]?.id ?? ''}`}>
              <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium mb-2 px-1">
                {WORKOUT_TYPE_LABEL[group.type] ?? group.type}
              </p>
              <WorkoutBlock
                workoutType={group.type}
                sessionExercises={group.items.map(ex => (
                  // Wrap each exercise in a sortable shell
                  ex
                ))}
                sessionId={sessionId}
                weightUnit={weightUnit}
                layout="vertical"
                clientId={clientId}
                onSetLogged={() => {}}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// Unused — kept for potential future per-exercise drag handles
// If individual exercise drag handles are needed, wrap ExerciseRow in SortableExerciseItem
function _SortableExerciseItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative"
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute -left-1 top-1/2 -translate-y-1/2 z-10',
          'flex items-center justify-center w-6 h-10 rounded-lg',
          'text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none select-none',
        )}
        aria-label="Drag to reorder"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <circle cx="5"  cy="4"  r="1.2" />
          <circle cx="5"  cy="8"  r="1.2" />
          <circle cx="5"  cy="12" r="1.2" />
          <circle cx="11" cy="4"  r="1.2" />
          <circle cx="11" cy="8"  r="1.2" />
          <circle cx="11" cy="12" r="1.2" />
        </svg>
      </div>
      <div className="pl-5">{children}</div>
    </div>
  )
}
