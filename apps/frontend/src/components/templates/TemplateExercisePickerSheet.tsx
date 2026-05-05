// ------------------------------------------------------------
// components/templates/TemplateExercisePickerSheet.tsx (v2.10.0)
//
// Exercise picker for the template builder.
// Pre-filters by the parent block's workout type so resistance
// blocks only show resistance exercises, etc.
// "All types" chip to override.
// Accordion rows with swipe-right-to-add.
// ------------------------------------------------------------

import { useState, useMemo }     from 'react'
import { cn }                    from '@/lib/cn'
import { Spinner }               from '@/components/ui/Spinner'
import { useExercises }          from '@/lib/queries/exercises'
import { useAddTemplateExercise } from '@/lib/queries/templates'
import { toast }                 from '@/store/toastStore'
import { WORKOUT_TYPE_LABEL }    from '@/lib/exerciseLabels'
import { ExerciseAccordionRow }  from '@/components/exercises/ExerciseAccordionRow'

interface TemplateExercisePickerSheetProps {
  open:              boolean
  templateId:        string
  templateWorkoutId: string
  workoutType:       string
  currentCount:      number   // for orderIndex
  onClose:           () => void
}

export function TemplateExercisePickerSheet({
  open, templateId, templateWorkoutId, workoutType, currentCount, onClose,
}: TemplateExercisePickerSheetProps): React.JSX.Element {
  const [search, setSearch]             = useState('')
  const [showAllTypes, setShowAllTypes] = useState(false)
  const [expandedId, setExpandedId]     = useState<string | null>(null)

  const { data: exercises, isLoading }  = useExercises(search ? { search } : undefined)
  const addExercise                     = useAddTemplateExercise()

  const filtered = useMemo(() => {
    if (!exercises) return []
    const typeFiltered = showAllTypes
      ? exercises
      : exercises.filter(e => e.workoutType === workoutType)
    const q = search.trim().toLowerCase()
    if (!q) return typeFiltered.slice(0, 50)
    return typeFiltered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.bodyPart?.name ?? '').toLowerCase().includes(q)
    )
  }, [exercises, search, workoutType, showAllTypes])

  const typeLabel = WORKOUT_TYPE_LABEL[workoutType] ?? workoutType

  const handleAdd = (exerciseId: string, name: string): void => {
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
      <div className="relative w-full bg-brand-secondary rounded-t-2xl border-t border-surface-border flex flex-col" style={{ maxHeight: '80vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-surface-border shrink-0">
          <h3 className="text-sm font-medium text-gray-200">Add exercise</h3>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300 text-sm">Cancel</button>
        </div>

        {/* Search + filter chips */}
        <div className="px-4 py-3 border-b border-surface-border shrink-0 space-y-2">
          <input
            type="text"
            placeholder="Search exercises…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-command-blue/50"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowAllTypes(false)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize',
                !showAllTypes
                  ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
                  : 'border-surface-border text-gray-500 hover:text-gray-300',
              )}
            >
              {typeLabel}
            </button>
            <button
              type="button"
              onClick={() => setShowAllTypes(true)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                showAllTypes
                  ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
                  : 'border-surface-border text-gray-500 hover:text-gray-300',
              )}
            >
              All types
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="md" className="text-command-blue" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">
              {search
                ? `No exercises matching "${search}"`
                : `No exercises found for ${typeLabel}`}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map(ex => (
                <ExerciseAccordionRow
                  key={ex.id}
                  exercise={ex}
                  expanded={expandedId === ex.id}
                  onToggle={() => setExpandedId(prev => prev === ex.id ? null : ex.id)}
                  swipeEnabled
                  onAdd={() => handleAdd(ex.id, ex.name)}
                  disabled={addExercise.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
