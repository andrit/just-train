// ------------------------------------------------------------
// components/exercises/ExerciseProgressSection.tsx
//
// Athlete-first per-exercise progression, shown on the exercise detail.
// Headline (est. 1RM + top-set + volume + overall weight trend), an est-1RM
// sparkline, per-rank weight rate-of-change (top-3-heaviest sets), and a
// tappable session history. Resistance only — hides itself otherwise.
// ------------------------------------------------------------

import { cn }                     from '@/lib/cn'
import { useExerciseProgress }    from '@/lib/queries/clients'
import { useAuthStore }           from '@/store/authStore'
import { Sparkline }              from '@/components/charts/Sparkline'
import { Spinner }                from '@/components/ui/Spinner'
import { formatDate, formatTotalVolume } from '@/lib/formatters'
import type { WeightTrend }       from '@trainer-app/shared'

const RANK_LABEL: Record<number, string> = { 1: 'Heaviest', 2: '2nd set', 3: '3rd set' }

// ── Rate-of-change chip ─────────────────────────────────────────────────────
function TrendChip({ trend, unit }: { trend: WeightTrend; unit: string }): React.JSX.Element {
  if (trend.points < 2) {
    return <span className="text-[11px] text-gray-600">not enough data</span>
  }
  const { direction, deltaFirstToLast, spanWeeks } = trend
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '→'
  const color =
    direction === 'up' ? 'text-emerald-400' : direction === 'down' ? 'text-amber-400' : 'text-gray-500'
  const sign = deltaFirstToLast > 0 ? '+' : ''
  const wk   = Math.max(1, Math.round(spanWeeks))
  return (
    <span className={cn('text-[11px] font-medium whitespace-nowrap', color)}>
      {arrow} {sign}{deltaFirstToLast} {unit} · {wk} wk{wk === 1 ? '' : 's'}
    </span>
  )
}

interface Props {
  clientId:       string
  exerciseId:     string
  /** Tap a history row → open that session (parent closes the sheet + navigates). */
  onOpenSession?: (sessionId: string) => void
}

export function ExerciseProgressSection({ clientId, exerciseId, onOpenSession }: Props): React.JSX.Element | null {
  const { data, isLoading } = useExerciseProgress(clientId, exerciseId)
  const trainer = useAuthStore((s) => s.trainer)
  const unit    = trainer?.weightUnitPreference ?? 'lbs'

  if (isLoading) {
    return (
      <section className="flex justify-center py-6">
        <Spinner size="md" className="text-command-blue" />
      </section>
    )
  }

  // Non-resistance (v1) — no progression view.
  if (!data || !data.supported) return null

  const heading = <h3 className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Your Progress</h3>

  if (data.sessions.length === 0) {
    return (
      <section>
        {heading}
        <p className="text-sm text-gray-600">
          No history yet — log a session with this exercise to see your progress.
        </p>
      </section>
    )
  }

  const { overall, byRank, sessions, bySetPosition } = data
  // Every session in the window logs at least a set 1, so the busiest position's
  // count IS the window size. Deriving it beats hardcoding the backend's 5 here —
  // it stays truthful when the athlete has only trained twice.
  const windowSessions = bySetPosition.length
    ? Math.max(...bySetPosition.map((s) => s.sessionCount))
    : 0
  // Sparkline reads oldest → newest; sessions come newest-first.
  const est1rmSeries = [...sessions].reverse()
    .map((s) => s.est1rm)
    .filter((e): e is number => e != null)

  return (
    <section className="space-y-4">
      {heading}

      {/* Headline card */}
      <div className="rounded-xl bg-surface border border-surface-border p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Est. 1RM</p>
            <p className="font-display text-3xl text-white leading-none mt-1">
              {overall.currentEst1rm ?? '—'}
              <span className="text-sm text-gray-500 ml-1">{unit}</span>
            </p>
          </div>
          {est1rmSeries.length > 1 && (
            <Sparkline values={est1rmSeries} className="text-command-blue shrink-0" width={110} height={38} />
          )}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-border/60 text-xs">
          <div>
            <span className="text-gray-500">Top set </span>
            <span className="font-mono text-gray-200">{overall.currentTopSetWeight ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Best vol </span>
            <span className="font-mono text-gray-200">{overall.bestVolume != null ? formatTotalVolume(overall.bestVolume) : '—'}</span>
          </div>
          <div className="ml-auto">
            <TrendChip trend={overall.highestWeightTrend} unit={unit} />
          </div>
        </div>
      </div>

      {/* Per-rank weight trends (top-3-heaviest sets) */}
      {byRank.length > 0 && (
        <div className="space-y-2">
          {byRank.map((r) => (
            <div key={r.rank} className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500 w-16 shrink-0">{RANK_LABEL[r.rank] ?? `#${r.rank}`}</span>
              <span className="font-mono text-sm text-gray-200 w-14 shrink-0 text-right">{r.latestWeight ?? '—'}</span>
              <div className="flex-1"><TrendChip trend={r.trend} unit={unit} /></div>
            </div>
          ))}
        </div>
      )}

      {/* Average per set position — "what do I typically do on my 2nd set?"
          Distinct from the per-rank block above, which ranks by weight. */}
      {bySetPosition.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
            Average per set
            <span className="ml-1 normal-case tracking-normal text-gray-600">
              · last {windowSessions} session{windowSessions === 1 ? '' : 's'}
            </span>
          </p>
          <div className="space-y-1">
            {bySetPosition.map((s) => (
              <div key={s.setNumber} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-500 w-16 shrink-0">Set {s.setNumber}</span>
                <span className="font-mono text-sm text-gray-200">
                  {s.avgWeight ?? '—'}
                  {s.avgWeight != null && <span className="text-xs text-gray-500 ml-0.5">{unit}</span>}
                  {s.avgReps != null && <span className="text-gray-400"> × {s.avgReps}</span>}
                </span>
                {/* Only flag positions thinner than the rest — a "3 of 5" on every
                    row would be noise, but a lone thin row deserves the caveat. */}
                {s.sessionCount < windowSessions && (
                  <span className="ml-auto text-[10px] text-gray-600 shrink-0">
                    {s.sessionCount} of {windowSessions}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session history */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">History</p>
        <div className="space-y-0.5">
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              type="button"
              onClick={() => onOpenSession?.(s.sessionId)}
              className={cn(
                'w-full flex items-center gap-3 py-2 px-1 rounded-lg text-left',
                'hover:bg-surface transition-colors',
              )}
            >
              <span className="text-xs text-gray-500 w-20 shrink-0">{formatDate(s.date)}</span>
              <span className="flex-1 font-mono text-xs text-gray-300">
                {s.topSet ? `${s.topSet.weight ?? '—'} × ${s.topSet.reps ?? '—'}` : '—'}
              </span>
              {s.est1rm != null && (
                <span className="text-[10px] text-gray-500 shrink-0">1RM {s.est1rm}</span>
              )}
              <span className="text-[10px] text-gray-500 shrink-0 w-16 text-right">vol {formatTotalVolume(s.volume)}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
