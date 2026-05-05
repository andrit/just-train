// ------------------------------------------------------------
// components/session/AddBlockSheet.tsx (v1.8.0)
//
// Bottom sheet for adding a new workout block to a session.
// Trainer picks a workout type — block is created immediately.
// ------------------------------------------------------------

import { cn }          from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useAddWorkout } from '@/lib/queries/sessions'

const BLOCK_TYPES = [
  { type: 'resistance',   label: 'Resistance',   icon: '🏋️', desc: 'Free weights, machines, cables',  color: 'border-ember-red/40 text-ember-red' },
  { type: 'cardio',       label: 'Cardio',        icon: '🏃', desc: 'Running, cycling, rowing',         color: 'border-sky-500/40 text-sky-400' },
  { type: 'calisthenics', label: 'Calisthenics',  icon: '💪', desc: 'Bodyweight movements',            color: 'border-emerald-500/40 text-emerald-400' },
  { type: 'stretching',   label: 'Stretching',    icon: '🧘', desc: 'Mobility and flexibility work',   color: 'border-violet-500/40 text-violet-400' },
  { type: 'cooldown',     label: 'Cooldown',      icon: '❄️', desc: 'Wind-down, breathing',            color: 'border-gray-500/40 text-gray-400' },
] as const

interface AddBlockSheetProps {
  open:      boolean
  sessionId: string
  onClose:   () => void
}

export function AddBlockSheet({
  open, sessionId, onClose,
}: AddBlockSheetProps): React.JSX.Element {
  const addWorkout = useAddWorkout()

  const handleSelect = (type: string): void => {
    addWorkout.mutate(
      { sessionId, workoutType: type },
      { onSuccess: onClose },
    )
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add Block" maxHeight="60vh">
      <div className="p-4 space-y-2 pb-8">
        {BLOCK_TYPES.map(({ type, label, icon, desc, color }) => (
          <button
            key={type}
            type="button"
            onClick={() => handleSelect(type)}
            disabled={addWorkout.isPending}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-xl border',
              'bg-surface border-surface-border',
              'hover:border-opacity-60 transition-all duration-150',
              'text-left',
              interactions.button.base,
              interactions.button.press,
              addWorkout.isPending && 'opacity-50 pointer-events-none',
            )}
          >
            <span className="text-2xl shrink-0" aria-hidden>{icon}</span>
            <div className="min-w-0">
              <p className={cn('font-medium text-sm', color)}>{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-gray-600 ml-auto shrink-0">
              <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}
