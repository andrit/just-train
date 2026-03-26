// ------------------------------------------------------------
// components/templates/TemplateBuilderSheet.tsx (v2.7.0)
//
// Bottom sheet for creating and editing templates.
// Shows the full template structure (blocks + exercises)
// in overview/vertical layout — same pattern as SessionPlanPanel.
//
// Used from:
//   - TemplatesPage "New template" / "Edit template"
// ------------------------------------------------------------

import { useState, useEffect }         from 'react'
import { cn }                           from '@/lib/cn'
import { BottomSheet }                  from '@/components/ui/BottomSheet'
import { Spinner }                      from '@/components/ui/Spinner'
import { ConfirmDialog }                from '@/components/ui/ConfirmDialog'
import {
  useTemplate,
  useCreateTemplate,
  useUpdateTemplate,
}                                       from '@/lib/queries/templates'
import { WORKOUT_TYPE_LABEL, WORKOUT_TYPE_COLOR } from '@/lib/exerciseLabels'
import type { TemplateDetailResponse }  from '@trainer-app/shared'

interface TemplateBuilderSheetProps {
  open:       boolean
  templateId: string | null   // null = new template
  onClose:    () => void
}

export function TemplateBuilderSheet({
  open, templateId, onClose,
}: TemplateBuilderSheetProps): React.JSX.Element {
  const { data: existing, isLoading } = useTemplate(templateId)
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()

  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  // Populate fields when editing
  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setDescription(existing.description ?? '')
    } else if (!templateId) {
      setName('')
      setDescription('')
    }
  }, [existing, templateId])

  const isDirty = templateId
    ? name !== (existing?.name ?? '') || description !== (existing?.description ?? '')
    : name.length > 0

  const handleClose = (): void => {
    if (isDirty) { setDiscardOpen(true); return }
    onClose()
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (templateId) {
        await updateTemplate.mutateAsync({
          id: templateId,
          name: name.trim(),
          description: description.trim() || undefined,
        })
      } else {
        await createTemplate.mutateAsync({
          name:        name.trim(),
          description: description.trim() || undefined,
        })
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={handleClose} maxHeight="90vh">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-surface-border shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Cancel
            </button>
            <h2 className="text-sm font-medium text-gray-200">
              {templateId ? 'Edit template' : 'New template'}
            </h2>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className={cn(
                'text-sm font-medium transition-colors',
                name.trim() ? 'text-brand-highlight' : 'text-gray-600',
              )}
            >
              {saving ? <Spinner size="sm" /> : 'Save'}
            </button>
          </div>

          {/* Content */}
          {isLoading && templateId ? (
            <div className="flex justify-center py-12">
              <Spinner size="md" className="text-brand-highlight" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Name + description */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Template name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Push Day A, Full Body Strength…"
                    className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-highlight/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Description <span className="text-gray-700 normal-case">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What's this template for?"
                    rows={2}
                    className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-highlight/50 resize-none"
                  />
                </div>
              </div>

              {/* Workout blocks (read-only overview when editing) */}
              {existing && existing.templateWorkouts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Workout blocks</p>
                  {existing.templateWorkouts.map((block) => (
                    <TemplateBlockCard key={block.id} block={block} />
                  ))}
                </div>
              )}

              {/* Note for new templates */}
              {!templateId && (
                <div className="bg-brand-primary rounded-xl border border-surface-border p-3">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    After saving, open the template to add workout blocks and exercises.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </BottomSheet>

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

// ── Template block card (read-only overview) ──────────────────────────────────

function TemplateBlockCard({ block }: {
  block: TemplateDetailResponse['templateWorkouts'][number]
}): React.JSX.Element {
  const typeColor = WORKOUT_TYPE_COLOR[block.workoutType] ?? 'text-gray-400 border-gray-500/60'
  const typeLabel = WORKOUT_TYPE_LABEL[block.workoutType] ?? block.workoutType

  return (
    <div className="bg-brand-primary rounded-xl border border-surface-border p-3">
      <p className={cn('text-[10px] uppercase tracking-widest font-medium mb-2', typeColor.split(' ')[0])}>
        {typeLabel}
      </p>
      <div className="space-y-1.5">
        {block.templateExercises.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between">
            <p className="text-sm text-gray-300 truncate flex-1">
              {ex.exercise?.name ?? 'Unknown'}
            </p>
            <p className="text-xs text-gray-600 font-mono ml-3 shrink-0">
              {ex.targetSets && `${ex.targetSets}×`}
              {ex.targetReps ?? (ex.targetDurationSeconds ? `${ex.targetDurationSeconds}s` : null) ?? '—'}
              {ex.targetWeight ? ` · ${ex.targetWeight}` : ''}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
