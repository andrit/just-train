// ------------------------------------------------------------
// components/client-profile/PersonalBestsTab.tsx (v2.5.0)
//
// Shows personal bests per exercise — best 1RM estimate and
// best single-set volume. Includes ⓘ tooltips explaining
// each metric.
// ------------------------------------------------------------

import { useClientPersonalBests }       from '@/lib/queries/clients'
import { Spinner }                      from '@/components/ui/Spinner'
import { HintPopover }                  from '@/components/ui/HintPopover'

// ── Personal bests table ──────────────────────────────────────────────────────

interface PersonalBestsTabProps {
  clientId: string
}

export function PersonalBestsTab({ clientId }: PersonalBestsTabProps): React.JSX.Element {
  const { data: bests, isLoading } = useClientPersonalBests(clientId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" className="text-command-blue" />
      </div>
    )
  }

  if (!bests || bests.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-2xl mb-3" aria-hidden>🏋️</p>
        <p className="text-gray-400 font-medium">No personal bests yet</p>
        <p className="text-gray-600 text-sm mt-1">
          PRs are detected automatically when sets are logged
        </p>
      </div>
    )
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: '2-digit',
    })
  }

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-2 px-1 mb-2">
        <p className="flex-1 text-[10px] uppercase tracking-widest text-gray-600">Exercise</p>
        <div className="flex items-center gap-1 w-28 justify-end">
          <p className="text-[10px] uppercase tracking-widest text-gray-600">1RM est.</p>
          <HintPopover glyph="i" side="top" text="Estimated max single rep using the Epley formula: weight × (1 + reps ÷ 30). Swipe to dismiss." />
        </div>
        <div className="flex items-center gap-1 w-28 justify-end">
          <p className="text-[10px] uppercase tracking-widest text-gray-600">Vol. PR</p>
          <HintPopover glyph="i" side="top" text="Highest single-set volume: weight × reps. e.g. 80kg × 10 = 800. Swipe to dismiss." />
        </div>
      </div>

      {/* Exercise rows */}
      <div className="space-y-1">
        {bests.map((pr) => (
          <div
            key={pr.exerciseId}
            className="bg-brand-secondary rounded-xl border border-surface-border px-3 py-3"
          >
            {/* Exercise name */}
            <p className="text-sm font-medium text-gray-200 mb-2 truncate">
              {pr.exerciseName}
            </p>

            <div className="flex gap-2">
              {/* 1RM */}
              <div className="flex-1 bg-brand-primary rounded-lg px-2.5 py-2">
                <p className="text-[10px] text-amber-400/70 uppercase tracking-wider mb-0.5">1RM</p>
                <p className="font-mono text-base font-medium text-amber-400">
                  {pr.best1rm} kg
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                  {pr.best1rmWeight}×{pr.best1rmReps} · {formatDate(pr.best1rmDate)}
                </p>
              </div>

              {/* Volume */}
              <div className="flex-1 bg-brand-primary rounded-lg px-2.5 py-2">
                <p className="text-[10px] text-command-blue/70 uppercase tracking-wider mb-0.5">Volume</p>
                <p className="font-mono text-base font-medium text-command-blue">
                  {pr.bestVolume.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                  {pr.bestVolumeWeight}×{pr.bestVolumeReps} · {formatDate(pr.bestVolumeDate)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-[10px] text-gray-700 text-center mt-4">
        1RM estimates use the Epley formula · Volume = weight × reps
      </p>
    </div>
  )
}
