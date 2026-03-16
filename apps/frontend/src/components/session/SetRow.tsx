// ------------------------------------------------------------
// components/session/SetRow.tsx (v1.5.0)
//
// Three states:
//   past   — closed accordion: set number + check + actual vs target
//            color-coded: green = hit/surpassed, orange = missed
//   active — open accordion: large weight+reps inputs, last-time context
//   future — greyed placeholder with target values
//
// Past sets are tappable to expand for editing (inputs disabled for now,
// edit support planned for a future patch).
// ------------------------------------------------------------

import { useState, useRef, useEffect } from 'react'
import { cn }                          from '@/lib/cn'
import { interactions }                from '@/lib/interactions'
import { useUXEventRef }               from '@/hooks/useUXEvent'
import type { SetResponse }            from '@trainer-app/shared'

// ── Target vs actual comparison ───────────────────────────────────────────────

type SetOutcome = 'hit' | 'surpassed' | 'missed' | 'none'

function getOutcome(
  actual:  number | null,
  target:  number | null,
  isReps = false,
): SetOutcome {
  if (actual === null || target === null) return 'none'
  if (actual >= target) return actual > target ? 'surpassed' : 'hit'
  return 'missed'
}

const OUTCOME_CLASSES: Record<SetOutcome, string> = {
  hit:       'text-emerald-400',
  surpassed: 'text-emerald-300',
  missed:    'text-amber-400',
  none:      'text-gray-400',
}

// ── Past set (closed) ─────────────────────────────────────────────────────────

function PastSetRow({
  setNumber,
  set,
  targetReps,
  targetWeight,
}: {
  setNumber:    number
  set:          SetResponse
  targetReps:   number | null
  targetWeight: number | null
}): React.JSX.Element {
  const weightOutcome = getOutcome(set.weight, targetWeight)
  const repsOutcome   = getOutcome(set.reps, targetReps, true)

  // Overall outcome: if either missed, show missed
  const overallOutcome: SetOutcome =
    weightOutcome === 'missed' || repsOutcome === 'missed'
      ? 'missed'
      : weightOutcome === 'surpassed' || repsOutcome === 'surpassed'
      ? 'surpassed'
      : weightOutcome === 'hit' || repsOutcome === 'hit'
      ? 'hit'
      : 'none'

  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-xl',
      'border border-surface-border bg-surface',
    )}>
      {/* Set number + check */}
      <div className="flex items-center gap-2 shrink-0 w-14">
        <span className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0',
          overallOutcome === 'missed' ? 'bg-amber-500/20' : 'bg-emerald-500/20',
        )}>
          <svg viewBox="0 0 12 12" fill="none" className={cn('w-2.5 h-2.5', OUTCOME_CLASSES[overallOutcome])}>
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-xs text-gray-600 font-mono">{setNumber}</span>
      </div>

      {/* Actual values */}
      <div className="flex-1 flex items-center gap-1 font-mono text-sm">
        {set.weight != null && (
          <span className={cn(OUTCOME_CLASSES[weightOutcome], 'font-medium')}>
            {set.weight}
          </span>
        )}
        {set.weight != null && set.reps != null && (
          <span className="text-gray-600">×</span>
        )}
        {set.reps != null && (
          <span className={cn(OUTCOME_CLASSES[repsOutcome], 'font-medium')}>
            {set.reps}
          </span>
        )}
        {set.durationSeconds != null && (
          <span className="text-emerald-400 font-medium">{set.durationSeconds}s</span>
        )}
      </div>

      {/* Target */}
      {(targetReps != null || targetWeight != null) && (
        <div className="text-xs text-gray-600 font-mono shrink-0">
          {targetWeight != null && <span>{targetWeight}</span>}
          {targetWeight != null && targetReps != null && <span>×</span>}
          {targetReps != null && <span>{targetReps}</span>}
        </div>
      )}
    </div>
  )
}

// ── Active set (open) ─────────────────────────────────────────────────────────

function ActiveSetRow({
  setNumber,
  targetReps,
  targetWeight,
  weightUnit,
  lastSet,
  onLog,
  isLogging,
}: {
  setNumber:    number
  targetReps:   number | null
  targetWeight: number | null
  weightUnit:   string
  lastSet:      SetResponse | null
  onLog:        (reps: number, weight: number | null) => void
  isLogging:    boolean
}): React.JSX.Element {
  const [reps,   setReps]   = useState(String(targetReps ?? lastSet?.reps ?? ''))
  const [weight, setWeight] = useState(
    String(targetWeight ?? lastSet?.weight ?? '')
  )

  const [logRef, fireOnLog] = useUXEventRef<HTMLButtonElement>()
  const repsInputRef = useRef<HTMLInputElement>(null)

  // Focus reps input when this set becomes active
  useEffect(() => {
    repsInputRef.current?.focus()
  }, [])

  const handleLog = (): void => {
    const repsNum   = parseInt(reps, 10)
    const weightNum = weight.trim() ? parseFloat(weight) : null
    if (isNaN(repsNum) || repsNum <= 0) return
    fireOnLog('set_logged', { entity: 'set' })
    onLog(repsNum, weightNum)
  }

  return (
    <div className={cn(
      'rounded-2xl border-2 border-brand-highlight/40 bg-brand-highlight/5 p-4',
      'animate-slide-up',
    )}>
      {/* Set label */}
      <p className="text-xs uppercase tracking-widest text-brand-highlight/70 mb-4">
        Set {setNumber}
      </p>

      {/* Inputs — large for easy mobile tapping */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
            Weight ({weightUnit})
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder={targetWeight ? String(targetWeight) : '—'}
            className={cn(
              'w-full text-center text-3xl font-mono font-bold',
              'bg-brand-primary border-2 border-surface-border rounded-xl py-3',
              'text-white placeholder-gray-700',
              'focus:outline-none focus:border-brand-highlight',
              'transition-colors duration-150',
            )}
          />
        </div>

        <div className="flex items-end pb-3 text-gray-600 font-display text-2xl">×</div>

        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">
            Reps
          </label>
          <input
            ref={repsInputRef}
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLog() }}
            placeholder={targetReps ? String(targetReps) : '—'}
            className={cn(
              'w-full text-center text-3xl font-mono font-bold',
              'bg-brand-primary border-2 border-surface-border rounded-xl py-3',
              'text-white placeholder-gray-700',
              'focus:outline-none focus:border-brand-highlight',
              'transition-colors duration-150',
            )}
          />
        </div>
      </div>

      {/* Last time context */}
      {lastSet && (
        <p className="text-xs text-gray-600 text-center mb-4">
          Last time: {lastSet.weight != null ? `${lastSet.weight}×` : ''}{lastSet.reps} reps
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
          'w-full py-3.5 rounded-xl font-display text-lg uppercase tracking-wide',
          'bg-brand-highlight text-white',
          'transition-all duration-150',
          interactions.button.base,
          interactions.button.press,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-highlight',
          (isLogging || !reps) && 'opacity-50 cursor-not-allowed',
        )}
      >
        {isLogging ? '…' : '+ Log Set'}
      </button>
    </div>
  )
}

// ── Future set (placeholder) ──────────────────────────────────────────────────

function FutureSetRow({
  setNumber,
  targetReps,
  targetWeight,
}: {
  setNumber:    number
  targetReps:   number | null
  targetWeight: number | null
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2 opacity-30">
      <div className="flex items-center gap-2 shrink-0 w-14">
        <div className="w-5 h-5 rounded-full border border-surface-border shrink-0" />
        <span className="text-xs text-gray-700 font-mono">{setNumber}</span>
      </div>
      <div className="flex gap-1 text-xs text-gray-700 font-mono">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-700" />
        ))}
      </div>
      {(targetReps != null || targetWeight != null) && (
        <div className="text-xs text-gray-700 font-mono ml-auto">
          {targetWeight != null && <span>{targetWeight}×</span>}
          {targetReps != null && <span>{targetReps}</span>}
        </div>
      )}
    </div>
  )
}

// ── Exports ───────────────────────────────────────────────────────────────────

export { PastSetRow, ActiveSetRow, FutureSetRow, getOutcome }
