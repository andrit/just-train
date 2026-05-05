import type { Meta, StoryObj } from '@storybook/react'
import { useRef, useState }    from 'react'
import { cn }                  from '@/lib/cn'
import { interactions }        from '@/lib/interactions'
import { useUXEvent, useUXEventRef } from '@/hooks/useUXEvent'
import { UX_EVENT_TYPES, UX_ANIMATION_MAP, uxEventRegistry } from '@/lib/ux-events'

export default {
  title: 'Design System / UX Events',
} satisfies Meta

// ── Animation trigger demo ────────────────────────────────────────────────────

export const AnimationTriggers: StoryObj = {
  name: 'Event → Animation mapping',
  render: () => {
    // Can't use hooks in render directly in all Storybook setups — wrap in component
    return <AnimationDemo />
  },
}

function AnimationDemo(): React.JSX.Element {
  const { fire: _fire } = useUXEvent()
  const [lastFired, setLastFired] = useState<string | null>(null)

  const eventAnimationPairs = Object.entries(UX_ANIMATION_MAP) as [string, string][]

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wide text-white mb-1">
          UX Event → Animation
        </h2>
        <p className="text-xs text-gray-500">
          Click each button to fire the event and see the animation play on the target element.
          Animations are one-shot — the class is removed on <code className="text-command-blue">animationend</code>.
        </p>
      </div>

      {lastFired && (
        <div className="text-xs text-gray-600 font-mono bg-surface border border-surface-border rounded px-3 py-2">
          Last fired: <span className="text-command-blue">{lastFired}</span>
        </div>
      )}

      <div className="space-y-3">
        {eventAnimationPairs.map(([eventType, animClass]) => (
          <EventAnimationRow
            key={eventType}
            eventType={eventType}
            animClass={animClass}
            onFire={(et) => {
              setLastFired(et)
              // fire(et as any) is called inside the row
            }}
          />
        ))}
      </div>
    </div>
  )
}

function EventAnimationRow({
  eventType,
  animClass,
  onFire,
}: {
  eventType: string
  animClass: string
  onFire:    (et: string) => void
}): React.JSX.Element {
  const targetRef  = useRef<HTMLDivElement>(null)
  const { fire }   = useUXEvent()

  const handleFire = (): void => {
    fire(eventType as any, { target: targetRef.current ?? undefined })
    onFire(eventType)
  }

  return (
    <div className="flex items-center gap-4">
      {/* Fire button */}
      <button
        type="button"
        onClick={handleFire}
        className={cn(
          'shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono',
          'bg-command-blue/10 border border-command-blue/20 text-command-blue',
          'hover:bg-command-blue/20',
          interactions.button.base,
          interactions.button.press,
        )}
      >
        fire('{eventType}')
      </button>

      {/* Arrow */}
      <svg className="w-4 h-4 text-gray-600 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M4 8h8M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Animated target */}
      <div
        ref={targetRef}
        className="flex-1 px-3 py-2 rounded-lg bg-surface border border-surface-border"
      >
        <code className="text-xs text-gray-400">{animClass}</code>
      </div>
    </div>
  )
}

// ── Side effect registry demo ─────────────────────────────────────────────────

export const SideEffectRegistry: StoryObj = {
  name: 'Side effect registry',
  render: () => <SideEffectDemo />,
}

function SideEffectDemo(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([])
  const { fire }      = useUXEvent()

  const addToLog = (msg: string): void => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 9)])
  }

  // Register a demo handler on mount
  useState(() => {
    uxEventRegistry.registerGlobal(async (eventType, payload) => {
      addToLog(`${eventType}${payload.entity ? ` (entity: ${payload.entity})` : ''}`)
    })
  })

  return (
    <div className="p-6 max-w-xl space-y-6">
      <div>
        <h2 className="font-display text-xl uppercase tracking-wide text-white mb-1">
          Side Effect Registry
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          A global handler is registered that logs every event. Fire events and watch the log below.
          In production, replace with audit logging, analytics, or contextual guidance.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['create', 'update', 'delete', 'achieve', 'error', 'success', 'page_enter'] as const).map((et) => (
          <button
            key={et}
            type="button"
            onClick={() => fire(et, { entity: 'demo' })}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-mono border',
              et === 'delete' || et === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : et === 'achieve' || et === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-surface border-surface-border text-gray-300',
              interactions.button.base,
              interactions.button.press,
            )}
          >
            {et}
          </button>
        ))}
      </div>

      {/* Log output */}
      <div className="rounded-xl bg-brand-primary border border-surface-border p-3 font-mono text-xs min-h-32">
        {log.length === 0 ? (
          <p className="text-gray-600">Fire an event to see it logged here…</p>
        ) : (
          log.map((entry, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <p key={i} className={cn('text-gray-400', i === 0 && 'text-emerald-400')}>
              {entry}
            </p>
          ))
        )}
      </div>
    </div>
  )
}

// ── useUXEventRef helper demo ─────────────────────────────────────────────────

export const UseUXEventRefHelper: StoryObj = {
  name: 'useUXEventRef helper',
  render: () => <RefHelperDemo />,
}

function RefHelperDemo(): React.JSX.Element {
  const [createRef, fireOnCreate] = useUXEventRef<HTMLButtonElement>()
  const [achieveRef, fireOnAchieve] = useUXEventRef<HTMLButtonElement>()
  const [errorRef, fireOnError]   = useUXEventRef<HTMLButtonElement>()

  return (
    <div className="p-6 max-w-sm space-y-4">
      <h2 className="font-display text-xl uppercase tracking-wide text-white mb-1">
        useUXEventRef
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        The <code className="text-command-blue">useUXEventRef</code> helper binds a ref and
        fire function together. The animation plays on the button itself.
      </p>

      <button
        ref={createRef}
        type="button"
        onClick={() => fireOnCreate('create', { entity: 'client' })}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl text-sm bg-command-blue text-white',
          interactions.button.base, interactions.button.press,
        )}
      >
        Create (bounce-in on self)
      </button>

      <button
        ref={achieveRef}
        type="button"
        onClick={() => fireOnAchieve('achieve', { entity: 'goal' })}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl text-sm bg-emerald-600 text-white',
          interactions.button.base, interactions.button.press,
        )}
      >
        Achieve goal (celebrate on self)
      </button>

      <button
        ref={errorRef}
        type="button"
        onClick={() => fireOnError('error')}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl text-sm bg-red-600/20 border border-red-600/30 text-red-400',
          interactions.button.base, interactions.button.press,
        )}
      >
        Error (shake on self)
      </button>
    </div>
  )
}

// ── Full event taxonomy ───────────────────────────────────────────────────────

export const EventTaxonomy: StoryObj = {
  name: 'Full event taxonomy',
  render: () => (
    <div className="p-6 max-w-2xl">
      <h2 className="font-display text-xl uppercase tracking-wide text-white mb-4">
        All {UX_EVENT_TYPES.length} event types
      </h2>
      <div className="grid grid-cols-2 gap-1.5">
        {UX_EVENT_TYPES.map((et) => {
          const anim = UX_ANIMATION_MAP[et]
          return (
            <div
              key={et}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface border border-surface-border"
            >
              <code className="text-xs text-gray-300">{et}</code>
              {anim ? (
                <code className="text-[10px] text-command-blue/70 ml-2 truncate max-w-[120px]">
                  {anim.replace('animate-', '')}
                </code>
              ) : (
                <span className="text-[10px] text-gray-700">—</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  ),
}
