// ------------------------------------------------------------
// components/templates/TemplateExercisePickerSheet.tsx
//
// Exercise picker for the template builder.
// Searches the trainer's exercise library and adds the
// selected exercise to a template workout block.
// ------------------------------------------------------------

import { useState }              from 'react'
import { cn }                    from '@/lib/cn'
import { interactions }          from '@/lib/interactions'
import { Spinner }               from '@/components/ui/Spinner'
import { useExercises }          from '@/lib/queries/exercises'
import { useAddTemplateExercise } from '@/lib/queries/templates'
import { toast }                 from '@/store/toastStore'

interface TemplateExercisePickerSheetProps {
  open:             boolean
  templateId:       string
  templateWorkoutId: string
  currentCount:     number   // for orderIndex
  onClose:          () => void
}

export function TemplateExercisePickerSheet({
  open, templateId, templateWorkoutId, currentCount, onClose,
}: TemplateExercisePickerSheetProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const { data: exercises, isLoading } = useExercises(search ? { search } : undefined)
  const addExercise = useAddTemplateExercise()

  const handleSelect = (exerciseId: string, name: string): void => {
    addExercise.mutate(
      { templateId, templateWorkoutId, exerciseId, orderIndex: currentCount },
      {
        onSuccess: () => { toast.success(`${name} added`); onClose() },
        onError:   () => toast.error('Failed to add exercise'),
      }
    )
  }

  if (!open) return <></>

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-brand-secondary rounded-t-2xl border-t border-surface-border flex flex-col" style={{ maxHeight: '75vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-surface-border shrink-0">
          <h3 className="text-sm font-medium text-gray-200">Add exercise</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-surface-border shrink-0">
          <input
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-highlight/50"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="md" className="text-brand-highlight" /></div>
          ) : (exercises ?? []).length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">
              {search ? `No exercises matching "${search}"` : 'No exercises yet'}
            </p>
          ) : (
            <div className="space-y-1">
              {(exercises ?? []).map(ex => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => handleSelect(ex.id, ex.name)}
                  disabled={addExercise.isPending}
                  className={cn(
                    'w-full text-left px-3 py-3 rounded-xl',
                    'bg-brand-primary border border-surface-border',
                    'hover:border-brand-highlight/30 transition-colors',
                    interactions.button.base,
                    interactions.button.press,
                  )}
                >
                  <p className="text-sm text-gray-200">{ex.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5 capitalize">
                    {ex.workoutType}{ex.equipment ? ` · ${ex.equipment}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
