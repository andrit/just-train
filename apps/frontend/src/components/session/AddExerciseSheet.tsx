// ------------------------------------------------------------
// components/session/AddExerciseSheet.tsx (v2.2.0)
//
// Bottom sheet for adding an exercise to a workout block.
//
// FLOW:
//   1. Search the exercise library
//   2. Tap to select → target config screen (workout-type aware)
//   3. Confirm → adds exercise with those targets
//
// TARGET CONFIG BY WORKOUT TYPE:
//   resistance   → Sets × Reps × Weight
//   cardio       → Rounds + metric picker (Distance / Time / Intensity)
//   calisthenics → Sets × Reps  OR  Sets × Time (toggle)
//   stretching   → Sets × Hold duration
//   cooldown     → Duration only
//
// QUICK-ADD: type a name with no match → "Create as draft"
// ------------------------------------------------------------

import { useState, useMemo }    from 'react'
import { cn }                    from '@/lib/cn'
import { interactions }          from '@/lib/interactions'
import { BottomSheet }           from '@/components/ui/BottomSheet'
import { DragStepper }           from '@/components/ui/DragStepper'
import { Spinner }               from '@/components/ui/Spinner'
import {
  useExercises,
  useCreateExercise,
}                                from '@/lib/queries/exercises'
import { useAddExercise }        from '@/lib/queries/sessions'
import { useAuthStore }          from '@/store/authStore'
import type { ExerciseSummaryResponse } from '@trainer-app/shared'
import type { AddExerciseInput } from '@/lib/queries/sessions'

// ── Metric config per workout type ────────────────────────────────────────────

type CardioMetric = 'distance' | 'time' | 'intensity'
const INTENSITY_OPTIONS = ['low', 'moderate', 'high', 'max'] as const
type IntensityLevel = typeof INTENSITY_OPTIONS[number]

// ── Target config component ───────────────────────────────────────────────────

function ResistanceTargets({
  sets, reps, weight, weightUnit,
  onSets, onReps, onWeight,
}: {
  sets: number; reps: number; weight: string; weightUnit: string
  onSets: (v: number) => void; onReps: (v: number) => void; onWeight: (v: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex justify-around items-start">
        <DragStepper value={sets} onChange={onSets} min={1} max={10} label="Sets" />
        <div className="text-2xl text-gray-700 pt-8">×</div>
        <DragStepper value={reps} onChange={onReps} min={1} max={30} label="Reps" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center mb-2">
          Target Weight ({weightUnit})
        </p>
        <input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => onWeight(e.target.value)}
          placeholder="optional"
          className="field text-center text-2xl font-mono font-bold w-full"
        />
      </div>
    </div>
  )
}

function CardioTargets({
  rounds, metric, distance, duration, intensity,
  onRounds, onMetric, onDistance, onDuration, onIntensity,
}: {
  rounds: number; metric: CardioMetric
  distance: string; duration: number; intensity: IntensityLevel
  onRounds: (v: number) => void; onMetric: (v: CardioMetric) => void
  onDistance: (v: string) => void; onDuration: (v: number) => void
  onIntensity: (v: IntensityLevel) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Rounds */}
      <div className="flex justify-center">
        <DragStepper value={rounds} onChange={onRounds} min={1} max={20} label="Rounds / Intervals" />
      </div>

      {/* Metric picker */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center mb-3">
          Measure by
        </p>
        <div className="flex gap-2">
          {(['distance', 'time', 'intensity'] as CardioMetric[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMetric(m)}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
                metric === m
                  ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
                  : 'border-surface-border text-gray-500 hover:text-gray-300',
              )}
            >
              {m === 'distance' ? '📏 Distance' : m === 'time' ? '⏱ Time' : '🔥 Intensity'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric input */}
      {metric === 'distance' && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center mb-2">Distance (m)</p>
          <input
            type="number"
            inputMode="decimal"
            value={distance}
            onChange={(e) => onDistance(e.target.value)}
            placeholder="e.g. 400"
            className="field text-center text-2xl font-mono font-bold w-full"
          />
          <p className="text-[10px] text-gray-600 text-center mt-1">metres per round</p>
        </div>
      )}

      {metric === 'time' && (
        <div className="flex justify-center">
          <DragStepper value={duration} onChange={onDuration} min={5} max={3600} label="Seconds per round" />
        </div>
      )}

      {metric === 'intensity' && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center mb-3">Intensity level</p>
          <div className="flex gap-2">
            {INTENSITY_OPTIONS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onIntensity(level)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-xs font-medium border capitalize transition-all',
                  intensity === level
                    ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
                    : 'border-surface-border text-gray-500 hover:text-gray-300',
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CalisthenicsTargets({
  mode, sets, reps, duration,
  onMode, onSets, onReps, onDuration,
}: {
  mode: 'reps' | 'time'; sets: number; reps: number; duration: number
  onMode: (v: 'reps' | 'time') => void
  onSets: (v: number) => void; onReps: (v: number) => void; onDuration: (v: number) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onMode('reps')}
          className={cn(
            'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
            mode === 'reps'
              ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
              : 'border-surface-border text-gray-500 hover:text-gray-300',
          )}
        >
          By Reps
        </button>
        <button
          type="button"
          onClick={() => onMode('time')}
          className={cn(
            'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
            mode === 'time'
              ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
              : 'border-surface-border text-gray-500 hover:text-gray-300',
          )}
        >
          By Time
        </button>
      </div>

      <div className="flex justify-around items-start">
        <DragStepper value={sets} onChange={onSets} min={1} max={10} label="Sets" />
        <div className="text-2xl text-gray-700 pt-8">×</div>
        {mode === 'reps' ? (
          <DragStepper value={reps} onChange={onReps} min={1} max={100} label="Reps" />
        ) : (
          <DragStepper value={duration} onChange={onDuration} min={5} max={300} label="Seconds" />
        )}
      </div>
    </div>
  )
}

function StretchTargets({
  sets, duration, onSets, onDuration,
}: {
  sets: number; duration: number
  onSets: (v: number) => void; onDuration: (v: number) => void
}): React.JSX.Element {
  return (
    <div className="flex justify-around items-start">
      <DragStepper value={sets} onChange={onSets} min={1} max={6} label="Sets" />
      <div className="text-2xl text-gray-700 pt-8">×</div>
      <DragStepper value={duration} onChange={onDuration} min={10} max={120} label="Seconds" />
    </div>
  )
}

function CooldownTargets({
  duration, onDuration,
}: {
  duration: number; onDuration: (v: number) => void
}): React.JSX.Element {
  return (
    <div className="flex justify-center">
      <DragStepper value={duration} onChange={onDuration} min={30} max={600} label="Duration (seconds)" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AddExerciseSheetProps {
  open:        boolean
  workoutId:   string
  sessionId:   string
  workoutType: string
  onClose:     () => void
}

export function AddExerciseSheet({
  open, workoutId, sessionId, workoutType, onClose,
}: AddExerciseSheetProps): React.JSX.Element {
  const trainer = useAuthStore((s) => s.trainer)
  const weightUnit = trainer?.weightUnitPreference ?? 'lbs'

  const [search,        setSearch]        = useState('')
  const [selected,      setSelected]      = useState<ExerciseSummaryResponse | null>(null)
  const [isConfirming,  setIsConfirming]  = useState(false)

  // Resistance
  const [targetSets,    setTargetSets]    = useState(3)
  const [targetReps,    setTargetReps]    = useState(10)
  const [targetWeight,  setTargetWeight]  = useState('')

  // Cardio
  const [cardioRounds,   setCardioRounds]   = useState(4)
  const [cardioMetric,   setCardioMetric]   = useState<CardioMetric>('time')
  const [cardioDistance, setCardioDistance] = useState('')
  const [cardioDuration, setCardioDuration] = useState(60)
  const [cardioIntensity, setCardioIntensity] = useState<IntensityLevel>('moderate')

  // Calisthenics
  const [caliMode,      setCaliMode]      = useState<'reps' | 'time'>('reps')
  const [caliSets,      setCaliSets]      = useState(3)
  const [caliReps,      setCaliReps]      = useState(15)
  const [caliDuration,  setCaliDuration]  = useState(30)

  // Stretching
  const [stretchSets,   setStretchSets]   = useState(2)
  const [stretchHold,   setStretchHold]   = useState(30)

  // Cooldown
  const [cooldownDur,   setCooldownDur]   = useState(120)

  const { data: exercises, isLoading } = useExercises()
  const addExercise                    = useAddExercise()
  const createExercise                 = useCreateExercise()

  // Pre-filter by the block's workout type — trainer can override with "All"
  const [showAllTypes, setShowAllTypes] = useState(false)

  const filtered = useMemo(() => {
    if (!exercises) return []
    const q = search.trim().toLowerCase()
    const typeFiltered = showAllTypes
      ? exercises
      : exercises.filter(e => e.workoutType === workoutType)
    if (!q) return typeFiltered.slice(0, 30)
    return typeFiltered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.bodyPart?.name ?? '').toLowerCase().includes(q)
    )
  }, [exercises, search, workoutType, showAllTypes])

  const showQuickAdd = search.trim().length > 1 && filtered.length === 0

  const handleClose = (): void => {
    setSearch(''); setSelected(null); setIsConfirming(false); setShowAllTypes(false)
    onClose()
  }

  const handleSelect = (exercise: ExerciseSummaryResponse): void => {
    setSelected(exercise)
    setIsConfirming(true)
  }

  // Build the AddExerciseInput based on workout type
  const buildInput = (): Omit<AddExerciseInput, 'workoutId' | 'sessionId' | 'exerciseId'> => {
    switch (workoutType) {
      case 'resistance':
        return {
          targetSets,
          targetReps,
          ...(targetWeight.trim() && { targetWeight: parseFloat(targetWeight), targetWeightUnit: weightUnit }),
        }
      case 'cardio':
        return {
          targetSets: cardioRounds,
          ...(cardioMetric === 'distance' && cardioDistance.trim() && { targetDistance: parseFloat(cardioDistance) }),
          ...(cardioMetric === 'time'     && { targetDurationSeconds: cardioDuration }),
          ...(cardioMetric === 'intensity'&& { targetIntensity: cardioIntensity }),
        }
      case 'calisthenics':
        return {
          targetSets:  caliSets,
          ...(caliMode === 'reps' && { targetReps: caliReps }),
          ...(caliMode === 'time' && { targetDurationSeconds: caliDuration }),
        }
      case 'stretching':
        return {
          targetSets:            stretchSets,
          targetDurationSeconds: stretchHold,
        }
      case 'cooldown':
        return {
          targetDurationSeconds: cooldownDur,
        }
      default:
        return { targetSets, targetReps }
    }
  }

  const handleConfirm = (): void => {
    if (!selected) return
    addExercise.mutate(
      { workoutId, sessionId, exerciseId: selected.id, ...buildInput() },
      { onSuccess: handleClose },
    )
  }

  const handleQuickAdd = (): void => {
    createExercise.mutate(
      { name: search.trim(), workoutType, isDraft: true } as Parameters<typeof createExercise.mutate>[0],
      {
        onSuccess: (newExercise) => {
          addExercise.mutate(
            { workoutId, sessionId, exerciseId: newExercise.id, ...buildInput() },
            { onSuccess: handleClose },
          )
        },
      }
    )
  }

  const isPending = addExercise.isPending || createExercise.isPending

  // Label for the targets step
  const targetsTitle =
    workoutType === 'cardio'       ? 'Set targets — Cardio'
    : workoutType === 'stretching' ? 'Set targets — Stretch'
    : workoutType === 'cooldown'   ? 'Set duration'
    : 'Set targets'

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={isConfirming ? targetsTitle : 'Add Exercise'}
      maxHeight="90vh"
    >
      {!isConfirming ? (
        // ── Search + list ─────────────────────────────────────────────────
        <div className="flex flex-col" style={{ height: 'calc(90vh - 100px)' }}>
          <div className="px-4 pt-3 pb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises…"
              autoFocus
              className="w-full field text-sm placeholder-gray-600"
            />
            {/* Type filter — shows which type is active, tap All to expand */}
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAllTypes(false)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize',
                  !showAllTypes
                    ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
                    : 'border-surface-border text-gray-500 hover:text-gray-300',
                )}
              >
                {workoutType}
              </button>
              <button
                type="button"
                onClick={() => setShowAllTypes(true)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                  showAllTypes
                    ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
                    : 'border-surface-border text-gray-500 hover:text-gray-300',
                )}
              >
                All types
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-1">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Spinner size="sm" className="text-gray-500" />
              </div>
            )}

            {filtered.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => handleSelect(exercise)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                  'bg-surface border border-surface-border',
                  'hover:border-brand-highlight/30 hover:bg-brand-highlight/5',
                  'transition-all duration-100',
                  interactions.button.base,
                  interactions.button.press,
                  exercise.isDraft && 'border-dashed',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-200 truncate">{exercise.name}</p>
                  {exercise.bodyPart && (
                    <p className="text-xs text-gray-500 mt-0.5">{exercise.bodyPart.name}</p>
                  )}
                </div>
                {exercise.isDraft && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-500/70 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
                    Draft
                  </span>
                )}
              </button>
            ))}

            {showQuickAdd && (
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={isPending}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                  'border border-dashed border-brand-highlight/40 bg-brand-highlight/5',
                  'hover:bg-brand-highlight/10 transition-all duration-100',
                  interactions.button.base,
                  interactions.button.press,
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-brand-highlight/20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-brand-highlight">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-brand-highlight">Create "{search.trim()}"</p>
                  <p className="text-xs text-gray-500 mt-0.5">Added as a draft — fill in details after your session</p>
                </div>
              </button>
            )}

            {!isLoading && filtered.length === 0 && !showQuickAdd && (
              <p className="text-center text-sm text-gray-600 py-8">No exercises found</p>
            )}
          </div>
        </div>
      ) : (
        // ── Target config ─────────────────────────────────────────────────
        <div className="p-6 pb-8 space-y-6">
          {/* Exercise name */}
          <div className="text-center">
            <p className="font-display text-xl uppercase tracking-wide text-white">{selected?.name}</p>
            {selected?.bodyPart && (
              <p className="text-sm text-gray-500 mt-1">{selected.bodyPart.name}</p>
            )}
          </div>

          {/* Type-aware targets */}
          {workoutType === 'resistance' && (
            <ResistanceTargets
              sets={targetSets} reps={targetReps} weight={targetWeight} weightUnit={weightUnit}
              onSets={setTargetSets} onReps={setTargetReps} onWeight={setTargetWeight}
            />
          )}
          {workoutType === 'cardio' && (
            <CardioTargets
              rounds={cardioRounds} metric={cardioMetric}
              distance={cardioDistance} duration={cardioDuration} intensity={cardioIntensity}
              onRounds={setCardioRounds} onMetric={setCardioMetric}
              onDistance={setCardioDistance} onDuration={setCardioDuration} onIntensity={setCardioIntensity}
            />
          )}
          {workoutType === 'calisthenics' && (
            <CalisthenicsTargets
              mode={caliMode} sets={caliSets} reps={caliReps} duration={caliDuration}
              onMode={setCaliMode} onSets={setCaliSets} onReps={setCaliReps} onDuration={setCaliDuration}
            />
          )}
          {workoutType === 'stretching' && (
            <StretchTargets
              sets={stretchSets} duration={stretchHold}
              onSets={setStretchSets} onDuration={setStretchHold}
            />
          )}
          {workoutType === 'cooldown' && (
            <CooldownTargets duration={cooldownDur} onDuration={setCooldownDur} />
          )}
          {!['resistance','cardio','calisthenics','stretching','cooldown'].includes(workoutType) && (
            <div className="flex justify-around items-start">
              <DragStepper value={targetSets} onChange={setTargetSets} min={1} max={10} label="Sets" />
              <div className="text-2xl text-gray-700 pt-8">×</div>
              <DragStepper value={targetReps} onChange={setTargetReps} min={1} max={30} label="Reps" />
            </div>
          )}

          <p className="text-center text-xs text-gray-600">
            Drag numbers up or down to adjust — or tap ▲ ▼
          </p>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
              'bg-brand-highlight text-white',
              interactions.button.base,
              interactions.button.press,
              isPending && 'opacity-50',
            )}
          >
            {isPending ? <Spinner size="sm" className="mx-auto" /> : 'Add to Block'}
          </button>

          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-300"
          >
            ← Back to search
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
