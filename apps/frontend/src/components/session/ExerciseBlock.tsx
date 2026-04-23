// ------------------------------------------------------------
// components/session/ExerciseBlock.tsx (v2.2.0)
//
// Full-screen focused exercise view.
//
// LAYOUT:
//   Left spine — vertical timeline of sets (●=past ●=active ○=future)
//   Center     — active set is the hero (big inputs, Log button)
//
// SET LOGGING INPUTS — by workout type:
//   resistance   → Weight × Reps
//   cardio       → Distance OR Time OR Intensity (auto-detected from targets)
//   calisthenics → Reps OR Time (auto-detected from targets)
//   stretching   → Hold time (seconds)
//   cooldown     → Duration (seconds)
// ------------------------------------------------------------

import { useState, useEffect }    from 'react'
import { cn }                      from '@/lib/cn'
import { interactions }            from '@/lib/interactions'
import { useLogSet, useDeleteSessionExercise } from '@/lib/queries/sessions'
import { useExerciseHistory }      from '@/lib/queries/clients'
import { useSessionExerciseMedia, useUploadSessionExerciseMedia } from '@/lib/queries/session-exercise-media'
import { useUXEventRef }           from '@/hooks/useUXEvent'
import { InlineCameraSheet }       from '@/components/session/InlineCameraSheet'
import { FormCheckBadge }          from '@/components/session/FormCheckBadge'
import type { SessionExerciseResponse, SetResponse } from '@trainer-app/shared'

const DEFAULT_TARGET_SETS = 3

// ── Outcome helpers ───────────────────────────────────────────────────────────

type Outcome = 'hit' | 'surpassed' | 'missed' | 'none'

function outcome(actual: number | null | undefined, target: number | null | undefined): Outcome {
  if (actual == null || !target) return 'none'
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

// ── Input field ───────────────────────────────────────────────────────────────

function BigInput({ label, value, onChange, placeholder, mode = 'decimal', onEnter }: {
  label: string; value: string
  onChange: (v: string) => void
  placeholder?: string
  mode?: 'decimal' | 'numeric'
  onEnter?: () => void
}): React.JSX.Element {
  return (
    <div className="flex-1">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <input
        type="number"
        inputMode={mode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter() }}
        placeholder={placeholder ?? '—'}
        className={cn(
          'w-full text-center text-3xl font-mono font-bold py-3 rounded-xl',
          'bg-brand-primary border-2 border-surface-border text-white placeholder-gray-700',
          'focus:outline-none focus:border-brand-highlight transition-colors',
        )}
      />
    </div>
  )
}

// ── Detect which cardio mode to show based on targets ─────────────────────────

type CardioMode = 'distance' | 'time' | 'intensity' | 'reps'

function detectCardioMode(se: SessionExerciseResponse): CardioMode {
  if (se.targetDistance   != null) return 'distance'
  if (se.targetIntensity  != null) return 'intensity'
  if (se.targetReps       != null) return 'reps'
  return 'time'  // default
}

// ── Intensity selector ────────────────────────────────────────────────────────

const INTENSITY_LEVELS = ['low', 'moderate', 'high', 'max'] as const
type IntensityLevel = typeof INTENSITY_LEVELS[number]

function IntensityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider text-center">Intensity</p>
      <div className="flex gap-2">
        {INTENSITY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              'flex-1 py-3 rounded-xl text-sm font-medium capitalize border transition-all',
              value === level
                ? 'bg-brand-highlight/10 border-brand-highlight/40 text-brand-highlight'
                : 'border-surface-border text-gray-500 hover:text-gray-300',
            )}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Active set hero — workout-type-aware ──────────────────────────────────────

function ActiveSetHero({ setNumber, sessionExercise, workoutType, weightUnit, lastSet, onLog, isLogging }: {
  setNumber:       number
  sessionExercise: SessionExerciseResponse
  workoutType:     string
  weightUnit:      string
  lastSet:         SetResponse | null
  onLog:           (data: LogData) => void
  isLogging:       boolean
}): React.JSX.Element {
  const [logRef, fireLog] = useUXEventRef<HTMLButtonElement>()

  // ── Resistance state ──────────────────────────────────────────────────────
  const [weight, setWeight] = useState(String(sessionExercise.targetWeight ?? lastSet?.weight ?? ''))
  const [reps,   setReps]   = useState(String(sessionExercise.targetReps   ?? lastSet?.reps   ?? ''))

  // ── Cardio state ──────────────────────────────────────────────────────────
  const cardioMode = detectCardioMode(sessionExercise)
  const [distance,  setDistance]  = useState(String(sessionExercise.targetDistance ?? ''))
  const [duration,  setDuration]  = useState(String(sessionExercise.targetDurationSeconds ?? ''))
  const [intensity, setIntensity] = useState<string>(sessionExercise.targetIntensity ?? 'moderate')
  const [cardioReps,setCardioReps] = useState(String(sessionExercise.targetReps ?? ''))

  // ── Calisthenics state ────────────────────────────────────────────────────
  const caliIsTime = sessionExercise.targetDurationSeconds != null && sessionExercise.targetReps == null
  const [caliReps, setCaliReps] = useState(String(sessionExercise.targetReps ?? lastSet?.reps ?? ''))
  const [caliTime, setCaliTime] = useState(String(sessionExercise.targetDurationSeconds ?? lastSet?.durationSeconds ?? ''))

  // Reset pre-fill when set number changes
  useEffect(() => {
    setWeight(String(sessionExercise.targetWeight ?? lastSet?.weight ?? ''))
    setReps(String(sessionExercise.targetReps ?? lastSet?.reps ?? ''))
    setCaliReps(String(sessionExercise.targetReps ?? lastSet?.reps ?? ''))
    setDuration(String(sessionExercise.targetDurationSeconds ?? lastSet?.durationSeconds ?? ''))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setNumber])

  const canLog = (): boolean => {
    switch (workoutType) {
      case 'resistance':   return reps.trim().length > 0
      case 'cardio':
        if (cardioMode === 'distance')  return distance.trim().length > 0
        if (cardioMode === 'time')      return duration.trim().length > 0
        if (cardioMode === 'reps')      return cardioReps.trim().length > 0
        return true // intensity always loggable
      case 'calisthenics': return caliIsTime ? caliTime.trim().length > 0 : caliReps.trim().length > 0
      case 'stretching':   return duration.trim().length > 0
      case 'cooldown':     return duration.trim().length > 0
      default:             return reps.trim().length > 0
    }
  }

  const handleLog = (): void => {
    if (!canLog()) return
    fireLog('set_logged', { entity: 'set' })

    switch (workoutType) {
      case 'resistance':
        onLog({
          reps:       parseInt(reps, 10) || undefined,
          weight:     weight.trim() ? parseFloat(weight) : undefined,
          weightUnit,
        })
        break
      case 'cardio':
        onLog({
          ...(cardioMode === 'distance'  && { distance:        parseFloat(distance) }),
          ...(cardioMode === 'time'      && { durationSeconds: parseInt(duration, 10) }),
          ...(cardioMode === 'intensity' && { intensity:       intensity as IntensityLevel }),
          ...(cardioMode === 'reps'      && { reps:            parseInt(cardioReps, 10) }),
        })
        break
      case 'calisthenics':
        onLog(caliIsTime
          ? { durationSeconds: parseInt(caliTime, 10) }
          : { reps: parseInt(caliReps, 10) }
        )
        break
      case 'stretching':
        onLog({ durationSeconds: parseInt(duration, 10) })
        break
      case 'cooldown':
        onLog({ durationSeconds: parseInt(duration, 10) })
        break
      default:
        onLog({ reps: parseInt(reps, 10) || undefined })
    }
  }

  const lastSetSummary = (): string | null => {
    if (!lastSet) return null
    const parts: string[] = []
    if (lastSet.weight   != null) parts.push(`${lastSet.weight}${weightUnit}`)
    if (lastSet.reps     != null) parts.push(`${lastSet.reps} reps`)
    if (lastSet.durationSeconds != null) parts.push(`${lastSet.durationSeconds}s`)
    if (lastSet.distance != null) parts.push(`${lastSet.distance}m`)
    if (lastSet.intensity!= null) parts.push(lastSet.intensity)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  return (
    <div className="flex items-start gap-3 py-3">
      {/* Spine dot */}
      <div className="flex flex-col items-center w-5 shrink-0 pt-1">
        <div className="w-4 h-4 rounded-full bg-brand-highlight/20 border-2 border-brand-highlight flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-highlight animate-pulse" />
        </div>
      </div>

      <div className="flex-1">
        <p className="text-[10px] uppercase tracking-widest text-brand-highlight/70 mb-3">
          Set {setNumber}
        </p>

        {/* ── Resistance: Weight × Reps ──────────────────────────── */}
        {workoutType === 'resistance' && (
          <div className="flex gap-3 items-center mb-3">
            <BigInput
              label={`Weight (${weightUnit})`}
              value={weight}
              onChange={setWeight}
              placeholder={sessionExercise.targetWeight ? String(sessionExercise.targetWeight) : 'optional'}
            />
            <span className="text-gray-600 font-display text-2xl pb-0.5">×</span>
            <BigInput
              label="Reps"
              value={reps}
              onChange={setReps}
              mode="numeric"
              placeholder={sessionExercise.targetReps ? String(sessionExercise.targetReps) : '—'}
              onEnter={handleLog}
            />
          </div>
        )}

        {/* ── Cardio: context-specific metric ───────────────────── */}
        {workoutType === 'cardio' && (
          <div className="mb-3 space-y-3">
            {cardioMode === 'distance' && (
              <BigInput label="Distance (m)" value={distance} onChange={setDistance} placeholder={sessionExercise.targetDistance ? String(sessionExercise.targetDistance) : '—'} onEnter={handleLog} />
            )}
            {cardioMode === 'time' && (
              <BigInput label="Duration (seconds)" value={duration} onChange={setDuration} mode="numeric" placeholder={sessionExercise.targetDurationSeconds ? String(sessionExercise.targetDurationSeconds) : '—'} onEnter={handleLog} />
            )}
            {cardioMode === 'intensity' && (
              <IntensityPicker value={intensity} onChange={setIntensity} />
            )}
            {cardioMode === 'reps' && (
              <BigInput label="Reps" value={cardioReps} onChange={setCardioReps} mode="numeric" placeholder={sessionExercise.targetReps ? String(sessionExercise.targetReps) : '—'} onEnter={handleLog} />
            )}
          </div>
        )}

        {/* ── Calisthenics: Reps OR Time ────────────────────────── */}
        {workoutType === 'calisthenics' && (
          <div className="mb-3">
            {caliIsTime ? (
              <BigInput label="Hold (seconds)" value={caliTime} onChange={setCaliTime} mode="numeric" onEnter={handleLog} />
            ) : (
              <BigInput label="Reps" value={caliReps} onChange={setCaliReps} mode="numeric" onEnter={handleLog} />
            )}
          </div>
        )}

        {/* ── Stretching / Cooldown: Duration ──────────────────── */}
        {(workoutType === 'stretching' || workoutType === 'cooldown') && (
          <div className="mb-3">
            <BigInput
              label="Duration (seconds)"
              value={duration}
              onChange={setDuration}
              mode="numeric"
              placeholder={sessionExercise.targetDurationSeconds ? String(sessionExercise.targetDurationSeconds) : '—'}
              onEnter={handleLog}
            />
          </div>
        )}

        {/* ── Fallback ───────────────────────────────────────────── */}
        {!['resistance','cardio','calisthenics','stretching','cooldown'].includes(workoutType) && (
          <div className="flex gap-3 items-center mb-3">
            <BigInput label="Reps" value={reps} onChange={setReps} mode="numeric" onEnter={handleLog} />
          </div>
        )}

        {/* Last time context */}
        {lastSetSummary() && (
          <p className="text-xs text-gray-600 text-center mb-3">
            Last: {lastSetSummary()}
          </p>
        )}

        {/* Log button */}
        <button
          ref={logRef}
          type="button"
          onClick={handleLog}
          disabled={isLogging || !canLog()}
          className={cn(
            'w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide',
            'bg-brand-highlight text-white',
            interactions.button.base,
            interactions.button.press,
            (isLogging || !canLog()) && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isLogging ? '…' : '+ Log Set'}
        </button>
      </div>
    </div>
  )
}

// ── Past set row ──────────────────────────────────────────────────────────────

function PastSetRow({ set, setNumber, sessionExercise, workoutType }: {
  set:             SetResponse
  setNumber:       number
  sessionExercise: SessionExerciseResponse
  workoutType:     string
}): React.JSX.Element {
  const repsOk   = outcome(set.reps,     sessionExercise.targetReps)
  const weightOk = outcome(set.weight,   sessionExercise.targetWeight)
  const timeOk   = outcome(set.durationSeconds, sessionExercise.targetDurationSeconds)
  const distOk   = outcome(set.distance, sessionExercise.targetDistance)

  const overall: Outcome = (() => {
    const relevant = [repsOk, weightOk, timeOk, distOk].filter(o => o !== 'none')
    if (relevant.some(o => o === 'missed'))    return 'missed'
    if (relevant.some(o => o === 'surpassed')) return 'surpassed'
    if (relevant.some(o => o === 'hit'))       return 'hit'
    return 'none'
  })()

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex flex-col items-center w-5 shrink-0">
        <div className={cn('w-4 h-4 rounded-full flex items-center justify-center', overall === 'missed' ? 'bg-amber-500/20' : 'bg-emerald-500/20')}>
          <svg viewBox="0 0 10 10" fill="none" className={cn('w-2.5 h-2.5', OUTCOME_COLOR[overall])}>
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <span className="text-xs text-gray-600 font-mono w-5 shrink-0">{setNumber}</span>

      <div className="flex items-center gap-1.5 font-mono text-sm flex-1">
        {workoutType === 'resistance' && (
          <>
            {set.weight != null && <span className={cn(OUTCOME_COLOR[weightOk], 'font-medium')}>{set.weight}</span>}
            {set.weight != null && set.reps != null && <span className="text-gray-600 text-xs">×</span>}
            {set.reps   != null && <span className={cn(OUTCOME_COLOR[repsOk], 'font-medium')}>{set.reps}</span>}
          </>
        )}
        {workoutType === 'cardio' && (
          <>
            {set.distance        != null && <span className={cn(OUTCOME_COLOR[distOk],  'font-medium')}>{set.distance}m</span>}
            {set.durationSeconds != null && <span className={cn(OUTCOME_COLOR[timeOk],  'font-medium')}>{set.durationSeconds}s</span>}
            {set.intensity       != null && <span className="text-gray-300 font-medium capitalize">{set.intensity}</span>}
            {set.reps            != null && <span className={cn(OUTCOME_COLOR[repsOk],  'font-medium')}>{set.reps} reps</span>}
          </>
        )}
        {(workoutType === 'calisthenics') && (
          <>
            {set.reps            != null && <span className={cn(OUTCOME_COLOR[repsOk], 'font-medium')}>{set.reps} reps</span>}
            {set.durationSeconds != null && <span className={cn(OUTCOME_COLOR[timeOk], 'font-medium')}>{set.durationSeconds}s</span>}
          </>
        )}
        {(workoutType === 'stretching' || workoutType === 'cooldown') && (
          set.durationSeconds != null && <span className={cn(OUTCOME_COLOR[timeOk], 'font-medium')}>{set.durationSeconds}s</span>
        )}
      </div>

      {/* PR chip — amber pill, persists in history */}
      {(set.isPR || set.isPRVolume) && (
        <span className={cn(
          'shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full',
          'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        )}>
          {set.isPR && set.isPRVolume ? 'PR ×2' : 'PR'}
        </span>
      )}
    </div>
  )
}

// ── Future set row ────────────────────────────────────────────────────────────

function FutureSetRow({ setNumber }: { setNumber: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 py-2 opacity-30">
      <div className="w-5 shrink-0 flex justify-center">
        <div className="w-3 h-3 rounded-full border border-surface-border" />
      </div>
      <span className="text-xs text-gray-700 font-mono w-5">{setNumber}</span>
      <div className="flex gap-1">
        {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-gray-700" />)}
      </div>
    </div>
  )
}

// ── Log data type ─────────────────────────────────────────────────────────────

interface LogData {
  reps?:            number
  weight?:          number
  weightUnit?:      string
  durationSeconds?: number
  distance?:        number
  intensity?:       string
}

// ── Exercise block ────────────────────────────────────────────────────────────

interface ExerciseBlockProps {
  sessionExercise:     SessionExerciseResponse
  sessionId:           string
  workoutId:           string
  workoutType:         string
  weightUnit:          string
  clientId:            string | null   // for exercise history auto-populate
  restDurationSeconds?: number
  onSetLogged:         (restSeconds?: number, pr?: { isPR: boolean; isPRVolume: boolean; weight?: number | null; reps?: number | null }) => void
}

export function ExerciseBlock({
  sessionExercise, sessionId, workoutId, workoutType, weightUnit, clientId, restDurationSeconds = 90, onSetLogged,
}: ExerciseBlockProps): React.JSX.Element {
  const logSet         = useLogSet()
  const deleteExercise = useDeleteSessionExercise()
  const uploadMedia    = useUploadSessionExerciseMedia()
  const { data: mediaList } = useSessionExerciseMedia(sessionExercise.id)
  const [cameraOpen, setCameraOpen] = useState(false)

  const mediaCount = mediaList?.length ?? 0

  // Fetch last session's sets for this exercise — used to pre-fill inputs
  const { data: historyData } = useExerciseHistory(
    clientId,
    sessionExercise.exerciseId,
  )
  const lastSessionSets = historyData?.lastSets ?? []

  const loggedSets  = sessionExercise.sets
  const loggedCount = loggedSets.length
  const targetSets  = sessionExercise.targetSets ?? DEFAULT_TARGET_SETS
  const futureSets  = Math.max(0, targetSets - loggedCount - 1)
  const hitTarget   = loggedCount >= targetSets

  // Allow logging beyond target — trainer can always add more sets
  const [keepGoing, setKeepGoing] = useState(false)
  const isDone = hitTarget && !keepGoing

  const handleLog = (data: LogData): void => {
    logSet.mutate(
      {
        sessionExerciseId: sessionExercise.id,
        sessionId,
        setNumber: loggedCount + 1,
        reps:             data.reps,
        weight:           data.weight,
        weightUnit:       data.weightUnit ?? weightUnit,
        durationSeconds:  data.durationSeconds,
        distance:         data.distance,
        intensity:        data.intensity,
      },
      {
        onSuccess: (newSet) => {
          // Reset keepGoing so UI returns to complete state with updated count
          if (keepGoing) setKeepGoing(false)
          onSetLogged(restDurationSeconds, {
            isPR:       newSet?.isPR       ?? false,
            isPRVolume: newSet?.isPRVolume ?? false,
            weight:     data.weight,
            reps:       data.reps,
          })
        },
      },
    )
  }

  return (
    <div className="relative">
      {/* Exercise header */}
      <div className="flex items-start justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-xl uppercase tracking-wide text-white leading-tight">
            {sessionExercise.exercise?.name ?? 'Unknown Exercise'}
          </h3>
          <FormCheckBadge count={mediaCount} />
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Camera — form check capture */}
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            aria-label="Capture form check"
            className="text-gray-600 hover:text-brand-highlight transition-colors p-1"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <rect x="1" y="4" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.2" />
              <path d="M5.5 4V3a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          {/* Delete exercise */}
          <button
            type="button"
            onClick={() => deleteExercise.mutate({ sessionExerciseId: sessionExercise.id, workoutId, sessionId })}
            aria-label="Remove exercise"
            className="text-gray-600 hover:text-red-400 transition-colors p-1"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      {sessionExercise.notes && (
        <p className="text-xs text-gray-600 mb-2 px-1">{sessionExercise.notes}</p>
      )}

      {/* Spine + sets */}
      <div className="relative pl-0">
        <div className="absolute left-2.5 top-0 bottom-0 w-px bg-surface-border" aria-hidden />

        {loggedSets.map((set, i) => (
          <PastSetRow
            key={set.id}
            setNumber={i + 1}
            set={set}
            sessionExercise={sessionExercise}
            workoutType={workoutType}
          />
        ))}

        {!isDone && (
          <ActiveSetHero
            setNumber={loggedCount + 1}
            sessionExercise={sessionExercise}
            workoutType={workoutType}
            weightUnit={weightUnit}
            lastSet={
              // In-session: use the most recently logged set (shows progression)
              loggedSets.length > 0
                ? (loggedSets[loggedSets.length - 1] ?? null)
                // No sets yet this session: use the matching set from last session
                // so inputs start pre-filled (e.g. set 1 → last session's set 1)
                : (() => {
                    const h = lastSessionSets[loggedCount]
                    if (!h) return null
                    return {
                      id:              '',
                      sessionExerciseId: sessionExercise.id,
                      setNumber:       h.setNumber,
                      reps:            h.reps,
                      weight:          h.weight,
                      weightUnit:      h.weightUnit,
                      durationSeconds: h.durationSeconds,
                      distance:        null,
                      intensity:       null,
                      isPR:            false,
                      isPRVolume:      false,
                      createdAt:       '',
                    } as SetResponse
                  })()
            }
            onLog={handleLog}
            isLogging={logSet.isPending}
          />
        )}

        {!isDone && Array.from({ length: futureSets }, (_, i) => (
          <FutureSetRow key={i} setNumber={loggedCount + 2 + i} />
        ))}

        {isDone && (
          <div className="flex items-center justify-between py-2 px-1">
            <div className="flex items-center gap-2">
              <div className="w-5 flex justify-center shrink-0">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5 text-emerald-400">
                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <span className="text-sm text-emerald-400">{loggedCount} / {targetSets} sets</span>
            </div>
            <button
              type="button"
              onClick={() => setKeepGoing(true)}
              className={cn(
                'text-xs text-gray-500 hover:text-brand-highlight px-2 py-1 rounded',
                'border border-dashed border-surface-border hover:border-brand-highlight/30',
                'transition-colors',
                interactions.button.base,
              )}
            >
              + Add set
            </button>
          </div>
        )}
      </div>

      {/* Form check camera */}
      <InlineCameraSheet
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(blob, duration) => {
          uploadMedia.mutate({
            sessionExerciseId: sessionExercise.id,
            file: blob,
            durationSeconds: duration,
          })
          setCameraOpen(false)
        }}
      />
    </div>
  )
}
