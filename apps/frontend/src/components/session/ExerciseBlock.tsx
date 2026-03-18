// ------------------------------------------------------------
// components/session/ExerciseBlock.tsx (v1.8.0 — redesign)
//
// Full-screen focused exercise view.
//
// LAYOUT:
//   Left spine — vertical timeline of sets (●=past ●=active ○=future)
//   Center     — active set is the hero (big inputs, Log button)
//   Past sets  — compact rows above active, color-coded vs target
//   Future sets — ghost rows below
//
// "Current set is the hero. Everything else recedes."
// ------------------------------------------------------------

import { useState, useEffect }    from 'react'
import { cn }                      from '@/lib/cn'
import { interactions }            from '@/lib/interactions'
import { useLogSet, useDeleteSessionExercise } from '@/lib/queries/sessions'
import { useUXEventRef }           from '@/hooks/useUXEvent'
import type { SessionExerciseResponse, SetResponse } from '@trainer-app/shared'

const DEFAULT_TARGET_SETS = 3
const DEFAULT_REP_TARGETS = [10, 8, 6]

// ── Set outcome helpers ───────────────────────────────────────────────────────

type Outcome = 'hit' | 'surpassed' | 'missed' | 'none'

function outcome(actual: number | null, target: number | null): Outcome {
  if (!actual || !target) return 'none'
  if (actual > target)  return 'surpassed'
  if (actual === target) return 'hit'
  return 'missed'
}

const OUTCOME_COLOR: Record<Outcome, string> = {
  surpassed: 'text-emerald-300',
  hit:       'text-emerald-400',
  missed:    'text-amber-400',
  none:      'text-gray-400',
}

// ── Past set row (compact) ────────────────────────────────────────────────────

function PastSetRow({ set, setNumber, targetReps, targetWeight }: {
  set: SetResponse; setNumber: number
  targetReps: number | null; targetWeight: number | null
}): React.JSX.Element {
  const repsOk  = outcome(set.reps, targetReps)
  const wtOk    = outcome(set.weight, targetWeight)
  const overall = repsOk === 'missed' || wtOk === 'missed' ? 'missed'
    : repsOk === 'surpassed' || wtOk === 'surpassed' ? 'surpassed'
    : 'hit'

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Spine dot */}
      <div className="flex flex-col items-center w-5 shrink-0">
        <div className={cn(
          'w-4 h-4 rounded-full flex items-center justify-center',
          overall === 'missed' ? 'bg-amber-500/20' : 'bg-emerald-500/20',
        )}>
          <svg viewBox="0 0 10 10" fill="none" className={cn('w-2.5 h-2.5', OUTCOME_COLOR[overall])}>
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Set number */}
      <span className="text-xs text-gray-600 font-mono w-5 shrink-0">{setNumber}</span>

      {/* Values */}
      <div className="flex items-center gap-1 font-mono text-sm">
        {set.weight != null && (
          <span className={cn(OUTCOME_COLOR[wtOk], 'font-medium')}>{set.weight}</span>
        )}
        {set.weight != null && set.reps != null && (
          <span className="text-gray-600 text-xs">×</span>
        )}
        {set.reps != null && (
          <span className={cn(OUTCOME_COLOR[repsOk], 'font-medium')}>{set.reps}</span>
        )}
        {set.durationSeconds != null && (
          <span className="text-emerald-400 font-medium">{set.durationSeconds}s</span>
        )}
      </div>

      {/* Target */}
      {(targetReps || targetWeight) && (
        <span className="text-xs text-gray-700 font-mono ml-auto">
          {targetWeight && `${targetWeight}×`}{targetReps}
        </span>
      )}
    </div>
  )
}

// ── Active set (hero) ─────────────────────────────────────────────────────────

function ActiveSetHero({ setNumber, targetReps, targetWeight, weightUnit, lastSet, onLog, isLogging }: {
  setNumber: number; targetReps: number | null; targetWeight: number | null
  weightUnit: string; lastSet: SetResponse | null
  onLog: (reps: number, weight: number | null) => void; isLogging: boolean
}): React.JSX.Element {
  const [reps,   setReps]   = useState(String(targetReps ?? lastSet?.reps ?? ''))
  const [weight, setWeight] = useState(String(targetWeight ?? lastSet?.weight ?? ''))
  const [logRef, fireLog]   = useUXEventRef<HTMLButtonElement>()

  useEffect(() => {
    setReps(String(targetReps ?? lastSet?.reps ?? ''))
    setWeight(String(targetWeight ?? lastSet?.weight ?? ''))
  }, [setNumber, targetReps, targetWeight, lastSet?.reps, lastSet?.weight])

  const handleLog = (): void => {
    const r = parseInt(reps, 10)
    const w = weight.trim() ? parseFloat(weight) : null
    if (isNaN(r) || r <= 0) return
    fireLog('set_logged', { entity: 'set' })
    onLog(r, w)
  }

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Spine dot — pulsing active indicator */}
      <div className="flex flex-col items-center w-5 shrink-0 pt-1">
        <div className="w-4 h-4 rounded-full bg-brand-highlight/20 border-2 border-brand-highlight flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-highlight animate-pulse" />
        </div>
      </div>

      {/* Hero content */}
      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-widest text-brand-highlight/70 mb-3">
          Set {setNumber}
        </p>

        {/* Large inputs */}
        <div className="flex gap-3 items-center mb-3">
          <div className="flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Weight ({weightUnit})</p>
            <input
              type="number" inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={targetWeight ? String(targetWeight) : '—'}
              className={cn(
                'w-full text-center text-3xl font-mono font-bold py-3 rounded-xl',
                'bg-brand-primary border-2 border-surface-border text-white placeholder-gray-700',
                'focus:outline-none focus:border-brand-highlight transition-colors',
              )}
            />
          </div>
          <span className="text-gray-600 font-display text-2xl pb-0.5">×</span>
          <div className="flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Reps</p>
            <input
              type="number" inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLog() }}
              placeholder={targetReps ? String(targetReps) : '—'}
              className={cn(
                'w-full text-center text-3xl font-mono font-bold py-3 rounded-xl',
                'bg-brand-primary border-2 border-surface-border text-white placeholder-gray-700',
                'focus:outline-none focus:border-brand-highlight transition-colors',
              )}
            />
          </div>
        </div>

        {/* Last time context */}
        {lastSet && (
          <p className="text-xs text-gray-600 text-center mb-3">
            Last time: {lastSet.weight != null ? `${lastSet.weight} × ` : ''}{lastSet.reps} reps
            {lastSet.rpe != null && ` · RPE ${lastSet.rpe}`}
          </p>
        )}

        {/* Log button */}
        <button
          ref={logRef}
          type="button"
          onClick={handleLog}
          disabled={isLogging || !reps}
          className={cn(
            'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
            'bg-brand-highlight text-white',
            interactions.button.base,
            interactions.button.press,
            (isLogging || !reps) && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isLogging ? '…' : '+ Log Set'}
        </button>
      </div>
    </div>
  )
}

// ── Future set (ghost) ────────────────────────────────────────────────────────

function FutureSetRow({ setNumber, targetReps, targetWeight }: {
  setNumber: number; targetReps: number | null; targetWeight: number | null
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2 opacity-30">
      <div className="w-5 shrink-0 flex justify-center">
        <div className="w-3 h-3 rounded-full border border-surface-border" />
      </div>
      <span className="text-xs text-gray-700 font-mono w-5">{setNumber}</span>
      <div className="flex gap-1">
        {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-gray-700" />)}
      </div>
      {(targetReps || targetWeight) && (
        <span className="text-xs text-gray-700 font-mono ml-auto">
          {targetWeight && `${targetWeight}×`}{targetReps}
        </span>
      )}
    </div>
  )
}

// ── Exercise block ────────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  sessionExercise: SessionExerciseResponse
  sessionId:       string
  workoutId:       string
  weightUnit:      string
  onSetLogged:     (restSeconds?: number) => void
}

export function ExerciseBlock({
  sessionExercise, sessionId, workoutId, weightUnit, onSetLogged,
}: ExerciseBlockProps): React.JSX.Element {
  const logSet        = useLogSet()
  const deleteExercise = useDeleteSessionExercise()

  const loggedSets   = sessionExercise.sets
  const loggedCount  = loggedSets.length
  const targetSets   = sessionExercise.targetSets ?? DEFAULT_TARGET_SETS
  const futureSets   = Math.max(0, targetSets - loggedCount - 1)
  const exerciseName = sessionExercise.exercise?.name ?? 'Unknown Exercise'

  const handleLog = (reps: number, weight: number | null): void => {
    logSet.mutate(
      {
        sessionExerciseId: sessionExercise.id,
        sessionId,
        setNumber: loggedCount + 1,
        reps,
        weight:    weight ?? undefined,
        weightUnit,
      },
      { onSuccess: () => onSetLogged(90) },
    )
  }

  const handleDelete = (): void => {
    deleteExercise.mutate({ sessionExerciseId: sessionExercise.id, workoutId, sessionId })
  }

  const isDone = loggedCount >= targetSets

  return (
    <div className="relative">
      {/* Exercise header */}
      <div className="flex items-start justify-between mb-2 px-1">
        <div>
          <h3 className="font-display text-xl uppercase tracking-wide text-white leading-tight">
            {exerciseName}
          </h3>
          {sessionExercise.notes && (
            <p className="text-xs text-gray-600 mt-0.5">{sessionExercise.notes}</p>
          )}
        </div>

        {/* Delete exercise */}
        <button
          type="button"
          onClick={handleDelete}
          aria-label="Remove exercise"
          className="text-gray-600 hover:text-red-400 transition-colors p-1 ml-2 shrink-0"
        >
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Vertical spine + set rows */}
      <div className="relative pl-0">
        {/* Spine line */}
        <div
          className="absolute left-2.5 top-0 bottom-0 w-px bg-surface-border"
          aria-hidden
        />

        {/* Past sets */}
        {loggedSets.map((set, i) => (
          <PastSetRow
            key={set.id}
            setNumber={i + 1}
            set={set}
            targetReps={sessionExercise.targetReps ?? (i < DEFAULT_REP_TARGETS.length ? (DEFAULT_REP_TARGETS[i] ?? null) : null)}
            targetWeight={sessionExercise.targetWeight ?? null}
          />
        ))}

        {/* Active set */}
        {!isDone && (
          <ActiveSetHero
            setNumber={loggedCount + 1}
            targetReps={sessionExercise.targetReps ?? (loggedCount < DEFAULT_REP_TARGETS.length ? (DEFAULT_REP_TARGETS[loggedCount] ?? null) : null)}
            targetWeight={sessionExercise.targetWeight ?? null}
            weightUnit={weightUnit}
            lastSet={loggedSets[loggedSets.length - 1] ?? null}
            onLog={handleLog}
            isLogging={logSet.isPending}
          />
        )}

        {/* Future sets */}
        {!isDone && Array.from({ length: futureSets }, (_, i) => {
          const idx = loggedCount + 1 + i
          return (
            <FutureSetRow
              key={idx}
              setNumber={idx + 1}
              targetReps={sessionExercise.targetReps ?? (idx < DEFAULT_REP_TARGETS.length ? (DEFAULT_REP_TARGETS[idx] ?? null) : null)}
              targetWeight={sessionExercise.targetWeight ?? null}
            />
          )
        })}

        {/* Done */}
        {isDone && (
          <div className="flex items-center gap-2 py-2 px-1">
            <div className="w-5 flex justify-center shrink-0">
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-emerald-400">
                  <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <span className="text-sm text-emerald-400">Exercise complete</span>
          </div>
        )}
      </div>
    </div>
  )
}
