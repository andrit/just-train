// ------------------------------------------------------------
// pages/ExercisesPage.tsx (v1.9.0)
//
// Exercise library — browsable by workout type, body part,
// and category (compound/isolation for resistance).
//
// LAYOUT:
//   Sticky header — search + filter chips
//   Grid — exercise cards
//   Detail panel — slides up from bottom as a BottomSheet
//
// FILTERS:
//   Workout type tabs (all / resistance / cardio / calisthenics / stretching / cooldown)
//   Body part chips
//   Category chips (compound / isolation) — resistance only
//   Drafts toggle
//   Search
// ------------------------------------------------------------

import { useState, useDeferredValue }       from 'react'
import { cn }                                from '@/lib/cn'
import { interactions }                      from '@/lib/interactions'
import { useExercises, useBodyParts }        from '@/lib/queries/exercises'
import { BottomSheet }                       from '@/components/ui/BottomSheet'
import { Spinner }                           from '@/components/ui/Spinner'
import { Button }                            from '@/components/ui/Button'
import { Modal }                             from '@/components/ui/Modal'
import ExerciseCard                          from '@/components/exercises/ExerciseCard'
import ExerciseDetailPanel                   from '@/components/exercises/ExerciseDetailPanel'
import ExerciseForm                          from '@/components/exercises/ExerciseForm'
import type { ExerciseFilters }              from '@/lib/queries/exercises'

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKOUT_TYPES = [
  { value: '',             label: 'All',          color: 'text-gray-300  border-gray-500/60' },
  { value: 'resistance',   label: 'Resistance',   color: 'text-brand-highlight border-brand-highlight/60' },
  { value: 'cardio',       label: 'Cardio',       color: 'text-sky-400   border-sky-500/60' },
  { value: 'calisthenics', label: 'Calisthenics', color: 'text-emerald-400 border-emerald-500/60' },
  { value: 'stretching',   label: 'Stretching',   color: 'text-violet-400 border-violet-500/60' },
  { value: 'cooldown',     label: 'Cooldown',     color: 'text-gray-400  border-gray-500/60' },
] as const

const CATEGORY_CHIPS = [
  { value: 'compound',  label: 'Compound',  desc: 'Multi-joint' },
  { value: 'isolation', label: 'Isolation', desc: 'Single-joint' },
] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExercisesPage(): React.JSX.Element {
  const [rawSearch,        setRawSearch]        = useState('')
  const [workoutType,      setWorkoutType]      = useState('')
  const [bodyPartId,       setBodyPartId]       = useState('')
  const [category,         setCategory]         = useState('')
  const [draftsOnly,       setDraftsOnly]       = useState(false)
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [createOpen,       setCreateOpen]       = useState(false)

  const search = useDeferredValue(rawSearch.trim())

  const filters: ExerciseFilters = {
    ...(search      && { search }),
    ...(bodyPartId  && { bodyPartId }),
    ...(workoutType && { workoutType }),
    ...(draftsOnly  && { isDraft: true }),
  }

  const { data: exercises, isLoading, error } = useExercises(filters)
  const { data: bodyParts }                   = useBodyParts()

  // Client-side category filter (not in backend query yet)
  const filtered = category
    ? (exercises ?? []).filter((e) => (e as any).category === category)
    : (exercises ?? [])

  const hasFilters = !!(search || bodyPartId || workoutType || draftsOnly || category)
  const showCategoryFilter = workoutType === 'resistance' || workoutType === ''

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-brand-primary/90 backdrop-blur-md border-b border-surface-border">

        {/* Title + New button */}
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3">
          <h1 className="font-display text-3xl uppercase tracking-wide text-white">
            Exercises
          </h1>
          <Button
            onClick={() => setCreateOpen(true)}
            icon={<span className="text-base font-bold">+</span>}
          >
            New
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 md:px-6 pb-3">
          <div className="relative">
            <svg viewBox="0 0 16 16" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none">
              <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search exercises…"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              className="field pl-9"
            />
          </div>
        </div>

        {/* Workout type tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hidden px-4 md:px-6 pb-3">
          {WORKOUT_TYPES.map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setWorkoutType(value)
                setCategory('') // reset category when switching type
              }}
              className={cn(
                'shrink-0 px-4 py-1.5 rounded-full border text-xs font-medium transition-all duration-150',
                workoutType === value
                  ? cn(color, 'bg-current/10')
                  : 'border-surface-border text-gray-500 hover:border-gray-500 hover:text-gray-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Secondary filters */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hidden px-4 md:px-6 pb-3">
          {/* Body parts */}
          {(bodyParts ?? []).map((bp) => (
            <button
              key={bp.id}
              type="button"
              onClick={() => setBodyPartId(bodyPartId === bp.id ? '' : bp.id)}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full border text-[11px] font-medium capitalize transition-all duration-150',
                bodyPartId === bp.id
                  ? 'border-brand-highlight/60 text-brand-highlight bg-brand-highlight/10'
                  : 'border-surface-border text-gray-600 hover:border-gray-500 hover:text-gray-400',
              )}
            >
              {bp.name.replace('_', ' ')}
            </button>
          ))}

          {/* Category (resistance context) */}
          {showCategoryFilter && CATEGORY_CHIPS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(category === value ? '' : value)}
              className={cn(
                'shrink-0 px-3 py-1 rounded-full border text-[11px] font-medium transition-all duration-150',
                category === value
                  ? 'border-violet-500/60 text-violet-400 bg-violet-500/10'
                  : 'border-surface-border text-gray-600 hover:border-gray-500 hover:text-gray-400',
              )}
            >
              {label}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px bg-surface-border shrink-0 mx-1" />

          {/* Drafts toggle */}
          <button
            type="button"
            onClick={() => setDraftsOnly(!draftsOnly)}
            className={cn(
              'shrink-0 px-3 py-1 rounded-full border text-[11px] font-medium transition-all duration-150',
              draftsOnly
                ? 'border-amber-500/60 text-amber-400 bg-amber-500/10'
                : 'border-surface-border text-gray-600 hover:border-gray-500 hover:text-gray-400',
            )}
          >
            ✏️ Drafts
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 md:px-6 py-4">

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Spinner size="lg" className="text-brand-highlight" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-center">
            <p className="text-red-400 text-sm">{error.message}</p>
          </div>
        )}

        {/* Result count */}
        {!isLoading && !error && filtered.length > 0 && hasFilters && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500">
              {filtered.length} exercise{filtered.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => {
                setRawSearch('')
                setBodyPartId('')
                setWorkoutType('')
                setCategory('')
                setDraftsOnly(false)
              }}
              className="text-xs text-gray-600 hover:text-gray-300"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Empty states */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {hasFilters ? (
              <>
                <p className="text-2xl mb-3" aria-hidden>🔍</p>
                <p className="text-gray-400 font-medium">No exercises match</p>
                <p className="text-gray-600 text-sm mt-1">Try adjusting your filters</p>
                <button
                  type="button"
                  onClick={() => {
                    setRawSearch('')
                    setBodyPartId('')
                    setWorkoutType('')
                    setCategory('')
                    setDraftsOnly(false)
                  }}
                  className="mt-4 text-sm text-brand-highlight hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-2xl mb-3" aria-hidden>💪</p>
                <p className="text-gray-400 font-medium">Library is loading</p>
                <p className="text-gray-600 text-sm mt-1">Run pnpm db:seed to populate the public library</p>
              </>
            )}
          </div>
        )}

        {/* Exercise grid */}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {filtered.map((exercise, i) => (
              <div
                key={exercise.id}
                className="animate-slide-up"
                style={{ animationDelay: `${Math.min(i * 20, 200)}ms`, animationFillMode: 'both' }}
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

      {/* ── Exercise detail panel ──────────────────────────────────────────── */}
      <BottomSheet
        open={!!activeExerciseId}
        onClose={() => setActiveExerciseId(null)}
        maxHeight="95vh"
      >
        <div className="overflow-y-auto px-4 pt-2" style={{ maxHeight: 'calc(95vh - 60px)' }}>
          {activeExerciseId && (
            <ExerciseDetailPanel
              exerciseId={activeExerciseId}
              onClose={() => setActiveExerciseId(null)}
              onDeleted={() => setActiveExerciseId(null)}
            />
          )}
        </div>
      </BottomSheet>

      {/* ── Create exercise modal ──────────────────────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Exercise" size="md">
        <ExerciseForm
          onSuccess={() => setCreateOpen(false)}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  )
}
