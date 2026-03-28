// ------------------------------------------------------------
// components/session/SortableWorkoutList.tsx (v2.8.0)
//
// Drag-to-reorder workout blocks in the session plan builder.
// Uses @dnd-kit/sortable for accessible drag-and-drop.
// Only used in vertical (planning) mode — not during execution.
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
import { useReorderWorkouts }                  from '@/lib/queries/sessions'
import type { WorkoutResponse }                from '@trainer-app/shared'

interface SortableWorkoutListProps {
  workouts:    WorkoutResponse[]
  sessionId:   string
  weightUnit:  string
  clientId:    string | null
}

export function SortableWorkoutList({
  workouts: initialWorkouts,
  sessionId,
  weightUnit,
  clientId,
}: SortableWorkoutListProps): React.JSX.Element {
  const [workouts, setWorkouts] = useState(initialWorkouts)
  const reorderWorkouts = useReorderWorkouts()

  // Sync local order when session refetches (e.g. after block added)
  const stableIds = initialWorkouts.map(w => w.id).join(',')
  useEffect(() => {
    setWorkouts(initialWorkouts)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setWorkouts(prev => {
      const oldIndex = prev.findIndex(w => w.id === active.id)
      const newIndex = prev.findIndex(w => w.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      reorderWorkouts.mutate({ sessionId, orderedIds: reordered.map(w => w.id) })
      return reordered
    })
  }, [sessionId, reorderWorkouts])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={workouts.map(w => w.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {workouts.map(workout => (
            <SortableWorkoutItem
              key={workout.id}
              workout={workout}
              sessionId={sessionId}
              weightUnit={weightUnit}
              clientId={clientId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// ── Single sortable workout item ──────────────────────────────────────────────

function SortableWorkoutItem({ workout, sessionId, weightUnit, clientId }: {
  workout:    WorkoutResponse
  sessionId:  string
  weightUnit: string
  clientId:   string | null
}): React.JSX.Element {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: workout.id })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    zIndex:     isDragging ? 10 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute -left-1 top-1/2 -translate-y-1/2 z-10',
          'flex items-center justify-center w-6 h-10 rounded-lg',
          'text-gray-600 hover:text-gray-300 cursor-grab active:cursor-grabbing',
          'touch-none select-none',
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

      <div className="pl-5">
        <WorkoutBlock
          workout={workout}
          sessionId={sessionId}
          weightUnit={weightUnit}
          layout="vertical"
          clientId={clientId}
          onSetLogged={() => {}}
        />
      </div>
    </div>
  )
}
