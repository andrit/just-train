// ------------------------------------------------------------
// components/session/ExerciseBlock.tsx (v1.5.0)
//
// One exercise within a workout block.
// Shows all sets as accordion rows: past (closed), active (open), future (dots).
// Handles set logging and rest timer start.
//
// Default targets for blank sessions: 3 sets, 10/8/6 reps respectively.
// Template sessions use targetReps/targetWeight from sessionExercise.
// ------------------------------------------------------------

import { cn }                   from '@/lib/cn'
import { PastSetRow, ActiveSetRow, FutureSetRow } from './SetRow'
import { useLogSet }            from '@/lib/queries/sessions'
import type { SessionExerciseResponse, SetResponse } from '@trainer-app/shared'

// ── Default targets ───────────────────────────────────────────────────────────

const DEFAULT_TARGET_SETS = 3
const DEFAULT_REP_TARGETS = [10, 8, 6] // per set index, blank sessions

// ── Component ─────────────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  sessionExercise: SessionExerciseResponse
  sessionId:       string
  weightUnit:      string
  onSetLogged:     (restSeconds?: number) => void
  /** Most recent set from a previous session for this exercise — for "last time" context */
  lastSessionSet?: SetResponse | null
}

export function ExerciseBlock({
  sessionExercise,
  sessionId,
  weightUnit,
  onSetLogged,
  lastSessionSet,
}: ExerciseBlockProps): React.JSX.Element {
  const logSet = useLogSet()

  const loggedSets  = sessionExercise.sets
  const loggedCount = loggedSets.length

  // Target sets — from template or default
  const targetSets = sessionExercise.targetSets ?? DEFAULT_TARGET_SETS

  // Active set index = next unlogged
  const activeSetIndex = loggedCount // 0-based

  // Future sets count
  const futureSetsCount = Math.max(0, targetSets - loggedCount - 1)

  const handleLog = (reps: number, weight: number | null): void => {
    logSet.mutate(
      {
        sessionExerciseId: sessionExercise.id,
        sessionId,
        setNumber:         loggedCount + 1,
        reps,
        weight:            weight ?? undefined,
        weightUnit,
      },
      {
        onSuccess: () => {
          // Trigger rest timer — default 90s, or from exercise notes
          onSetLogged(90)
        },
      },
    )
  }

  const exerciseName = sessionExercise.exercise?.name ?? 'Unknown Exercise'

  return (
    <div className="space-y-2">
      {/* Exercise header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="font-display text-xl uppercase tracking-wide text-white">
          {exerciseName}
        </h3>
        {sessionExercise.targetSets && (
          <span className="text-xs text-gray-600">
            {loggedCount}/{sessionExercise.targetSets} sets
          </span>
        )}
      </div>

      {sessionExercise.notes && (
        <p className="text-xs text-gray-600 px-1">{sessionExercise.notes}</p>
      )}

      {/* Set rows */}
      <div className="space-y-2">
        {/* Past sets */}
        {loggedSets.map((set, i) => (
          <PastSetRow
            key={set.id}
            setNumber={i + 1}
            set={set}
            targetReps={
              sessionExercise.targetReps ??
              (i < DEFAULT_REP_TARGETS.length ? (DEFAULT_REP_TARGETS[i] ?? null) : null)
            }
            targetWeight={sessionExercise.targetWeight ?? null}
          />
        ))}

        {/* Active set */}
        {activeSetIndex < targetSets && (
          <ActiveSetRow
            key={`active-${activeSetIndex}`}
            setNumber={activeSetIndex + 1}
            targetReps={
              sessionExercise.targetReps ??
              (activeSetIndex < DEFAULT_REP_TARGETS.length
                ? (DEFAULT_REP_TARGETS[activeSetIndex] ?? null)
                : null)
            }
            targetWeight={sessionExercise.targetWeight ?? null}
            weightUnit={weightUnit}
            lastSet={lastSessionSet ?? loggedSets[loggedSets.length - 1] ?? null}
            onLog={handleLog}
            isLogging={logSet.isPending}
          />
        )}

        {/* Future sets */}
        {Array.from({ length: futureSetsCount }, (_, i) => {
          const futureIndex = loggedCount + 1 + i
          return (
            <FutureSetRow
              key={`future-${futureIndex}`}
              setNumber={futureIndex + 1}
              targetReps={
                sessionExercise.targetReps ??
                (futureIndex < DEFAULT_REP_TARGETS.length
                  ? (DEFAULT_REP_TARGETS[futureIndex] ?? null)
                  : null)
              }
              targetWeight={sessionExercise.targetWeight ?? null}
            />
          )
        })}

        {/* All sets done */}
        {loggedCount >= targetSets && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-emerald-400 shrink-0">
              <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm text-emerald-400">Exercise complete</span>
          </div>
        )}
      </div>
    </div>
  )
}
