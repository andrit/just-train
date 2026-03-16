// ------------------------------------------------------------
// pages/ExercisesPage.tsx — Exercise library (Phase 3)
//
// The trainer's personal exercise database.
// Features:
//   - Searchable, filterable grid of exercise cards
//   - Filter chips: body part + workout type + "Drafts only"
//   - Create exercise via Modal
//   - Click card → detail Drawer (view/edit/delete + media upload)
// ------------------------------------------------------------

import { useState, useDeferredValue } from 'react'
import { useExercises, useBodyParts }  from '@/lib/queries/exercises'
import type { ExerciseFilters }         from '@/lib/queries/exercises'
import { Button, Modal, Drawer, EmptyState, Spinner } from '@/components/ui'
import ExerciseCard    from '@/components/exercises/ExerciseCard'
import ExerciseForm    from '@/components/exercises/ExerciseForm'
import ExerciseDetail  from '@/components/exercises/ExerciseDetail'

const WORKOUT_TYPES = [
  { value: 'cardio',       label: 'Cardio',        color: 'border-sky-500/60  text-sky-400'     },
  { value: 'stretching',   label: 'Stretch',       color: 'border-green-500/60 text-green-400'  },
  { value: 'calisthenics', label: 'Calisthenics',  color: 'border-amber-500/60 text-amber-400'  },
  { value: 'resistance',   label: 'Resistance',    color: 'border-red-500/60   text-red-400'    },
  { value: 'cooldown',     label: 'Cooldown',      color: 'border-gray-500/60  text-gray-400'   },
]

export default function ExercisesPage(): React.JSX.Element {
  const [rawSearch,        setRawSearch]        = useState('')
  const [bodyPartId,       setBodyPartId]       = useState('')
  const [workoutType,      setWorkoutType]      = useState('')
  const [draftsOnly,       setDraftsOnly]       = useState(false)
  const [createOpen,       setCreateOpen]       = useState(false)
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)

  const search = useDeferredValue(rawSearch.trim())

  const filters: ExerciseFilters = {
    ...(search      && { search }),
    ...(bodyPartId  && { bodyPartId }),
    ...(workoutType && { workoutType }),
    ...(draftsOnly  && { isDraft: true }),
  }

  const { data: exercises, isLoading, error } = useExercises(filters)
  const { data: bodyParts }                    = useBodyParts()
  const hasFilters = !!(search || bodyPartId || workoutType || draftsOnly)

  return (
    <div className="flex flex-col min-h-full">

      {/* Page header + filter bar */}
      <div className="sticky top-0 z-20 bg-brand-primary/80 backdrop-blur-md
                      border-b border-surface-border px-4 md:px-6 py-4">

        <div className="flex items-center justify-between gap-4 mb-4">
          <h1 className="font-display text-3xl text-white tracking-tight">
            Exercise Library
          </h1>
          <Button onClick={() => setCreateOpen(true)} icon={<span className="text-base font-bold">+</span>}>
            New Exercise
          </Button>
        </div>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none select-none">
              🔍
            </span>
            <input
              type="search"
              placeholder="Search exercises…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="field pl-9"
            />
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hidden pb-0.5">
            {WORKOUT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setWorkoutType(workoutType === type.value ? '' : type.value)}
                className={[
                  'shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150',
                  workoutType === type.value
                    ? `${type.color} bg-current/10`
                    : 'border-surface-border text-gray-500 hover:border-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {type.label}
              </button>
            ))}

            <div className="w-px bg-surface-border shrink-0 mx-1" />

            {(bodyParts ?? []).map((bp) => (
              <button
                key={bp.id}
                onClick={() => setBodyPartId(bodyPartId === bp.id ? '' : bp.id)}
                className={[
                  'shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium capitalize transition-all duration-150',
                  bodyPartId === bp.id
                    ? 'border-brand-highlight/60 text-brand-highlight bg-brand-highlight/10'
                    : 'border-surface-border text-gray-500 hover:border-gray-500 hover:text-gray-300',
                ].join(' ')}
              >
                {bp.name.replace('_', ' ')}
              </button>
            ))}

            <div className="w-px bg-surface-border shrink-0 mx-1" />

            <button
              onClick={() => setDraftsOnly(!draftsOnly)}
              className={[
                'shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150',
                draftsOnly
                  ? 'border-amber-500/60 text-amber-400 bg-amber-500/10'
                  : 'border-surface-border text-gray-500 hover:border-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              ✏️ Drafts
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 md:px-6 py-5">
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" className="text-brand-highlight" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
            <p className="text-red-400 text-sm">{error.message}</p>
          </div>
        )}

        {!isLoading && !error && exercises && hasFilters && exercises.length > 0 && (
          <p className="text-xs text-gray-500 mb-4">
            {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} found
          </p>
        )}

        {!isLoading && !error && exercises?.length === 0 && (
          hasFilters ? (
            <EmptyState
              icon="🔍"
              title="No exercises match"
              message="Try adjusting your filters or search term."
              action={
                <Button variant="ghost" size="sm" onClick={() => {
                  setRawSearch(''); setBodyPartId(''); setWorkoutType(''); setDraftsOnly(false)
                }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="💪"
              title="Your library is empty"
              message="Add your first exercise. You can also quick-add exercises mid-session and enrich them here later."
              action={
                <Button onClick={() => setCreateOpen(true)} icon={<span>+</span>}>
                  Create First Exercise
                </Button>
              }
            />
          )
        )}

        {!isLoading && !error && exercises && exercises.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {exercises.map((exercise, i) => (
              <div
                key={exercise.id}
                className="animate-slide-up"
                style={{ animationDelay: `${Math.min(i * 25, 250)}ms`, animationFillMode: 'both' }}
              >
                <ExerciseCard
                  exercise={exercise}
                  onClick={() => setActiveExerciseId(exercise.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Exercise" size="md">
        <ExerciseForm
          onSuccess={() => setCreateOpen(false)}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        open={!!activeExerciseId}
        onClose={() => setActiveExerciseId(null)}
        title="Exercise Detail"
      >
        {activeExerciseId && (
          <ExerciseDetail
            exerciseId={activeExerciseId}
            onClose={() => setActiveExerciseId(null)}
            onDeleted={() => setActiveExerciseId(null)}
          />
        )}
      </Drawer>
    </div>
  )
}
