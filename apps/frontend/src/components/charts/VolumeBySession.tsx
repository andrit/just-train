// ------------------------------------------------------------
// components/charts/VolumeBySession.tsx
//
// Total volume per completed session, as a compact bar chart.
// Single-series magnitude → one hue (Command Blue); no legend (the title names
// it). Plain HTML bars (responsive + easy hover/focus), dependency-free in the
// spirit of Sparkline / MuscleMap. A readout line shows the hovered/focused
// bar (or the latest by default); tapping a bar opens that session's history.
// ------------------------------------------------------------

import { useState }    from 'react'
import { cn }          from '@/lib/cn'
import { useNav }      from '@/services/navService'
import { formatDate }  from '@/lib/formatters'
import type { VolumeHistoryPoint } from '@trainer-app/shared'

interface VolumeBySessionProps {
  points: VolumeHistoryPoint[]
}

export function VolumeBySession({ points }: VolumeBySessionProps): React.JSX.Element {
  const nav = useNav()
  const [active, setActive] = useState<number | null>(null)

  if (points.length === 0) {
    return (
      <div className="card p-4">
        <p className="section-label">Volume per session</p>
        <p className="text-xs text-ink-faint text-center mt-1 py-6">
          No volume logged yet — complete a session to see your trend.
        </p>
      </div>
    )
  }

  const max   = Math.max(...points.map((p) => p.volume), 1)
  const shown = active ?? points.length - 1
  const sel   = points[shown]

  return (
    <div className="card p-4">
      {/* Header + readout — text wears ink tokens, never the series color */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="section-label">Volume per session</p>
        {sel && (
          <p className="text-xs text-ink-muted tabular-nums">
            <span className="text-ink font-medium">{sel.volume.toLocaleString()}</span>
            <span className="text-ink-faint"> lbs · </span>
            {formatDate(sel.date)}
          </p>
        )}
      </div>

      {/* Bars — anchored to a baseline, 2px gap, rounded data-ends */}
      <div
        className="mt-3 flex items-end gap-[2px] h-28 border-b border-surface-border"
        role="group"
        aria-label="Total volume for each of the most recent sessions"
      >
        {points.map((p, i) => {
          const isSel = i === shown
          const h = Math.max((p.volume / max) * 100, 2)  // 2% floor so a logged session is always visible
          return (
            <button
              key={p.sessionId}
              type="button"
              onClick={() => nav.openSessionHistory(p.sessionId)}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${p.name ?? formatDate(p.date)}: ${p.volume.toLocaleString()} volume — open session`}
              className="flex-1 h-full flex items-end rounded-t-[4px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue"
            >
              <span
                className={cn(
                  'block w-full rounded-t-[4px] transition-colors',
                  isSel ? 'bg-command-blue' : 'bg-command-blue/55',
                )}
                style={{ height: `${h}%` }}
              />
            </button>
          )
        })}
      </div>

      {/* Time axis — just the ends, recessive */}
      {points.length > 1 && (
        <div className="flex justify-between mt-1.5 text-[10px] text-ink-faint tabular-nums">
          <span>{formatDate(points[0].date)}</span>
          <span>{formatDate(points[points.length - 1].date)}</span>
        </div>
      )}
    </div>
  )
}
