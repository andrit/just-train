// ------------------------------------------------------------
// components/charts/VolumeByBodyPart.tsx
//
// Where your lifting volume went over the last 30 days, by body part.
// Single-series magnitude → one hue (Command Blue), no legend (the title names
// it). Horizontal bars read best for a handful of text-labelled categories;
// each carries a direct value label (only 6–7 rows, so no tooltip needed).
// Volume is attributed to each exercise's own body part, so the bars sum to
// total lifting volume (see GET /clients/:id/volume-by-body-part). Plain HTML,
// dependency-free in the spirit of VolumeBySession / Sparkline.
// ------------------------------------------------------------

import { cn } from '@/lib/cn'
import type { VolumeByBodyPartEntry } from '@trainer-app/shared'

// Display labels for the body-part slugs (same strings the breakdown sheet uses).
const BODY_PART_LABEL: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', core: 'Core', legs: 'Legs', full_body: 'Full Body',
}

interface VolumeByBodyPartProps {
  entries: VolumeByBodyPartEntry[]
}

export function VolumeByBodyPart({ entries }: VolumeByBodyPartProps): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="card p-4">
        <p className="section-label">Volume by body part</p>
        <p className="text-xs text-gray-600 text-center mt-1 py-6">
          No lifting volume in the last 30 days — log a session to see where your work is going.
        </p>
      </div>
    )
  }

  const max = Math.max(...entries.map((e) => e.volume), 1)

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="section-label">Volume by body part</p>
        <p className="text-[10px] uppercase tracking-widest text-gray-600">Last 30 days</p>
      </div>

      <div className="mt-3 space-y-2" role="group" aria-label="Total volume by body part, last 30 days">
        {entries.map((e) => {
          const w = Math.max((e.volume / max) * 100, 2)  // 2% floor so any logged part is visible
          return (
            <div key={e.bodyPart} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-gray-400 truncate">
                {BODY_PART_LABEL[e.bodyPart] ?? e.bodyPart}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-surface-border/40 overflow-hidden">
                <span
                  className={cn('block h-full rounded-full bg-command-blue')}
                  style={{ width: `${w}%` }}
                  aria-hidden
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs text-gray-300 tabular-nums">
                {e.volume.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-gray-600 text-right mt-2">lbs · counted by each exercise's body part</p>
    </div>
  )
}
