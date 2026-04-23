// ------------------------------------------------------------
// components/session/PostSessionWrapUp.tsx (v2.8.0)
//
// Shown after a session ends, before navigating to the summary.
// Displays: exercises completed, total sets, PRs hit, total volume.
// Lets the trainer name/rename the session before closing.
// ------------------------------------------------------------

import { useState }                           from 'react'
import { cn }                                 from '@/lib/cn'
import { interactions }                       from '@/lib/interactions'
import { Spinner }                            from '@/components/ui/Spinner'
import { useChallenges }                      from '@/lib/queries/challenges'
import type { SessionDetailResponse }         from '@trainer-app/shared'

interface PostSessionWrapUpProps {
  session:    SessionDetailResponse
  onDone:     (name?: string) => void   // called when user taps Done/Continue
  isSaving?:  boolean
}

export function PostSessionWrapUp({
  session, onDone, isSaving = false,
}: PostSessionWrapUpProps): React.JSX.Element {
  const [name, setName] = useState(session.name ?? '')

  // v2.12.0: fetch active challenges for the client to show progress
  const { data: activeChallenges } = useChallenges(session.clientId, 'active')

  // ── Compute stats ───────────────────────────────────────────────────────────
  const allSets = session.workouts.flatMap(w =>
    w.sessionExercises.flatMap(se => se.sets)
  )
  const allExercises = session.workouts.flatMap(w => w.sessionExercises)

  const totalSets    = allSets.length
  const totalVolume  = allSets.reduce((sum, s) => {
    if (s.weight == null || s.reps == null) return sum
    return sum + s.weight * s.reps
  }, 0)
  const prCount      = allSets.filter(s => s.isPR || s.isPRVolume).length
  const exercisesDone = allExercises.filter(se => se.sets.length > 0).length

  // Duration
  const durationMin = session.startTime && session.endTime
    ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
      <div className="w-full bg-brand-secondary rounded-t-3xl border-t border-surface-border p-6 space-y-6">

        {/* Header */}
        <div className="text-center">
          <p className="text-4xl mb-2" aria-hidden>🏆</p>
          <h2 className="text-xl font-display font-bold text-white">Session complete!</h2>
          {durationMin != null && (
            <p className="text-sm text-gray-500 mt-1">{durationMin} minutes</p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Exercises" value={String(exercisesDone)} />
          <StatCard label="Sets logged" value={String(totalSets)} />
          {totalVolume > 0 && (
            <StatCard
              label="Total volume"
              value={`${totalVolume >= 1000
                ? `${(totalVolume / 1000).toFixed(1)}k`
                : String(Math.round(totalVolume))
              }`}
              unit={session.workouts[0]?.sessionExercises[0]?.targetWeightUnit ?? 'lbs'}
            />
          )}
          {prCount > 0 && (
            <StatCard label="New PRs" value={String(prCount)} highlight />
          )}
        </div>

        {/* PR callouts */}
        {prCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-400 font-medium mb-1.5">Personal records</p>
            <div className="space-y-1">
              {allExercises
                .filter(se => se.sets.some(s => s.isPR || s.isPRVolume))
                .map(se => (
                  <p key={se.id} className="text-sm text-amber-300">
                    {se.exercise?.name ?? 'Exercise'} — new {se.sets.some(s => s.isPR) ? '1RM' : 'volume'} PR
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* v2.12.0: Challenge progress updates */}
        {activeChallenges && activeChallenges.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-400 font-medium mb-1.5">Challenge progress</p>
            <div className="space-y-2">
              {activeChallenges.map(c => {
                const pct = c.targetValue > 0 ? Math.min(100, Math.round((c.currentValue / c.targetValue) * 100)) : 0
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-blue-300 truncate mr-2">{c.title}</p>
                      <span className="text-xs text-blue-400 font-mono shrink-0">
                        {c.currentValue} / {c.targetValue}{c.targetUnit ? ` ${c.targetUnit}` : ''}
                      </span>
                    </div>
                    <div className="h-1.5 bg-blue-900/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Session name */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">
            Session name <span className="text-gray-700 normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Push Day, Monday Strength…"
            className="w-full bg-brand-primary border border-surface-border rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-highlight/50"
          />
        </div>

        {/* Done button */}
        <button
          type="button"
          onClick={() => onDone(name.trim() || undefined)}
          disabled={isSaving}
          className={cn(
            'w-full py-4 rounded-2xl font-semibold text-white',
            'bg-brand-highlight',
            interactions.button.base,
            interactions.button.press,
            isSaving && 'opacity-60',
          )}
        >
          {isSaving ? <Spinner size="sm" /> : 'View summary'}
        </button>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit, highlight }: {
  label:      string
  value:      string
  unit?:      string
  highlight?: boolean
}): React.JSX.Element {
  return (
    <div className={cn(
      'rounded-xl border p-3 text-center',
      highlight
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-brand-primary border-surface-border',
    )}>
      <p className={cn('text-2xl font-bold font-mono', highlight ? 'text-amber-400' : 'text-white')}>
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      <p className={cn('text-xs mt-0.5', highlight ? 'text-amber-500' : 'text-gray-500')}>{label}</p>
    </div>
  )
}
