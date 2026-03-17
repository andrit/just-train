// ------------------------------------------------------------
// components/client-profile/BaselineTab.tsx (v1.6.1)
//
// Baseline measurements tab — latest snapshot vs baseline,
// historical snapshot list, take snapshot CTA.
// ------------------------------------------------------------

import { cn }                from '@/lib/cn'
import { interactions }      from '@/lib/interactions'
import { useLatestSnapshot, useClientSnapshots } from '@/lib/queries/clients'
import { Spinner }           from '@/components/ui/Spinner'

// ── Snapshot card ─────────────────────────────────────────────────────────────

function SnapshotCard({
  snapshot,
  compareSnapshot,
}: {
  snapshot:        NonNullable<ReturnType<typeof useLatestSnapshot>['data']>
  compareSnapshot: NonNullable<ReturnType<typeof useLatestSnapshot>['data']> | null
}): React.JSX.Element {
  function delta(current: number | null, baseline: number | null): string | null {
    if (current === null || baseline === null) return null
    const diff = current - baseline
    if (diff === 0) return null
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`
  }

  const rows: { label: string; value: number | null; unit: string; baseline: number | null }[] = [
    { label: 'Weight',     value: snapshot.weightLbs,     unit: 'lbs', baseline: compareSnapshot?.weightLbs     ?? null },
    { label: 'Body Fat',   value: snapshot.bodyFatPct,    unit: '%',   baseline: compareSnapshot?.bodyFatPct    ?? null },
    { label: 'Resting HR', value: snapshot.restingHeartRateBpm, unit: 'bpm', baseline: compareSnapshot?.restingHeartRateBpm ?? null },
    { label: 'Energy',     value: snapshot.energyLevel,   unit: '/10', baseline: compareSnapshot?.energyLevel   ?? null },
    { label: 'Sleep',      value: snapshot.sleepQuality,  unit: '/10', baseline: compareSnapshot?.sleepQuality  ?? null },
    { label: 'Stress',     value: snapshot.stressLevel,   unit: '/10', baseline: compareSnapshot?.stressLevel   ?? null },
    { label: 'Mobility',   value: snapshot.mobilityFeel,  unit: '/10', baseline: compareSnapshot?.mobilityFeel  ?? null },
    { label: 'Self-image', value: snapshot.selfImageScore, unit: '/10', baseline: compareSnapshot?.selfImageScore ?? null },
    { label: 'Push-ups',   value: snapshot.maxPushUps,    unit: '',    baseline: compareSnapshot?.maxPushUps    ?? null },
    {
      label: 'Mile time',
      value: snapshot.mileTimeSecs ? Math.floor(snapshot.mileTimeSecs / 60) : null,
      unit: 'min',
      baseline: compareSnapshot?.mileTimeSecs ? Math.floor(compareSnapshot.mileTimeSecs / 60) : null,
    },
  ].filter((r) => r.value !== null)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-600">No measurements recorded in this snapshot.</p>
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-3 py-2 bg-brand-accent/30 border-b border-surface-border">
        <p className="text-xs text-gray-500">
          {new Date(snapshot.capturedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {compareSnapshot && <span className="ml-2 text-gray-600">· vs. baseline</span>}
        </p>
      </div>
      <div className="divide-y divide-surface-border">
        {rows.map((row) => {
          const d = delta(row.value, row.baseline)
          return (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-gray-400">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200 font-mono">
                  {row.value}{row.unit}
                </span>
                {d && (
                  <span className={cn(
                    'text-xs font-mono',
                    d.startsWith('+') ? 'text-emerald-400' : 'text-red-400',
                  )}>
                    {d}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Baseline tab ──────────────────────────────────────────────────────────────

export function BaselineTab({ clientId }: { clientId: string }): React.JSX.Element {
  const { data: latest,    isLoading: latestLoading    } = useLatestSnapshot(clientId)
  const { data: snapshots, isLoading: snapshotsLoading } = useClientSnapshots(clientId)

  const isLoading = latestLoading || snapshotsLoading

  if (isLoading) {
    return (
      <div className="flex justify-center py-12" role="tabpanel" id="panel-baseline" aria-labelledby="tab-baseline">
        <Spinner size="md" className="text-brand-highlight" />
      </div>
    )
  }

  const firstSnapshot = snapshots && snapshots.length > 0
    ? snapshots[snapshots.length - 1]
    : null

  return (
    <div className="space-y-5" role="tabpanel" id="panel-baseline" aria-labelledby="tab-baseline">

      {/* Take Snapshot CTA */}
      <button
        type="button"
        className={cn(
          'w-full card p-4 text-left border-dashed',
          'hover:border-brand-highlight/30 hover:bg-surface',
          interactions.card.base,
          interactions.card.hover,
          interactions.card.press,
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-highlight/10 border border-brand-highlight/20 flex items-center justify-center text-brand-highlight">
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden>
              <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 7v6M7 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-sm text-white">Take a Snapshot</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {snapshots?.length === 0 ? 'Capture the initial baseline' : 'Record current measurements'}
            </p>
          </div>
        </div>
      </button>

      {/* No snapshots yet */}
      {!latest && (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p className="text-2xl mb-3" aria-hidden>📏</p>
          <p>No baseline data yet.</p>
          <p className="text-xs text-gray-600 mt-1">Take the first snapshot to start tracking progress.</p>
        </div>
      )}

      {/* Latest snapshot */}
      {latest && (
        <section>
          <h3 className="section-label">Current</h3>
          <SnapshotCard snapshot={latest} compareSnapshot={firstSnapshot !== latest ? firstSnapshot : null} />
        </section>
      )}

      {/* History */}
      {snapshots && snapshots.length > 1 && (
        <section>
          <h3 className="section-label">History</h3>
          <div className="space-y-2">
            {snapshots.slice(1).map((snap) => (
              <div key={snap.id} className="card p-3 text-sm text-gray-400">
                <p className="text-xs text-gray-600 mb-1">
                  {new Date(snap.capturedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  <span className="capitalize">{snap.progressionState}</span>
                </p>
                <div className="flex flex-wrap gap-3">
                  {snap.weightLbs      && <span>{snap.weightLbs} lbs</span>}
                  {snap.energyLevel    && <span>Energy {snap.energyLevel}/10</span>}
                  {snap.selfImageScore && <span>Self-image {snap.selfImageScore}/10</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
