// ------------------------------------------------------------
// components/templates/TemplateBuilderSheet.tsx
//
// Full template builder — name, description, exercises.
// Flat structure: exercises directly in the template, ordered
// globally. workoutType on each exercise is set server-side from
// the exercise record — shown as a badge for visual grouping only.
// Drag-to-reorder with @dnd-kit/sortable.
// ------------------------------------------------------------

import { useState, useEffect, useCallback }  from 'react'
import { cn }                                 from '@/lib/cn'
import { interactions }                       from '@/lib/interactions'
import { BottomSheet }                        from '@/components/ui/BottomSheet'
import { Spinner }                            from '@/components/ui/Spinner'
import { ConfirmDialog }                      from '@/components/ui/ConfirmDialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
}                                             from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
}                                             from '@dnd-kit/sortable'
import { CSS }                                from '@dnd-kit/utilities'
import {
  useTemplate,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplateExercise,
  useReorderTemplateExercises,
}                                             from '@/lib/queries/templates'
import { toast }                              from '@/store/toastStore'
import { WORKOUT_TYPE_LABEL, WORKOUT_TYPE_COLOR } from '@/lib/exerciseLabels'
import { TemplateExercisePickerSheet }        from './TemplateExercisePickerSheet'
import type { TemplateDetailResponse }        from '@trainer-app/shared'

interface TemplateBuilderSheetProps {
  open:       boolean
  templateId: string | null
  onClose:    () => void
}

export function TemplateBuilderSheet({ open, templateId, onClose }: TemplateBuilderSheetProps): React.JSX.Element {
  const [activeId,    setActiveId]    = useState<string | null>(templateId)
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [pickerOpen,  setPickerOpen]  = useState(false)

  const { data: existing, isLoading } = useTemplate(activeId)
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()

  useEffect(() => { setActiveId(templateId) }, [templateId])

  useEffect(() => {
    if (!existing) return
    setName(existing.name)
    setDescription(existing.description ?? '')
  }, [existing])

  useEffect(() => {
    if (!open || templateId) return
    setName('')
    setDescription('')
    setActiveId(null)
  }, [open, templateId])

  const isDirty = templateId
    ? name !== (existing?.name ?? '') || description !== (existing?.description ?? '')
    : name.length > 0

  const handleClose = (): void => {
    if (isDirty && !activeId) { setDiscardOpen(true); return }
    onClose()
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (activeId) {
        await updateTemplate.mutateAsync({ id: activeId, name: name.trim(), description: description.trim() || undefined })
        toast.success('Template saved!')
      } else {
        const created = await createTemplate.mutateAsync({ name: name.trim(), description: description.trim() || undefined })
        setActiveId(created.id)
        toast.success('Template created! Now add exercises.')
      }
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const exercises = existing?.templateExercises ?? []

  return (
    <>
      <BottomSheet open={open} onClose={handleClose} maxHeight="95vh">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-surface-border shrink-0">
            <button type="button" onClick={handleClose}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              {activeId ? 'Done' : 'Cancel'}
            </button>
            <h2 className="text-sm font-medium text-gray-200">
              {templateId ? 'Edit template' : 'New template'}
            </h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className={cn('text-sm font-medium transition-colors', name.trim() ? 'text-command-blue' : 'text-gray-600')}
            >
              {saving ? <Spinner size="sm" /> : (activeId ? 'Update' : 'Create')}
            </button>
          </div>

          {/* Body */}
          {isLoading && templateId ? (
            <div className="flex justify-center py-12"><Spinner size="md" className="text-command-blue" /></div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Name */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Template name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Push Day A, Full Body Strength…"
                  className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-command-blue/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Description <span className="text-gray-700 normal-case">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What's this template for?"
                  rows={2}
                  className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-command-blue/50 resize-none"
                />
              </div>

              {/* Exercises */}
              {activeId ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Exercises</p>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs',
                        'text-command-blue border border-command-blue/30',
                        interactions.button.base,
                      )}
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                        <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Add exercise
                    </button>
                  </div>

                  {exercises.length === 0 ? (
                    <p className="text-center text-sm text-gray-600 py-6">
                      No exercises yet — tap "Add exercise" to start building.
                    </p>
                  ) : (
                    <SortableExerciseList
                      exercises={exercises}
                      templateId={activeId}
                    />
                  )}
                </div>
              ) : (
                <div className="bg-brand-primary rounded-xl border border-surface-border p-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Tap "Create" to save the name, then you can add exercises.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>

      {activeId && (
        <TemplateExercisePickerSheet
          open={pickerOpen}
          templateId={activeId}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        message="Your unsaved changes will be lost."
        confirmLabel="Discard"
        danger
        onConfirm={() => { setDiscardOpen(false); onClose() }}
        onCancel={() => setDiscardOpen(false)}
      />
    </>
  )
}

// ── Sortable exercise list ────────────────────────────────────────────────────

type TemplateEx = TemplateDetailResponse['templateExercises'][number]

function SortableExerciseList({ exercises: initialExercises, templateId }: {
  exercises:  TemplateEx[]
  templateId: string
}): React.JSX.Element {
  const [exercises, setExercises] = useState(initialExercises)
  const reorder = useReorderTemplateExercises()

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
      reorder.mutate({ templateId, orderedIds: reordered.map(e => e.id) })
      return reordered
    })
  }, [templateId, reorder])

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
        <div className="space-y-2">
          {exercises.map(ex => (
            <SortableExerciseItem
              key={ex.id}
              exercise={ex}
              templateId={templateId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableExerciseItem({ exercise, templateId }: {
  exercise:   TemplateEx
  templateId: string
}): React.JSX.Element {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: exercise.id })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
    zIndex:     isDragging ? 10 : undefined,
  }

  const deleteExercise = useDeleteTemplateExercise()
  const colorClass = WORKOUT_TYPE_COLOR[exercise.workoutType]?.split(' ')[0] ?? 'text-gray-400'
  const typeLabel  = WORKOUT_TYPE_LABEL[exercise.workoutType] ?? exercise.workoutType

  const handleDelete = (): void => {
    deleteExercise.mutate(
      { templateId, exerciseId: exercise.id },
      {
        onSuccess: () => toast.success('Exercise removed'),
        onError:   () => toast.error('Failed to remove exercise'),
      }
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="relative flex items-center gap-2">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'flex items-center justify-center w-6 h-10 rounded-lg shrink-0',
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

      {/* Card */}
      <div className="flex-1 bg-brand-primary rounded-xl border border-surface-border px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 truncate">{exercise.exercise?.name ?? 'Unknown'}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[10px] uppercase tracking-widest font-medium', colorClass)}>
              {typeLabel}
            </span>
            {(exercise.targetSets || exercise.targetReps || exercise.targetDurationSeconds) && (
              <span className="text-xs text-gray-600 font-mono">
                {exercise.targetSets ? `${exercise.targetSets}×` : ''}
                {exercise.targetReps
                  ? exercise.targetReps
                  : exercise.targetDurationSeconds
                    ? `${exercise.targetDurationSeconds}s`
                    : ''}
                {exercise.targetWeight ? ` · ${exercise.targetWeight}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteExercise.isPending}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-lg shrink-0',
            'text-gray-600 hover:text-red-400 hover:bg-red-500/10',
            'transition-colors',
            interactions.button.base,
            deleteExercise.isPending && 'opacity-50 pointer-events-none',
          )}
          aria-label={`Remove ${exercise.exercise?.name ?? 'exercise'}`}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
