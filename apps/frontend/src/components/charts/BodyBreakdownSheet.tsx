// ------------------------------------------------------------
// components/charts/BodyBreakdownSheet.tsx
//
// The tap-in companion to the Home BodyHeatMap: a bottom sheet that maps every
// muscle (grouped by body part) to how many sessions trained it in the last 30
// days. More granular than the figure on purpose — it lists muscles the SVG
// can't paint (e.g. Tibialis Ant.), so any muscle is reachable here.
//
// Both ends are visible: a highlights strip (most-trained + how many neglected)
// and, within each group, muscles sorted busiest-first with untrained ones shown
// cold rather than hidden.
//
// v1 is display-only (the map). Tapping a muscle → its exercises is Phase 2
// (needs the GET /exercises?muscle= seam). See task-plan-body-sheet.md.
// ------------------------------------------------------------

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Spinner } from '@/components/ui/Spinner'
import { useExercises } from '@/lib/queries/exercises'
import { heatFill } from './heatRamp'
import { MUSCLE_BODY_PART, MUSCLE_LABEL } from '@trainer-app/shared'
import type { Muscle, BodyPart, MuscleFrequencyCount } from '@trainer-app/shared'

const GROUP_ORDER: BodyPart[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'full_body']
const GROUP_LABEL: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', core: 'Core', legs: 'Legs', full_body: 'Full Body',
}

interface BodyBreakdownSheetProps {
  open:    boolean
  onClose: () => void
  counts:  MuscleFrequencyCount[]
}

export function BodyBreakdownSheet({ open, onClose, counts }: BodyBreakdownSheetProps): React.JSX.Element {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState<Muscle | null>(null)

  // Tapping a suggested exercise opens its detail on the Exercises page (which
  // carries the context-aware "Add to Workout" CTA), and closes this sheet.
  const openExercise = (exerciseId: string): void => {
    onClose()
    navigate('/exercises', { state: { openExerciseId: exerciseId } })
  }

  const { groups, max, topMuscle, neglectedCount } = useMemo(() => {
    const countOf = new Map<Muscle, number>()
    for (const c of counts) countOf.set(c.muscle, c.count)

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

    const sorted   = allMuscles
      .map((m) => ({ muscle: m, count: countOf.get(m) ?? 0 }))
      .sort((a, b) => b.count - a.count)
    const topMuscle      = sorted[0] && sorted[0].count > 0 ? sorted[0] : null
    const neglectedCount = allMuscles.filter((m) => (countOf.get(m) ?? 0) === 0).length

    return { groups, max, topMuscle, neglectedCount }
  }, [counts])

  return (
    <BottomSheet open={open} onClose={onClose} title="Body · last 30 days" maxHeight="85vh">
      <div className="px-4 pb-8 pt-1">

        {/* Highlights — both ends at a glance */}
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
          <div className="rounded-lg border border-surface-border bg-surface px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Neglected</p>
            <p className="text-sm text-white mt-0.5">
              {neglectedCount} <span className="text-gray-500">muscle{neglectedCount === 1 ? '' : 's'} untrained</span>
            </p>
          </div>
        </div>

        {/* Groups → every muscle */}
        <div className="space-y-4">
          {groups.map(({ bodyPart, muscles }) => (
            <div key={bodyPart}>
              <p className="section-label">{GROUP_LABEL[bodyPart] ?? bodyPart}</p>
              <div className="mt-1">
                {muscles.map(({ muscle, count }) => {
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
                })}
              </div>
            </div>
          ))}
        </div>

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

  return (
    <div className="pb-2 pl-5 space-y-1">
      {exercises.map((ex) => (
        <button
          key={ex.id}
          type="button"
          onClick={() => onPick(ex.id)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-border hover:border-command-blue/30 text-left transition-colors"
        >
          <span className="text-sm text-gray-200 flex-1 truncate">{ex.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">{ex.equipment}</span>
          <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-gray-600 shrink-0" aria-hidden>
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ))}
    </div>
  )
}
