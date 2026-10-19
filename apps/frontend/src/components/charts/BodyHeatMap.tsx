// ------------------------------------------------------------
// components/charts/BodyHeatMap.tsx
//
// Home body figure: anterior + posterior silhouettes with each region shaded
// by how often it was trained in the last 30 days — a glanceable "what am I
// actually hitting?" heat-map. Reuses MuscleMap's vendored region geometry
// (muscleMapData) and the MUSCLE_TO_REGION mapping; only the coloring differs
// (a single sequential Ember-Red ramp keyed to frequency, not primary/secondary
// roles).
//
// Intensity is NORMALIZED to the athlete's own busiest region, so something
// always lights up. A region's value is the MAX session-count among the muscles
// that map to it (summing would double-count a session that hit two of them).
//
// v1 is a single (neutral/male) silhouette — the only geometry we have. A
// male/female toggle is deferred until a second silhouette with the same region
// slugs exists (see task-plan-home-body-heatmap.md).
// ------------------------------------------------------------

import { cn } from '@/lib/cn'
import { MUSCLE_TO_REGION } from './MuscleMap'
import {
  ANTERIOR_REGIONS, POSTERIOR_REGIONS, MUSCLE_MAP_VIEWBOX, type BodyRegion,
} from './muscleMapData'
import type { MuscleFrequencyCount } from '@trainer-app/shared'

// Self-contained palette (reads on the dark surface), aligned with MuscleMap.
const BASE_FILL   = '#3F444C'  // untrained region
const BASE_STROKE = '#2A2E34'
const HOT_FILL    = '#D91B1B'  // Ember Red — "trained"
const MIN_OPACITY = 0.3        // any trained region is clearly redder than base

interface BodyHeatMapProps {
  counts:     MuscleFrequencyCount[]
  className?: string
}

export function BodyHeatMap({ counts, className }: BodyHeatMapProps): React.JSX.Element {
  // Region value = max session-count among the muscles mapping to it.
  const regionValue = new Map<BodyRegion, number>()
  for (const { muscle, count } of counts) {
    for (const region of MUSCLE_TO_REGION[muscle] ?? []) {
      regionValue.set(region, Math.max(regionValue.get(region) ?? 0, count))
    }
  }
  const max = Math.max(1, ...regionValue.values())

  // Normalized fill opacity for a region (0 → base gray, else floor..1 of red).
  const opacityOf = (region: BodyRegion): number | null => {
    const v = regionValue.get(region)
    if (!v) return null
    return MIN_OPACITY + (v / max) * (1 - MIN_OPACITY)
  }

  return (
    <div className={cn('flex items-stretch justify-center gap-4 w-full', className)}>
      <Figure label="Front" regions={ANTERIOR_REGIONS}  opacityOf={opacityOf} />
      <Figure label="Back"  regions={POSTERIOR_REGIONS} opacityOf={opacityOf} />
    </div>
  )
}

interface FigureProps {
  label:     string
  regions:   Record<BodyRegion, string[]>
  opacityOf: (region: BodyRegion) => number | null
}

function Figure({ label, regions, opacityOf }: FigureProps): React.JSX.Element {
  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col items-center">
      {/* flex-1 svg → height-driven; preserveAspectRatio centers the body. */}
      <svg
        viewBox={MUSCLE_MAP_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className="flex-1 min-h-0 w-full"
        role="img"
        aria-label={`${label} view — muscles shaded by how often trained in the last 30 days`}
      >
        {Object.entries(regions).map(([region, polygons]) => {
          const op = opacityOf(region)
          return polygons.map((points) => (
            <polygon
              key={points}
              points={points}
              fill={op === null ? BASE_FILL : HOT_FILL}
              fillOpacity={op ?? 1}
              stroke={BASE_STROKE}
              strokeWidth={2}
            />
          ))
        })}
      </svg>
      <span className="shrink-0 text-[10px] uppercase tracking-widest text-gray-500 mt-1">{label}</span>
    </div>
  )
}
