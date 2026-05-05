// ------------------------------------------------------------
// components/templates/TemplateBuilderSheet.tsx (v2.10.0)
//
// Full template builder — name, description, blocks, exercises.
// v2.10.0 additions:
//   - workoutType passed to exercise picker (filter by block type)
//   - Delete block button (trash icon)
//   - Drag-to-reorder blocks (@dnd-kit/sortable)
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
  useAddTemplateBlock,
  useDeleteTemplateWorkout,
  useReorderTemplateWorkouts,
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
  // activeId tracks the template after creation so we can add blocks immediately
  const [activeId,     setActiveId]     = useState<string | null>(templateId)
  const [name,         setName]         = useState('')
  const [description,  setDescription]  = useState('')
  const [saving,       setSaving]       = useState(false)
  const [discardOpen,  setDiscardOpen]  = useState(false)
  const [addBlockOpen, setAddBlockOpen] = useState(false)

  const { data: existing, isLoading } = useTemplate(activeId)
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()

  // Sync activeId when the prop changes (e.g. switching from new → edit)
  useEffect(() => {
    setActiveId(templateId)
  }, [templateId])

  // Populate fields when existing data loads
  useEffect(() => {
    if (!existing) return
    setName(existing.name)
    setDescription(existing.description ?? '')
  }, [existing])

  // Reset fields when opening as new template
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
        toast.success('Template created! Now add workout blocks.')
      }
    } catch {
      toast.error('Failed to save template')
    } finally {
      setSaving(false)
    }
  }

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

              {/* Blocks */}
              {activeId ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Workout blocks</p>
                    <button
                      type="button"
                      onClick={() => setAddBlockOpen(true)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs',
                        'text-command-blue border border-command-blue/30',
                        interactions.button.base,
                      )}
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                        <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Add block
                    </button>
                  </div>

                  {(existing?.templateWorkouts ?? []).length === 0 ? (
                    <p className="text-center text-sm text-gray-600 py-6">
                      No blocks yet — tap "Add block" to start building.
                    </p>
                  ) : (
                    <SortableBlockList
                      blocks={existing?.templateWorkouts ?? []}
                      templateId={activeId ?? ''}
                    />
                  )}
                </div>
              ) : (
                <div className="bg-brand-primary rounded-xl border border-surface-border p-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Tap "Create" to save the name, then you can add workout blocks and exercises.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>

      {activeId && (
        <AddTemplateBlockSheet
          open={addBlockOpen}
          templateId={activeId}
          onClose={() => setAddBlockOpen(false)}
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

// ── Sortable block list ─────────────────────────────────────────────────────

type TemplateBlock = TemplateDetailResponse['templateWorkouts'][number]

function SortableBlockList({ blocks: initialBlocks, templateId }: {
  blocks:     TemplateBlock[]
  templateId: string
}): React.JSX.Element {
  const [blocks, setBlocks] = useState(initialBlocks)
  const reorderBlocks = useReorderTemplateWorkouts()

  // Sync when parent data refetches (block added / removed)
  const stableIds = initialBlocks.map(b => b.id).join(',')
  useEffect(() => {
    setBlocks(initialBlocks)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableIds])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setBlocks(prev => {
      const oldIndex = prev.findIndex(b => b.id === active.id)
      const newIndex = prev.findIndex(b => b.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      reorderBlocks.mutate({ templateId, orderedIds: reordered.map(b => b.id) })
      return reordered
    })
  }, [templateId, reorderBlocks])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={blocks.map(b => b.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {blocks.map(block => (
            <SortableBlockItem
              key={block.id}
              block={block}
              templateId={templateId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableBlockItem({ block, templateId }: {
  block:      TemplateBlock
  templateId: string
}): React.JSX.Element {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: block.id })

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
        <TemplateBlockCard block={block} templateId={templateId} />
      </div>
    </div>
  )
}

// ── Block card with exercise picker + delete ────────────────────────────────

function TemplateBlockCard({ block, templateId }: {
  block:      TemplateBlock
  templateId: string
}): React.JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const deleteBlock = useDeleteTemplateWorkout()

  const colorClass = WORKOUT_TYPE_COLOR[block.workoutType]?.split(' ')[0] ?? 'text-gray-400'
  const typeLabel  = WORKOUT_TYPE_LABEL[block.workoutType] ?? block.workoutType

  const handleDelete = (): void => {
    deleteBlock.mutate(
      { templateId, workoutId: block.id },
      {
        onSuccess: () => toast.success(`${typeLabel} block removed`),
        onError:   () => toast.error('Failed to remove block'),
      }
    )
  }

  return (
    <>
      <div className="bg-brand-primary rounded-xl border border-surface-border p-3 relative">
        {/* Delete button — top right */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteBlock.isPending}
          className={cn(
            'absolute top-2.5 right-2.5',
            'flex items-center justify-center w-7 h-7 rounded-lg',
            'text-gray-600 hover:text-red-400 hover:bg-red-500/10',
            'transition-colors',
            interactions.button.base,
            deleteBlock.isPending && 'opacity-50 pointer-events-none',
          )}
          aria-label={`Remove ${typeLabel} block`}
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z"
              stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <p className={cn('text-[10px] uppercase tracking-widest font-medium mb-2.5', colorClass)}>
          {typeLabel}
        </p>
        {block.templateExercises.length === 0 ? (
          <p className="text-xs text-gray-600 py-1 mb-2">No exercises yet</p>
        ) : (
          <div className="space-y-1.5 mb-3">
            {block.templateExercises.map(ex => (
              <div key={ex.id} className="flex items-center justify-between">
                <p className="text-sm text-gray-300 truncate flex-1">{ex.exercise?.name ?? 'Unknown'}</p>
                <p className="text-xs text-gray-600 font-mono ml-3 shrink-0">
                  {ex.targetSets ? `${ex.targetSets}×` : ''}
                  {ex.targetReps
                    ? ex.targetReps
                    : ex.targetDurationSeconds
                      ? `${ex.targetDurationSeconds}s`
                      : '—'}
                  {ex.targetWeight ? ` · ${ex.targetWeight}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className={cn(
            'flex items-center gap-1.5 text-xs text-gray-500 hover:text-command-blue transition-colors',
            interactions.button.base,
          )}
        >
          <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add exercise
        </button>
      </div>

      <TemplateExercisePickerSheet
        open={pickerOpen}
        templateId={templateId}
        templateWorkoutId={block.id}
        workoutType={block.workoutType}
        currentCount={block.templateExercises.length}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}

// ── Add block type picker ─────────────────────────────────────────────────────

const WORKOUT_TYPES = [
  { value: 'resistance',   label: 'Resistance',   emoji: '🏋️' },
  { value: 'cardio',       label: 'Cardio',        emoji: '🏃' },
  { value: 'calisthenics', label: 'Calisthenics',  emoji: '💪' },
  { value: 'stretching',   label: 'Stretching',    emoji: '🧘' },
  { value: 'cooldown',     label: 'Cooldown',      emoji: '❄️' },
]

function AddTemplateBlockSheet({ open, templateId, onClose }: {
  open: boolean; templateId: string; onClose: () => void
}): React.JSX.Element {
  const addBlock = useAddTemplateBlock()

  const handleSelect = (workoutType: string): void => {
    addBlock.mutate(
      { templateId, workoutType, orderIndex: 999 },
      {
        onSuccess: () => { toast.success('Block added'); onClose() },
        onError:   () => toast.error('Failed to add block'),
      }
    )
  }

  if (!open) return <></>

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full bg-brand-secondary rounded-t-2xl border-t border-surface-border p-4">
        <p className="text-sm font-medium text-gray-200 mb-3">Add workout block</p>
        <div className="grid grid-cols-2 gap-2">
          {WORKOUT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleSelect(t.value)}
              disabled={addBlock.isPending}
              className={cn(
                'flex items-center gap-2 px-3 py-3 rounded-xl',
                'bg-brand-primary border border-surface-border',
                'text-sm text-gray-300 text-left',
                interactions.button.base,
                interactions.button.press,
              )}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="w-full mt-3 py-2 text-sm text-gray-500">
          Cancel
        </button>
      </div>
    </div>
  )
}
