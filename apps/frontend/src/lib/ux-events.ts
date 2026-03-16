// ------------------------------------------------------------
// lib/ux-events.ts — UX Event Type system (Phase 4.4 / v1.4.4)
//
// The semantic layer above interactions.ts.
// interactions.ts = CSS classes (how things look)
// ux-events.ts    = event taxonomy + animation engine + side effects (what things mean)
//
// THREE LAYERS:
//   1. UXEventType taxonomy — every classified user interaction
//   2. Animation engine    — imperatively triggers one-shot CSS animations on DOM elements
//   3. Side-effect registry — pluggable handlers per event type (audit, guidance, haptics)
//
// USAGE IN COMPONENTS:
//   const { fire } = useUXEvent()
//   <button onClick={() => { fire('create', { entity: 'client', target: ref.current }) }}>
//     Add Client
//   </button>
//
// REGISTERING SIDE EFFECTS (at app boot in main.tsx):
//   import { uxEventRegistry } from '@/lib/ux-events'
//   uxEventRegistry.register('create', async (payload) => {
//     await auditLog.record('create', payload)
//   })
//
// DIRECTIONAL TIME METAPHOR:
//   The app has a natural time axis: Past ←── Present ──→ Future
//   Navigation directions respect this:
//     Forward in time → content slides from right
//     Back in time    → content slides from left
//     Scroll up       → further back (older history)
//     Scroll down     → toward present
// ------------------------------------------------------------

// ── UX Event Type taxonomy ────────────────────────────────────────────────────

export const UX_EVENT_TYPES = [
  // ── Gesture ────────────────────────────────────────────────────────────────
  // Touch and mouse input — touch mirrors mouse equivalents
  'single_press',     // tap / click
  'double_press',     // double-tap / double-click
  'long_press',       // hold — context menu, reorder handle activation
  'swipe_left',       // dismiss, delete reveal (past direction)
  'swipe_right',      // archive, mark done (future direction)
  'swipe_up',         // scroll to next, expand panel
  'swipe_down',       // pull to refresh, collapse panel
  'drag_start',       // picked up — lift animation
  'drag_end',         // dropped — settle animation

  // ── Text input ─────────────────────────────────────────────────────────────
  'text_focus',       // field focused — attention ring
  'text_input',       // typing — can trigger contextual guidance
  'text_commit',      // blur or Enter — field finalized, brief confirm flash
  'text_clear',       // field cleared
  'select_change',    // dropdown changed
  'toggle',           // checkbox or switch flipped
  'slider_change',    // 1-10 subjective score slider moved

  // ── Navigation ─────────────────────────────────────────────────────────────
  'page_enter',       // route arrived — staggered content reveal
  'page_exit',        // route leaving — content exits
  'drawer_open',      // drawer/panel arriving from right
  'drawer_close',     // drawer/panel exiting
  'tab_change',       // lateral tab switch — crossfade
  'modal_open',
  'modal_close',

  // ── CRUD actions ───────────────────────────────────────────────────────────
  'create',           // new item created — bounce-in on the new element
  'update',           // edit saved — brief highlight flash
  'delete',           // deleted — collapse-out animation
  'achieve',          // goal achieved — celebrate animation

  // ── Session-specific (Phase 5) ─────────────────────────────────────────────
  'session_start',    // Big moment — full ripple, immersive
  'session_end',      // Completion — fade to summary
  'set_logged',       // Per-set confirmation — fast check-pop, repeatable
  'rest_tick',        // Rest timer countdown tick — pulse ring
  'rest_complete',    // Rest timer hit zero — sharp pulse

  // ── System ─────────────────────────────────────────────────────────────────
  'loading_start',
  'loading_end',
  'error',            // Validation or server error — shake + red flash
  'success',          // Operation confirmed — green flash
  'warning',          // Non-blocking notice — amber pulse
] as const

export type UXEventType = typeof UX_EVENT_TYPES[number]

// ── Event payload ─────────────────────────────────────────────────────────────

export interface UXEventPayload {
  /** The DOM element to animate. If omitted, animation is skipped. */
  target?:    HTMLElement | null
  /** Semantic context for side effects */
  entity?:    string          // 'client' | 'goal' | 'snapshot' | 'session' | 'set' etc.
  entityId?:  string
  /** Arbitrary metadata for side effect handlers */
  meta?:      Record<string, unknown>
}

// ── Animation map ─────────────────────────────────────────────────────────────
// Maps each event type to the CSS animation class that fires on its target.
// One-shot animations (not continuous) — added to the element, removed on animationend.
// null = no imperative animation (handled by CSS :active/:hover or not needed)

export const UX_ANIMATION_MAP: Partial<Record<UXEventType, string>> = {
  // Gesture
  swipe_left:   'animate-slide-out-left',
  swipe_right:  'animate-slide-out-right',
  drag_start:   'animate-lift',

  // Text input
  text_commit:  'animate-field-confirm',
  error:        'animate-shake',

  // CRUD
  create:       'animate-bounce-in',
  delete:       'animate-collapse-out',
  achieve:      'animate-celebrate',
  update:       'animate-flash-success',
  success:      'animate-flash-success',
  warning:      'animate-flash-warning',

  // Session
  set_logged:   'animate-check-pop',
  rest_complete:'animate-pulse-sharp',

  // Navigation (applied to page containers, not buttons)
  page_enter:   'animate-slide-up',
  drawer_open:  'animate-slide-in-right',
}

// ── Animation engine ──────────────────────────────────────────────────────────
// Imperatively plays a one-shot CSS animation on a DOM element.
// Removes the class after the animation completes so it can be re-triggered.

export function playAnimation(element: HTMLElement, animationClass: string): void {
  // Remove class first in case it's already present (re-trigger)
  element.classList.remove(animationClass)

  // Force reflow so removing and re-adding the class triggers the animation
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  element.offsetWidth

  element.classList.add(animationClass)

  const cleanup = (): void => {
    element.classList.remove(animationClass)
    element.removeEventListener('animationend', cleanup)
  }

  element.addEventListener('animationend', cleanup, { once: true })
}

// ── Side-effect registry ──────────────────────────────────────────────────────
// A singleton that holds pluggable async handlers per event type.
// Handlers run non-blocking — they never delay the animation or UI.
//
// Register at app boot (main.tsx), not inside components.

type SideEffectHandler = (eventType: UXEventType, payload: UXEventPayload) => Promise<void> | void

class UXEventRegistry {
  private handlers = new Map<UXEventType, SideEffectHandler[]>()
  private globalHandlers: SideEffectHandler[] = []

  /**
   * Register a handler for a specific event type.
   * Multiple handlers per type are supported — all run concurrently.
   */
  register(eventType: UXEventType, handler: SideEffectHandler): void {
    const existing = this.handlers.get(eventType) ?? []
    this.handlers.set(eventType, [...existing, handler])
  }

  /**
   * Register a handler that fires on EVERY event type.
   * Use for audit logging, analytics, or debugging.
   */
  registerGlobal(handler: SideEffectHandler): void {
    this.globalHandlers.push(handler)
  }

  /**
   * Remove all handlers for a specific event type.
   */
  unregister(eventType: UXEventType): void {
    this.handlers.delete(eventType)
  }

  /**
   * Remove all global handlers.
   */
  unregisterGlobal(): void {
    this.globalHandlers = []
  }

  /**
   * Fire all handlers for the given event type.
   * Always async and non-blocking — errors are caught and logged.
   */
  dispatch(eventType: UXEventType, payload: UXEventPayload): void {
    const specific = this.handlers.get(eventType) ?? []
    const all      = [...specific, ...this.globalHandlers]

    if (all.length === 0) return

    Promise.allSettled(
      all.map((handler) => Promise.resolve(handler(eventType, payload)))
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === 'rejected') {
          // Side effect errors never crash the UI
          console.error('[UXEvent] side effect error:', result.reason)
        }
      })
    })
  }

  /**
   * List all registered event types (useful for debugging).
   */
  registeredTypes(): UXEventType[] {
    return Array.from(this.handlers.keys())
  }
}

// Singleton — import this to register handlers
export const uxEventRegistry = new UXEventRegistry()

// ── Fire function (non-hook version) ─────────────────────────────────────────
// For use outside React (utility functions, event handlers without hooks).

export function fireUXEvent(eventType: UXEventType, payload: UXEventPayload = {}): void {
  // 1. Play animation if a target is provided and an animation is mapped
  if (payload.target) {
    const animClass = UX_ANIMATION_MAP[eventType]
    if (animClass) {
      playAnimation(payload.target, animClass)
    }
  }

  // 2. Dispatch side effects — always async, never blocks
  uxEventRegistry.dispatch(eventType, payload)
}

// ── Contextual guidance rules ─────────────────────────────────────────────────
// Rules that evaluate on certain event types and may surface a tooltip,
// nudge, or soft confirmation. Phase 4.5+ will hook these into the UI.
// Defined here so the structure is established and rules can accumulate.

export interface GuidanceRule {
  trigger:    UXEventType
  /** Additional condition on the payload — return true to activate */
  condition:  (payload: UXEventPayload, context?: Record<string, unknown>) => boolean
  message:    string
  type:       'tooltip' | 'nudge' | 'confirm'
  /** How long to show the guidance before auto-dismissing (ms). null = persistent */
  duration:   number | null
}

export const GUIDANCE_RULES: GuidanceRule[] = [
  {
    trigger:   'create',
    condition: (p, ctx) => p.entity === 'client' && (ctx?.clientCount as number) === 1,
    message:   'First client added. Take a baseline snapshot to start tracking progress.',
    type:      'nudge',
    duration:  6000,
  },
  {
    trigger:   'create',
    condition: (p, ctx) => p.entity === 'goal' && (ctx?.goalCount as number) === 1,
    message:   'Goal set. It will appear at the top of the monthly report.',
    type:      'nudge',
    duration:  4000,
  },
  {
    trigger:   'session_start',
    condition: (_, ctx) => ctx?.progressionState === 'assessment',
    message:   "Still in assessment. Consider taking a baseline snapshot before logging sessions.",
    type:      'confirm',
    duration:  null,
  },
  {
    trigger:   'achieve',
    condition: () => true,
    message:   'Goal achieved. Set the next one to keep momentum.',
    type:      'nudge',
    duration:  5000,
  },
]

/**
 * Evaluate guidance rules for a given event. Returns the first matching rule, or null.
 * Phase 4.5+: the UI layer calls this and renders the appropriate guidance component.
 */
export function evaluateGuidance(
  eventType: UXEventType,
  payload:   UXEventPayload,
  context?:  Record<string, unknown>,
): GuidanceRule | null {
  return GUIDANCE_RULES.find(
    (rule) => rule.trigger === eventType && rule.condition(payload, context),
  ) ?? null
}
