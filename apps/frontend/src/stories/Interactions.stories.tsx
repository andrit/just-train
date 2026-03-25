import type { Meta, StoryObj } from '@storybook/react'
import { cn }                  from '@/lib/cn'
import { interactions } from '@/lib/interactions'

export default {
  title: 'Design System / Interactions',
} satisfies Meta

// ── Helper ────────────────────────────────────────────────────────────────────

function Demo({
  label,
  className = '',
  children,
  note,
}: {
  label:      string
  className?: string
  children:   React.ReactNode
  note?:      string
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-4">
      <div className="w-36 shrink-0">
        <p className="text-xs font-medium text-gray-300">{label}</p>
        {note && <p className="text-[10px] text-gray-600 mt-0.5">{note}</p>}
      </div>
      <div className={className}>
        {children}
      </div>
    </div>
  )
}

// ── Button interaction classes ────────────────────────────────────────────────

export const ButtonInteractions: StoryObj = {
  name: 'Button / All interaction classes',
  render: () => (
    <div className="p-6 space-y-6 max-w-xl">
      <h2 className="font-display text-xl uppercase tracking-wide text-white mb-1">
        Button Interactions
      </h2>
      <p className="text-xs text-gray-500 mb-6">
        All values come from <code className="text-brand-highlight">src/lib/interactions.ts</code>.
        Edit that file to change durations, scales, and pulse behavior globally.
      </p>

      <div className="space-y-5">
        <Demo label="base + press" note="active:scale-95">
          <button className={cn(
            'px-4 py-2 rounded-lg bg-brand-highlight text-white text-sm',
            interactions.button.base,
            interactions.button.press,
          )}>
            Press me
          </button>
        </Demo>

        <Demo label="base + hover" note="hover:scale-[1.02]">
          <button className={cn(
            'px-4 py-2 rounded-lg bg-surface border border-surface-border text-gray-200 text-sm',
            interactions.button.base,
            interactions.button.hover,
          )}>
            Hover me
          </button>
        </Demo>

        <Demo label="FAB hover" note="hover:scale-110 + shadow">
          <button className={cn(
            'px-4 py-2 rounded-xl bg-brand-highlight text-white text-sm',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
          )}>
            FAB hover
          </button>
        </Demo>

        <Demo label="FAB pulse" note="continuous pulse ring — animate-fab-pulse">
          <button className={cn(
            'px-4 py-2 rounded-xl bg-brand-highlight text-white text-sm',
            interactions.button.base,
            interactions.fab.hover,
            interactions.button.press,
            interactions.fab.pulse,
          )}>
            Pulsing FAB
          </button>
        </Demo>

        <Demo label="card hover" note="-translate-y-0.5 + shadow">
          <div className={cn(
            'card p-3 cursor-pointer w-40',
            interactions.card.base,
            interactions.card.hover,
            interactions.card.press,
          )}>
            <p className="text-sm text-gray-300">Hover card</p>
          </div>
        </Demo>

        <Demo label="danger hover" note="animate-shake on hover">
          <button className={cn(
            'px-4 py-2 rounded-lg bg-red-600/20 border border-red-600/30 text-red-400 text-sm',
            interactions.danger.base,
            interactions.danger.hover,
            interactions.danger.press,
          )}>
            Delete
          </button>
        </Demo>

        <Demo label="icon button" note="rounded-full, scale on hover">
          <button className={cn(
            'p-2 text-gray-400',
            interactions.icon.base,
            interactions.icon.hover,
            interactions.icon.press,
          )}>
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </Demo>
      </div>
    </div>
  ),
}

// ── Animation keyframes ───────────────────────────────────────────────────────

export const Animations: StoryObj = {
  name: 'Animations / All keyframes',
  render: () => (
    <div className="p-6 space-y-6 max-w-xl">
      <h2 className="font-display text-xl uppercase tracking-wide text-white mb-1">
        Animation Keyframes
      </h2>
      <p className="text-xs text-gray-500 mb-6">
        All keyframes defined in <code className="text-brand-highlight">tailwind.config.js</code>.
        Re-trigger by switching away from this story and back.
      </p>

      <div className="space-y-5">
        {[
          { name: 'slide-up',    cls: 'animate-slide-up',   label: 'slide-up',   note: 'Page enter, new list items' },
          { name: 'fade-in',     cls: 'animate-fade-in',    label: 'fade-in',    note: 'Overlays, tooltips' },
          { name: 'bounce-in',   cls: 'animate-bounce-in',  label: 'bounce-in',  note: 'CREATE events — new items appearing' },
          { name: 'fab-pulse',   cls: 'animate-fab-pulse',  label: 'fab-pulse',  note: 'Primary CTA attention pulse' },
          { name: 'check-pop',   cls: 'animate-check-pop',  label: 'check-pop',  note: 'Set logged, goal achieved' },
          { name: 'shake',       cls: 'animate-shake',      label: 'shake',      note: 'Error, destructive hover' },
        ].map(({ name, cls, label, note }) => (
          <Demo key={name} label={label} note={note}>
            <div className={cn(
              'px-4 py-2 rounded-lg bg-surface border border-surface-border text-sm text-gray-300',
              cls,
            )}>
              {label}
            </div>
          </Demo>
        ))}
      </div>
    </div>
  ),
}

// ── Stagger pattern ───────────────────────────────────────────────────────────

export const StaggeredList: StoryObj = {
  name: 'Animations / Staggered list entry',
  render: () => (
    <div className="p-6 max-w-xs space-y-3">
      <p className="text-xs text-gray-500 mb-4">
        Used on dashboard widget stack and client list. Each item delays by 50ms.
      </p>
      {['AtRisk alert', 'Self training', 'Active clients', 'Goals', 'Recent sessions'].map((label, i) => (
        <div
          key={label}
          className="card p-3 text-sm text-gray-300 animate-slide-up"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {label}
        </div>
      ))}
    </div>
  ),
}
