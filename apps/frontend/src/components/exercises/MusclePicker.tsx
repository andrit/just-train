// ------------------------------------------------------------
// components/exercises/MusclePicker.tsx
//
// Tap a muscle chip to cycle: none → primary → secondary → none.
// Grouped by the 7 body-part buckets, labelled with gym names.
// Colour matches the muscle map: Ember Red = primary, red tint = secondary.
//
// Controlled: owns no state. `value` is the current { primary, secondary }
// selection; `onChange` returns the next selection. A muscle is in at most
// one group (the cycle enforces it).
// ------------------------------------------------------------

import {
  MuscleEnum,
  MUSCLE_LABEL,
  MUSCLE_BODY_PART,
  type Muscle,
  type BodyPart,
} from '@trainer-app/shared'
import { cn } from '@/lib/cn'

export interface MuscleTargets {
  primary:   Muscle[]
  secondary: Muscle[]
}

interface MusclePickerProps {
  value:    MuscleTargets
  onChange: (next: MuscleTargets) => void
}

// Body-part groups, in a head-to-toe reading order, each holding the muscles
// MUSCLE_BODY_PART assigns to it (iterating MuscleEnum preserves the anatomical
// order the enum is authored in). full_body has no muscles of its own.
const GROUP_ORDER: BodyPart[] = ['shoulders', 'chest', 'back', 'arms', 'core', 'legs']

const GROUP_LABEL: Record<BodyPart, string> = {
  shoulders: 'Shoulders', chest: 'Chest', back: 'Back', arms: 'Arms',
  core: 'Core', legs: 'Legs', full_body: 'Full Body',
}

const MUSCLES_BY_GROUP: Record<string, Muscle[]> = (() => {
  const groups: Record<string, Muscle[]> = {}
  for (const muscle of MuscleEnum.options as Muscle[]) {
    const g = MUSCLE_BODY_PART[muscle]
    ;(groups[g] ??= []).push(muscle)
  }
  return groups
})()

type Role = 'primary' | 'secondary' | 'none'

export default function MusclePicker({ value, onChange }: MusclePickerProps): React.JSX.Element {
  const roleOf = (m: Muscle): Role =>
    value.primary.includes(m) ? 'primary'
    : value.secondary.includes(m) ? 'secondary'
    : 'none'

  const cycle = (m: Muscle): void => {
    // Start from a copy with the muscle removed from both groups.
    const primary   = value.primary.filter((x) => x !== m)
    const secondary = value.secondary.filter((x) => x !== m)
    const current = roleOf(m)
    if (current === 'none')         primary.push(m)      // none → primary
    else if (current === 'primary') secondary.push(m)    // primary → secondary
    // secondary → none: leave it removed
    onChange({ primary, secondary })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="field-label mb-0">Muscles worked</span>
        <span className="text-xs text-iron-grey">tap: primary → secondary → off</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-iron-grey">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ember-red" /> Primary
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-ember-red/30" /> Secondary
        </span>
      </div>

      {GROUP_ORDER.map((group) => {
        const muscles = MUSCLES_BY_GROUP[group] ?? []
        if (muscles.length === 0) return null
        return (
          <div key={group}>
            <p className="text-xs font-medium text-iron-grey uppercase tracking-wide mb-1.5">
              {GROUP_LABEL[group]}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {muscles.map((m) => {
                const role = roleOf(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => cycle(m)}
                    aria-pressed={role !== 'none'}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
                      role === 'primary'   && 'bg-ember-red text-chalk-white border-ember-red',
                      role === 'secondary' && 'bg-ember-red/20 text-ember-red border-ember-red/40',
                      role === 'none'      && 'bg-transparent text-iron-grey border-ink/15 hover:border-ink/30',
                    )}
                  >
                    {MUSCLE_LABEL[m]}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
