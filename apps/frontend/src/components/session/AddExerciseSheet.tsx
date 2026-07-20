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
import { NumberField }           from '@/components/ui/NumberField'
import { Spinner }               from '@/components/ui/Spinner'
import {
  useExercises,
  useCreateExercise,
}                                from '@/lib/queries/exercises'
import { useAddExercise }        from '@/lib/queries/sessions'
import { useAuthStore }          from '@/store/authStore'
import { ExerciseAccordionRow }  from '@/components/exercises/ExerciseAccordionRow'
import type { ExerciseSummaryResponse } from '@trainer-app/shared'
import type { AddExerciseInput } from '@/lib/queries/sessions'

// ── Metric config per workout type ────────────────────────────────────────────

type CardioMetric = 'distance' | 'time' | 'intensity'
const INTENSITY_OPTIONS = ['low', 'moderate', 'high', 'max'] as const
type IntensityLevel = typeof INTENSITY_OPTIONS[number]

// ── Target config component ───────────────────────────────────────────────────

type RepsMode = 'uniform' | 'ramp' | 'per-set'

const REPS_MODE_LABEL: Record<RepsMode, string> = {
  uniform: 'All same', ramp: 'Ramp', 'per-set': 'Per set',
}

function RepsModeToggle({ mode, onMode }: { mode: RepsMode; onMode: (v: RepsMode) => void }): React.JSX.Element {
  return (
    <div className="flex gap-2">
      {(['uniform', 'ramp', 'per-set'] as RepsMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onMode(m)}
          className={cn(
            'flex-1 py-1.5 rounded-xl text-xs font-medium border transition-all',
            mode === m
              ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
              : 'border-surface-border text-gray-500 hover:text-gray-300',
          )}
        >
          {REPS_MODE_LABEL[m]}
        </button>
      ))}
    </div>
  )
}

// Expand a start value + per-set step into a clamped sequence (e.g. 10, −2, 3 → 10/8/6).
function rampSequence(start: number, step: number, sets: number, lo = 1, hi = 100): number[] {
  return Array.from({ length: Math.max(1, sets) }, (_, i) =>
    Math.min(hi, Math.max(lo, start + i * step)))
}

// Ramp editor — a start value and a per-set step, with a live preview of the result.
function RampInputs({ start, step, sets, onStart, onStep }: {
  start: number; step: number; sets: number
  onStart: (v: number) => void; onStep: (v: number) => void
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-center gap-5">
        <NumberField value={start} onChange={(v) => onStart(v ?? 1)} min={1} max={100} label="Start" />
        <NumberField value={step} onChange={(v) => onStep(v ?? 0)} min={-50} max={50} label="Step / set" />
      </div>
      <p className="text-center text-sm text-gray-400 font-mono tracking-wide">
        {rampSequence(start, step, sets).join(' · ')}
      </p>
    </div>
  )
}

function PerSetRepsInputs({ repsPerSet, onChange }: {
  repsPerSet: number[]
  onChange:   (v: number[]) => void
}): React.JSX.Element {
  return (
    <div className="space-y-2">
      {repsPerSet.map((r, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-600 font-mono w-10 shrink-0 text-right">
            Set {i + 1}
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={r}
            min={1}
            max={100}
            onChange={(e) => {
              const v = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1))
              const next = [...repsPerSet]
              next[i] = v
              onChange(next)
            }}
            className="field text-center text-lg font-mono font-bold flex-1"
          />
          <span className="text-xs text-gray-600 w-8 shrink-0">reps</span>
        </div>
      ))}
    </div>
  )
}

function UseLastTimeToggle({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }): React.JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-surface-border bg-surface/40 cursor-pointer">
      <div>
        <p className="text-sm text-gray-300">Use last time&rsquo;s weights</p>
        <p className="text-[11px] text-gray-600">Prefill each set from your last session for this exercise</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Use last time's weights"
        onClick={() => onToggle(!on)}
        className={cn('relative w-11 h-6 rounded-full transition-colors shrink-0', on ? 'bg-command-blue' : 'bg-surface-border')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', on && 'translate-x-5')} />
      </button>
    </label>
  )
}

function ResistanceTargets({
  sets, reps, repsMode, repsStep, repsPerSet, weight, weightUnit, useLastWeight,
  onSets, onReps, onRepsMode, onRepsStep, onRepsPerSet, onWeight, onUseLastWeight,
}: {
  sets: number; reps: number; weight: number | null; weightUnit: string
  repsMode:    RepsMode
  repsStep:    number
  repsPerSet:  number[]
  useLastWeight: boolean
  onSets:      (v: number) => void
  onReps:      (v: number) => void
  onRepsMode:  (v: RepsMode) => void
  onRepsStep:  (v: number) => void
  onRepsPerSet:(v: number[]) => void
  onWeight:    (v: number | null) => void
  onUseLastWeight: (v: boolean) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* Use last time — opt-in, kept at the top away from the numeric controls */}
      <UseLastTimeToggle on={useLastWeight} onToggle={onUseLastWeight} />

      {/* Sets */}
      <div className="flex justify-center">
        <NumberField value={sets} onChange={(v) => onSets(v ?? 1)} min={1} max={10} label="Sets" />
      </div>

      {/* Reps section */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center">Reps</p>
        <RepsModeToggle mode={repsMode} onMode={onRepsMode} />
        {repsMode === 'uniform' ? (
          <div className="flex justify-center">
            <NumberField value={reps} onChange={(v) => onReps(v ?? 1)} min={1} max={100} label="Reps per set" />
          </div>
        ) : repsMode === 'ramp' ? (
          <RampInputs start={reps} step={repsStep} sets={sets} onStart={onReps} onStep={onRepsStep} />
        ) : (
          <PerSetRepsInputs repsPerSet={repsPerSet} onChange={onRepsPerSet} />
        )}
      </div>

      {/* Weight — a starting weight, not a fixed target. When "use last time" is on,
          no target weight is sent and the live session prefills from history. */}
      {useLastWeight ? (
        <p className="text-center text-xs text-gray-500">
          Weights will prefill from your last session for this exercise.
        </p>
      ) : (
        <div className="flex justify-center">
          <NumberField
            value={weight}
            onChange={onWeight}
            min={0}
            decimal
            allowEmpty
            placeholder="optional"
            label="Starting weight"
            suffix={weightUnit}
          />
        </div>
      )}
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
                  ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
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
                    ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
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
  mode, sets, reps, repsMode, repsStep, repsPerSet, duration,
  onMode, onSets, onReps, onRepsMode, onRepsStep, onRepsPerSet, onDuration,
}: {
  mode: 'reps' | 'time'; sets: number; reps: number; duration: number
  repsMode:    RepsMode
  repsStep:    number
  repsPerSet:  number[]
  onMode:      (v: 'reps' | 'time') => void
  onSets:      (v: number) => void
  onReps:      (v: number) => void
  onRepsMode:  (v: RepsMode) => void
  onRepsStep:  (v: number) => void
  onRepsPerSet:(v: number[]) => void
  onDuration:  (v: number) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {/* By reps / by time toggle */}
      <div className="flex gap-2">
        {(['reps', 'time'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onMode(m)}
            className={cn(
              'flex-1 py-2 rounded-xl text-xs font-medium border transition-all',
              mode === m
                ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
                : 'border-surface-border text-gray-500 hover:text-gray-300',
            )}
          >
            {m === 'reps' ? 'By Reps' : 'By Time'}
          </button>
        ))}
      </div>

      {/* Sets */}
      <div className="flex justify-center">
        <NumberField value={sets} onChange={(v) => onSets(v ?? 1)} min={1} max={10} label="Sets" />
      </div>

      {mode === 'reps' ? (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 text-center">Reps</p>
          <RepsModeToggle mode={repsMode} onMode={onRepsMode} />
          {repsMode === 'uniform' ? (
            <div className="flex justify-center">
              <NumberField value={reps} onChange={(v) => onReps(v ?? 1)} min={1} max={100} label="Reps per set" />
            </div>
          ) : repsMode === 'ramp' ? (
            <RampInputs start={reps} step={repsStep} sets={sets} onStart={onReps} onStep={onRepsStep} />
          ) : (
            <PerSetRepsInputs repsPerSet={repsPerSet} onChange={onRepsPerSet} />
          )}
        </div>
      ) : (
        <div className="flex justify-center">
          <DragStepper value={duration} onChange={onDuration} min={5} max={300} label="Seconds per set" />
        </div>
      )}
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
  sessionId:   string
  workoutType: string
  onClose:     () => void
}

export function AddExerciseSheet({
  open, sessionId, workoutType, onClose,
}: AddExerciseSheetProps): React.JSX.Element {
  const trainer = useAuthStore((s) => s.trainer)
  const weightUnit = trainer?.weightUnitPreference ?? 'lbs'

  const [search,        setSearch]        = useState('')
  const [selected,      setSelected]      = useState<ExerciseSummaryResponse | null>(null)
  const [isConfirming,  setIsConfirming]  = useState(false)
  const [expandedId,    setExpandedId]    = useState<string | null>(null)

  // Resistance
  const [targetSets,    setTargetSets]    = useState(3)
  const [targetReps,    setTargetReps]    = useState(10)
  const [targetWeight,  setTargetWeight]  = useState<number | null>(null)
  const [repsMode,      setRepsMode]      = useState<RepsMode>('uniform')
  const [repsStep,      setRepsStep]      = useState(-2)
  const [repsPerSet,    setRepsPerSet]    = useState<number[]>([10, 10, 10])
  const [useLastWeight, setUseLastWeight] = useState(false)

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
  const [caliRepsMode,  setCaliRepsMode]  = useState<RepsMode>('uniform')
  const [caliRepsStep,  setCaliRepsStep]  = useState(-2)
  const [caliRepsPerSet, setCaliRepsPerSet] = useState<number[]>([15, 15, 15])

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
    setSearch(''); setSelected(null); setIsConfirming(false); setShowAllTypes(false); setExpandedId(null)
    onClose()
  }

  // Sync repsPerSet length when sets count changes
  const handleTargetSetsChange = (n: number): void => {
    setTargetSets(n)
    setRepsPerSet((prev) => {
      if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(prev[prev.length - 1] ?? targetReps)]
      return prev.slice(0, n)
    })
  }

  const handleRepsMode = (mode: RepsMode): void => {
    if (mode === 'per-set') {
      // Seed the per-set inputs from the current mode so switching is non-destructive.
      setRepsPerSet(repsMode === 'ramp'
        ? rampSequence(targetReps, repsStep, targetSets)
        : Array(targetSets).fill(targetReps))
    } else if (repsMode === 'per-set') {
      setTargetReps(repsPerSet[0] ?? targetReps)
    }
    setRepsMode(mode)
  }

  const handleCaliSetsChange = (n: number): void => {
    setCaliSets(n)
    setCaliRepsPerSet((prev) => {
      if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(prev[prev.length - 1] ?? caliReps)]
      return prev.slice(0, n)
    })
  }

  const handleCaliRepsMode = (mode: RepsMode): void => {
    if (mode === 'per-set') {
      setCaliRepsPerSet(caliRepsMode === 'ramp'
        ? rampSequence(caliReps, caliRepsStep, caliSets)
        : Array(caliSets).fill(caliReps))
    } else if (caliRepsMode === 'per-set') {
      setCaliReps(caliRepsPerSet[0] ?? caliReps)
    }
    setCaliRepsMode(mode)
  }

  const handleSelect = (exercise: ExerciseSummaryResponse): void => {
    setSelected(exercise)
    setIsConfirming(true)
  }

  // Quick-add with default targets (swipe-to-add or "Add with defaults" button)
  const handleSwipeAdd = (exercise: ExerciseSummaryResponse): void => {
    const defaults: Omit<AddExerciseInput, 'sessionId' | 'exerciseId'> =
      workoutType === 'resistance'   ? { targetSets: 3, targetReps: 10 }
      : workoutType === 'cardio'     ? { targetSets: 4, targetDurationSeconds: 60 }
      : workoutType === 'calisthenics' ? { targetSets: 3, targetReps: 15 }
      : workoutType === 'stretching' ? { targetSets: 2, targetDurationSeconds: 30 }
      : workoutType === 'cooldown'   ? { targetDurationSeconds: 120 }
      : { targetSets: 3, targetReps: 10 }
    addExercise.mutate(
      { sessionId, exerciseId: exercise.id, ...defaults },
      { onSuccess: handleClose },
    )
  }

  // Build the AddExerciseInput based on workout type
  // Resolve reps targets for a given mode: uniform → single value; ramp/per-set → comma list.
  const repsFields = (mode: RepsMode, reps: number, step: number, perSet: number[], sets: number) => {
    if (mode === 'uniform') return { targetReps: reps }
    const seq = mode === 'ramp' ? rampSequence(reps, step, sets) : perSet
    return { targetRepsPerSet: seq.join(','), targetReps: seq[0] ?? reps }
  }

  const buildInput = (): Omit<AddExerciseInput, 'sessionId' | 'exerciseId'> => {
    switch (workoutType) {
      case 'resistance':
        return {
          targetSets,
          ...repsFields(repsMode, targetReps, repsStep, repsPerSet, targetSets),
          // "Use last time" sends no target weight → the live session prefills from history.
          ...(useLastWeight ? {} : (targetWeight != null && { targetWeight, targetWeightUnit: weightUnit })),
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
          targetSets: caliSets,
          ...(caliMode === 'reps' ? repsFields(caliRepsMode, caliReps, caliRepsStep, caliRepsPerSet, caliSets) : {}),
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
      { sessionId, exerciseId: selected.id, ...buildInput() },
      { onSuccess: handleClose },
    )
  }

  const handleQuickAdd = (): void => {
    createExercise.mutate(
      { name: search.trim(), workoutType, isDraft: true } as never,
      {
        onSuccess: (newExercise) => {
          addExercise.mutate(
            { sessionId, exerciseId: newExercise.id, ...buildInput() },
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
                    ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
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
                    ? 'bg-command-blue/10 border-command-blue/40 text-command-blue'
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
              <ExerciseAccordionRow
                key={exercise.id}
                exercise={exercise}
                expanded={expandedId === exercise.id}
                onToggle={() => setExpandedId(prev => prev === exercise.id ? null : exercise.id)}
                swipeEnabled
                onAdd={() => handleSwipeAdd(exercise)}
                disabled={isPending}
                renderActions={() => (
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSwipeAdd(exercise) }}
                      disabled={isPending}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-medium',
                        'bg-command-blue/10 text-command-blue border border-command-blue/30',
                        'hover:bg-command-blue/20 transition-colors',
                        interactions.button.base,
                        isPending && 'opacity-50 pointer-events-none',
                      )}
                    >
                      Quick add
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSelect(exercise) }}
                      disabled={isPending}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-medium',
                        'text-gray-400 border border-surface-border',
                        'hover:text-gray-200 hover:border-gray-500 transition-colors',
                        interactions.button.base,
                        isPending && 'opacity-50 pointer-events-none',
                      )}
                    >
                      Set targets →
                    </button>
                  </div>
                )}
              />
            ))}

            {showQuickAdd && (
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={isPending}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left',
                  'border border-dashed border-command-blue/40 bg-command-blue/5',
                  'hover:bg-command-blue/10 transition-all duration-100',
                  interactions.button.base,
                  interactions.button.press,
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-command-blue/20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-command-blue">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-command-blue">Create "{search.trim()}"</p>
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
              repsMode={repsMode} repsStep={repsStep} repsPerSet={repsPerSet} useLastWeight={useLastWeight}
              onSets={handleTargetSetsChange} onReps={setTargetReps}
              onRepsMode={handleRepsMode} onRepsStep={setRepsStep} onRepsPerSet={setRepsPerSet}
              onWeight={setTargetWeight} onUseLastWeight={setUseLastWeight}
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
              repsMode={caliRepsMode} repsStep={caliRepsStep} repsPerSet={caliRepsPerSet}
              onMode={setCaliMode} onSets={handleCaliSetsChange} onReps={setCaliReps}
              onRepsMode={handleCaliRepsMode} onRepsStep={setCaliRepsStep} onRepsPerSet={setCaliRepsPerSet}
              onDuration={setCaliDuration}
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
            Type a value, or use the − / + steppers
          </p>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className={cn(
              'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
              'bg-command-blue text-white',
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
