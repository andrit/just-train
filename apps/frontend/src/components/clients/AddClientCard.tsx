// ------------------------------------------------------------
// components/clients/AddClientCard.tsx
//
// The "Add Client" entry in the client list.
// Shows a silhouette avatar placeholder with an animated + badge
// overlaid on the head. Tapping anywhere on the card opens the
// Add Client drawer.
//
// Animation: the + badge pulses (fab-pulse) to draw attention.
// To disable the pulse: remove 'animate-fab-pulse' from the badge div.
// To change pulse color: change the shadow color in tailwind.config.js
//   under keyframes.fab-pulse.
// ------------------------------------------------------------

import { useRef }        from 'react'
import { cn }           from '@/lib/cn'
import { interactions } from '@/lib/interactions'
import { useUXEvent }   from '@/hooks/useUXEvent'

interface AddClientCardProps {
  onClick: () => void
}

export function AddClientCard({ onClick }: AddClientCardProps): React.JSX.Element {
  const cardRef    = useRef<HTMLButtonElement>(null)
  const { fire }   = useUXEvent()

  const handleClick = (): void => {
    fire('single_press', { target: cardRef.current ?? undefined, entity: 'client' })
    onClick()
  }
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      aria-label="Add new client"
      className={cn(
        'card w-full p-4 text-left relative overflow-hidden',
        'border-dashed border-surface-border',
        'hover:border-command-blue/40 hover:bg-surface',
        interactions.card.base,
        interactions.card.hover,
        interactions.card.press,
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
      )}
    >
      <div className="flex items-center gap-3">

        {/* Silhouette avatar with + overlay */}
        <div className="relative shrink-0 w-12 h-12">
          {/* Avatar base */}
          <div className="w-full h-full rounded-full bg-brand-accent/50 border border-dashed border-surface-border flex items-end justify-center overflow-hidden">
            {/* Silhouette */}
            <svg
              className="w-7 h-7 text-gray-600 mb-0.5"
              viewBox="0 0 24 28"
              fill="currentColor"
              aria-hidden
            >
              <circle cx="12" cy="7" r="5" />
              <path d="M2 28 C2 20 5 16 12 16 C19 16 22 20 22 28 Z" />
            </svg>
          </div>

          {/* Animated + badge — overlaid on the head area */}
          {/* To tweak: change size (w-5 h-5), color (bg-command-blue), or remove animate-fab-pulse */}
          <div
            className={cn(
              'absolute -top-0.5 -right-0.5',
              'w-5 h-5 rounded-full',
              'bg-command-blue text-white',
              'flex items-center justify-center',
              'animate-fab-pulse',    // ← remove this line to disable pulse
              'shadow-sm',
            )}
            aria-hidden
          >
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-2.5 h-2.5">
              <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div>
          <p className="font-display text-lg uppercase tracking-wide text-gray-400">
            Add Client
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            Start tracking a new client's progress
          </p>
        </div>
      </div>
    </button>
  )
}
