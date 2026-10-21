// ------------------------------------------------------------
// components/charts/MuscleMap.tsx
//
// Anterior + posterior body diagram with worked muscles highlighted —
// primary (Ember Red) and secondary (red tint), the gym-placard convention.
// Pure inline SVG, no charting/illustration dependency (same spirit as
// Sparkline). Polygon geometry is vendored in muscleMapData.ts.
//
// DATA > RENDER: the exercise stores precise muscles (34-term vocab); this map
// paints at the SVG's coarser region resolution via MUSCLE_TO_REGION. Muscles
// with no region (e.g. tibialis_anterior) simply don't paint — they still show
// as text labels wherever the caller lists them.
// ------------------------------------------------------------

import type { Muscle } from '@trainer-app/shared'
import { cn } from '@/lib/cn'
import {
  ANTERIOR_REGIONS, POSTERIOR_REGIONS, MUSCLE_MAP_VIEWBOX, type BodyRegion,
} from './muscleMapData'

// Each anatomical muscle → the SVG region(s) that stand in for it. A few are
// approximations the render resolution can't separate (the three deltoid heads
// share front/back-deltoids; the three traps share trapezius); some have no
// region at all (tibialis_anterior) and are intentionally absent here.
export const MUSCLE_TO_REGION: Record<Muscle, BodyRegion[]> = {
  deltoid_anterior:    ['front-deltoids'],
  deltoid_lateral:     ['front-deltoids'],
  deltoid_posterior:   ['back-deltoids'],
  rotator_cuff:        ['back-deltoids'],
  pectoralis_major:    ['chest'],
  pectoralis_minor:    ['chest'],
  serratus_anterior:   ['chest'],
  latissimus_dorsi:    ['upper-back'],
  trapezius_upper:     ['trapezius'],
  trapezius_middle:    ['trapezius'],
  trapezius_lower:     ['trapezius'],
  rhomboids:           ['upper-back'],
  teres_major:         ['upper-back'],
  erector_spinae:      ['lower-back'],
  biceps_brachii:      ['biceps'],
  brachialis:          ['biceps'],
  triceps_brachii:     ['triceps'],
  brachioradialis:     ['forearm'],
  forearm_flexors:     ['forearm'],
  forearm_extensors:   ['forearm'],
  rectus_abdominis:    ['abs'],
  obliques:            ['obliques'],
  transverse_abdominis:['abs'],
  gluteus_maximus:     ['gluteal'],
  gluteus_medius:      ['gluteal'],
  hip_flexors:         ['quadriceps'],
  hip_adductors:       ['adductor'],
  hip_abductors:       ['abductors'],
  quadriceps:          ['quadriceps'],
  hamstrings:          ['hamstring'],
  gastrocnemius:       ['calves'],
  soleus:              ['left-soleus', 'right-soleus'],
  tibialis_anterior:   [],
  sternocleidomastoid: ['neck'],
}

// Inverse of MUSCLE_TO_REGION: which muscles a figure region stands for. Derived
// at module load so the two can never drift (a new muscle→region edge appears
// here automatically). Used to scope the breakdown sheet when a region is tapped.
export const REGION_MUSCLES: Record<BodyRegion, Muscle[]> = (() => {
  const out: Record<string, Muscle[]> = {}
  for (const [muscle, regions] of Object.entries(MUSCLE_TO_REGION) as [Muscle, BodyRegion[]][]) {
    for (const r of regions) (out[r] ??= []).push(muscle)
  }
  return out
})()

// Readable name for a tapped region (header on the scoped sheet). NOT a role
// claim — just a label for the region grouping. Left/right soleus both read
// "Soleus"; head/knees have no entry (they carry no muscle and are inert).
export const REGION_LABEL: Record<string, string> = {
  'front-deltoids': 'Front Delts', 'back-deltoids': 'Rear Delts',
  chest: 'Chest', 'upper-back': 'Upper Back', trapezius: 'Traps',
  'lower-back': 'Lower Back', biceps: 'Biceps', triceps: 'Triceps',
  forearm: 'Forearms', abs: 'Abs', obliques: 'Obliques',
  gluteal: 'Glutes', quadriceps: 'Quads', hamstring: 'Hamstrings',
  adductor: 'Adductors', abductors: 'Abductors', calves: 'Calves',
  'left-soleus': 'Soleus', 'right-soleus': 'Soleus', neck: 'Neck',
}

// Self-contained palette (reads on the dark detail surface, like a placard).
const BASE_FILL      = '#3F444C'
const BASE_STROKE    = '#2A2E34'
const PRIMARY_FILL   = '#D91B1B'  // Ember Red
const SECONDARY_FILL = '#D91B1B'
const SECONDARY_OPACITY = 0.4

type Intensity = 'primary' | 'secondary' | 'base'

function regionSets(muscles: Muscle[]): Set<BodyRegion> {
  const set = new Set<BodyRegion>()
  for (const m of muscles) for (const r of MUSCLE_TO_REGION[m] ?? []) set.add(r)
  return set
}

interface MuscleMapProps {
  primary:    Muscle[]
  secondary:  Muscle[]
  className?: string
}

export function MuscleMap({ primary, secondary, className }: MuscleMapProps): React.JSX.Element {
  const primaryRegions   = regionSets(primary)
  const secondaryRegions = regionSets(secondary)

  const intensityOf = (region: BodyRegion): Intensity =>
    primaryRegions.has(region) ? 'primary'
      : secondaryRegions.has(region) ? 'secondary'
      : 'base'

  return (
    <div className={cn('flex items-end justify-center gap-6', className)}>
      <Figure label="Front" regions={ANTERIOR_REGIONS}  intensityOf={intensityOf} />
      <Figure label="Back"  regions={POSTERIOR_REGIONS} intensityOf={intensityOf} />
    </div>
  )
}

interface FigureProps {
  label:       string
  regions:     Record<BodyRegion, string[]>
  intensityOf: (region: BodyRegion) => Intensity
}

function Figure({ label, regions, intensityOf }: FigureProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox={MUSCLE_MAP_VIEWBOX}
        className="h-48 w-auto"
        role="img"
        aria-label={`${label} view, worked muscles highlighted`}
      >
        {Object.entries(regions).map(([region, polygons]) => {
          const intensity = intensityOf(region)
          const fill = intensity === 'primary' ? PRIMARY_FILL
            : intensity === 'secondary' ? SECONDARY_FILL
            : BASE_FILL
          // points strings are unique per polygon → a stable, index-free key.
          return polygons.map((points) => (
            <polygon
              key={points}
              points={points}
              fill={fill}
              fillOpacity={intensity === 'secondary' ? SECONDARY_OPACITY : 1}
              stroke={BASE_STROKE}
              strokeWidth={2}
            />
          ))
        })}
      </svg>
      <span className="text-[10px] uppercase tracking-widest text-gray-500">{label}</span>
    </div>
  )
}
