// ------------------------------------------------------------
// components/charts/BodyHeatMap.tsx
//
// Home body figure: anterior + posterior silhouettes with each region shaded
// by how often it was trained in the last 30 days — a glanceable "what am I
// actually hitting?" heat-map. Reuses MuscleMap's vendored region geometry
// (muscleMapData) and the MUSCLE_TO_REGION mapping; only the coloring differs
// (a sequential frequency ramp, not primary/secondary roles).
//
// Coloring is a single-hue sequential scale in DISCRETE buckets: untrained =
// gray, then three Command-Blue tiers (low/med/high) that brighten with
// frequency so the busiest region pops on the dark ground. Blue, not red — red
// on a body reads as soreness/injury. Magnitude = one hue, never a rainbow.
//
// Tiers are NORMALIZED to the athlete's own busiest region, so the top tier
// always lights up. A region's value is the MAX session-count among the muscles
// that map to it (summing would double-count a session that hit two of them).
//
// v1 is a single (neutral/male) silhouette — the only geometry we have. A
// male/female toggle is deferred until a second silhouette with the same region
// slugs exists (see task-plan-home-body-heatmap.md).
// ------------------------------------------------------------

import { cn } from '@/lib/cn'
import { MUSCLE_TO_REGION } from './MuscleMap'
import { heatFill } from './heatRamp'
import {
  ANTERIOR_REGIONS, POSTERIOR_REGIONS, MUSCLE_MAP_VIEWBOX, type BodyRegion,
} from './muscleMapData'
import type { MuscleFrequencyCount } from '@trainer-app/shared'

const BASE_STROKE = '#2A2E34'

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

  // Fill color for a region, bucketed from its frequency normalized to the
  // busiest region (gray if untrained). Shared ramp — see heatRamp.ts.
  const fillOf = (region: BodyRegion): string => heatFill(regionValue.get(region) ?? 0, max)

  return (
    <div className={cn('flex items-stretch justify-center gap-4 w-full', className)}>
      <Figure label="Front" regions={ANTERIOR_REGIONS}  fillOf={fillOf} />
      <Figure label="Back"  regions={POSTERIOR_REGIONS} fillOf={fillOf} />
    </div>
  )
}

interface FigureProps {
  label:   string
  regions: Record<BodyRegion, string[]>
  fillOf:  (region: BodyRegion) => string
}

function Figure({ label, regions, fillOf }: FigureProps): React.JSX.Element {
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
          const fill = fillOf(region as BodyRegion)
          return polygons.map((points) => (
            <polygon
              key={points}
              points={points}
              fill={fill}
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
