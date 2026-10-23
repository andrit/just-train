// ------------------------------------------------------------
// components/charts/BodyBreakdownSheet.tsx
//
// The tap-in companion to the Home BodyHeatMap: a bottom sheet that maps every
// muscle (grouped by body part) to how many sessions trained it in the last 30
// days. More granular than the figure on purpose — it lists muscles the SVG
// can't paint (e.g. Tibialis Ant.), so any muscle is reachable here.
//
// Two entry modes:
//   • Full      — tap the figure as a whole → every muscle, grouped by body
//                 part, with a highlights strip (both ends at a glance).
//   • Scoped    — tap a region on the figure (e.g. quads) → only that region's
//                 muscles, ordered busiest-first, with a "All muscles" escape.
//
// Tapping a muscle expands to the library exercises that target it, grouped
// "Primary movers" / "Also works it" by the exercise→muscle role. Tapping an
// exercise opens its detail on the Exercises page (which carries Add to Workout).
// ------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Spinner } from '@/components/ui/Spinner'
import { EQUIPMENT_LABEL } from '@/lib/exerciseLabels'
import { useExercises } from '@/lib/queries/exercises'
import { heatFill } from './heatRamp'
import { REGION_MUSCLES, REGION_LABEL } from './MuscleMap'
import type { BodyRegion } from './muscleMapData'
import { MUSCLE_BODY_PART, MUSCLE_LABEL } from '@trainer-app/shared'
import type { Muscle, BodyPart, MuscleFrequencyCount, ExerciseSummaryResponse } from '@trainer-app/shared'

const GROUP_ORDER: BodyPart[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'full_body']
const GROUP_LABEL: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', core: 'Core', legs: 'Legs', full_body: 'Full Body',
}

interface BodyBreakdownSheetProps {
  open:    boolean
  onClose: () => void
  counts:  MuscleFrequencyCount[]
  // When the sheet is opened by tapping a figure region, scope to that region's
  // muscles. Null/undefined = the full all-muscles map. The sheet keeps a local
  // copy so "All muscles" can clear the scope without closing.
  scopeRegion?: BodyRegion | null
}

export function BodyBreakdownSheet({ open, onClose, counts, scopeRegion }: BodyBreakdownSheetProps): React.JSX.Element {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Muscle | null>(null)
  const [scope, setScope] = useState<BodyRegion | null>(scopeRegion ?? null)
  const [neglected, setNeglected] = useState(false)

  // On (re)open or a new region tap, adopt the incoming scope. If that region is
  // a single muscle, auto-expand straight to its exercises — no extra tap.
  useEffect(() => {
    if (!open) return
    const next = scopeRegion ?? null
    setScope(next)
    setNeglected(false)
    const only = next ? REGION_MUSCLES[next] : undefined
    setExpanded(only && only.length === 1 ? only[0] : null)
  }, [open, scopeRegion])

  // Tapping a suggested exercise opens its detail on the Exercises page (which
  // carries the context-aware "Add to Workout" CTA), and closes this sheet.
  const openExercise = (exerciseId: string): void => {
    onClose()
    navigate('/exercises', { state: { openExerciseId: exerciseId } })
  }

  const countOf = useMemo(() => {
    const m = new Map<Muscle, number>()
    for (const c of counts) m.set(c.muscle, c.count)
    return m
  }, [counts])

  const { groups, max, topMuscle, neglectedCount, neglectedMuscles } = useMemo(() => {
    const allMuscles = Object.keys(MUSCLE_BODY_PART) as Muscle[]
    const max = Math.max(1, ...allMuscles.map((m) => countOf.get(m) ?? 0))

    const byGroup = new Map<BodyPart, { muscle: Muscle; count: number }[]>()
    for (const m of allMuscles) {
      const bp  = MUSCLE_BODY_PART[m]
      const arr = byGroup.get(bp) ?? []
      arr.push({ muscle: m, count: countOf.get(m) ?? 0 })
      byGroup.set(bp, arr)
    }

    const groups = GROUP_ORDER
      .filter((bp) => byGroup.has(bp))
      .map((bp) => ({
        bodyPart: bp,
        muscles: (byGroup.get(bp) ?? []).sort(
          (a, b) => b.count - a.count || MUSCLE_LABEL[a.muscle].localeCompare(MUSCLE_LABEL[b.muscle]),
        ),
      }))

    const sorted = allMuscles
      .map((m) => ({ muscle: m, count: countOf.get(m) ?? 0 }))
      .sort((a, b) => b.count - a.count)
    const topMuscle      = sorted[0] && sorted[0].count > 0 ? sorted[0] : null
    const untrained      = allMuscles.filter((m) => (countOf.get(m) ?? 0) === 0)
    const neglectedCount = untrained.length
    const neglectedMuscles = [...untrained].sort((a, b) =>
      GROUP_ORDER.indexOf(MUSCLE_BODY_PART[a]) - GROUP_ORDER.indexOf(MUSCLE_BODY_PART[b])
      || MUSCLE_LABEL[a].localeCompare(MUSCLE_LABEL[b]),
    )

    return { groups, max, topMuscle, neglectedCount, neglectedMuscles }
  }, [countOf])

  // The region's muscles, busiest-first (name tiebreak). Primary-prevalence
  // tiebreak for untrained regions is a later refinement (needs a backend count).
  const scopedMuscles = useMemo(() => {
    if (!scope) return []
    return [...(REGION_MUSCLES[scope] ?? [])].sort(
      (a, b) => (countOf.get(b) ?? 0) - (countOf.get(a) ?? 0) || MUSCLE_LABEL[a].localeCompare(MUSCLE_LABEL[b]),
    )
  }, [scope, countOf])

  const title = scope
    ? `${REGION_LABEL[scope] ?? scope} · last 30 days`
    : neglected
    ? 'Neglected · last 30 days'
    : 'Body · last 30 days'

  const renderRow = (muscle: Muscle): React.JSX.Element => {
    const count  = countOf.get(muscle) ?? 0
    const isOpen = expanded === muscle
    return (
      <div key={muscle} className="border-b border-surface-border/40 last:border-0">
        <button
          type="button"
          onClick={() => setExpanded(isOpen ? null : muscle)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue rounded"
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: heatFill(count, max) }}
            aria-hidden
          />
          <span className={cn('text-sm flex-1 truncate', count > 0 ? 'text-gray-200' : 'text-gray-500')}>
            {MUSCLE_LABEL[muscle]}
          </span>
          <span className={cn('text-xs tabular-nums', count > 0 ? 'text-gray-400' : 'text-gray-600')}>
            {count > 0 ? `${count}×` : '—'}
          </span>
          <span className={cn('text-gray-600 text-xs transition-transform', isOpen && 'rotate-90')} aria-hidden>›</span>
        </button>
        {isOpen && <MuscleExercises muscle={muscle} onPick={openExercise} />}
      </div>
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title} maxHeight="85vh">
      <div className="px-4 pb-8 pt-1">

        {scope ? (
          /* Scoped — one region's muscles, with an escape to the full map */
          <>
            <button
              type="button"
              onClick={() => { setScope(null); setExpanded(null) }}
              className="text-xs text-command-blue mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue rounded"
            >
              ‹ All muscles
            </button>
            <div>{scopedMuscles.map(renderRow)}</div>
          </>
        ) : neglected ? (
          /* Neglected — the untrained muscles, each expandable to suggested exercises */
          <>
            <button
              type="button"
              onClick={() => { setNeglected(false); setExpanded(null) }}
              className="text-xs text-command-blue mb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue rounded"
            >
              ‹ All muscles
            </button>
            {neglectedMuscles.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Every muscle has been trained in the last 30 days.</p>
            ) : (
              <div>{neglectedMuscles.map(renderRow)}</div>
            )}
          </>
        ) : (
          /* Full — highlights + every muscle grouped by body part */
          <>
            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Most trained</p>
                {topMuscle ? (
                  <p className="text-sm text-white mt-0.5 truncate">
                    {MUSCLE_LABEL[topMuscle.muscle]} <span className="text-gray-500">· {topMuscle.count}×</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-600 mt-0.5">Nothing logged yet</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setNeglected(true); setExpanded(null) }}
                disabled={neglectedCount === 0}
                aria-label={neglectedCount > 0 ? `Show ${neglectedCount} neglected muscle${neglectedCount === 1 ? '' : 's'}` : undefined}
                className={cn(
                  'rounded-lg border border-surface-border bg-surface px-3 py-2 text-left',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
                  neglectedCount > 0 ? 'hover:border-command-blue/40 transition-colors' : 'cursor-default',
                )}
              >
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Neglected</p>
                <p className="text-sm text-white mt-0.5">
                  {neglectedCount} <span className="text-gray-500">muscle{neglectedCount === 1 ? '' : 's'} untrained</span>
                </p>
                {neglectedCount > 0 && (
                  <p className="text-[10px] text-command-blue mt-0.5">View ›</p>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {groups.map(({ bodyPart, muscles }) => (
                <div key={bodyPart}>
                  <p className="section-label">{GROUP_LABEL[bodyPart] ?? bodyPart}</p>
                  <div className="mt-1">{muscles.map(({ muscle }) => renderRow(muscle))}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-[10px] text-gray-600 text-center mt-5">
          Sessions that trained each muscle in the last 30 days.
        </p>
      </div>
    </BottomSheet>
  )
}

// ── Exercises that target a muscle (loaded on expand) ──────────────────────────

function MuscleExercises({ muscle, onPick }: {
  muscle: Muscle
  onPick: (exerciseId: string) => void
}): React.JSX.Element {
  const { data: exercises, isLoading } = useExercises({ muscle })

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Spinner size="sm" className="text-gray-500" />
      </div>
    )
  }

  if (!exercises || exercises.length === 0) {
    return <p className="text-xs text-gray-600 pb-3 pl-5">No library exercises target this muscle yet.</p>
  }

  // Group by the exercise→muscle role for this muscle (the backend sorts primary
  // first, so these stay name-ordered within each group).
  const primary   = exercises.filter((e) => e.muscleRole === 'primary')
  const secondary = exercises.filter((e) => e.muscleRole !== 'primary')
  const grouped   = primary.length > 0 && secondary.length > 0

  return (
    <div className="pb-2 pl-5 space-y-1">
      {grouped ? (
        <>
          <ExerciseGroup label="Primary movers" rows={primary} onPick={onPick} />
          <ExerciseGroup label="Also works it"  rows={secondary} onPick={onPick} />
        </>
      ) : (
        exercises.map((ex) => <ExerciseRow key={ex.id} ex={ex} onPick={onPick} />)
      )}
    </div>
  )
}

function ExerciseGroup({ label, rows, onPick }: {
  label: string
  rows:  ExerciseSummaryResponse[]
  onPick: (exerciseId: string) => void
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-gray-600 pt-1">{label}</p>
      {rows.map((ex) => <ExerciseRow key={ex.id} ex={ex} onPick={onPick} />)}
    </div>
  )
}

function ExerciseRow({ ex, onPick }: {
  ex: ExerciseSummaryResponse
  onPick: (exerciseId: string) => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onPick(ex.id)}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-border hover:border-command-blue/30 text-left transition-colors"
    >
      <span className="text-sm text-gray-200 flex-1 truncate">{ex.name}</span>
      <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">
        {EQUIPMENT_LABEL[ex.equipment] ?? ex.equipment}
      </span>
      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-600 shrink-0" aria-hidden>
        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
