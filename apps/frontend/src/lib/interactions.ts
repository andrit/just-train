// ------------------------------------------------------------
// lib/interactions.ts — Button and UI interaction animation config
//
// All interactive animation values are defined here so they can be
// tweaked in one place without hunting through components.
//
// USAGE:
//   import { interactions } from '@/lib/interactions'
//   <button className={cn(interactions.button.base, interactions.button.pulse)} />
//
// TO TWEAK:
//   - Change duration values (e.g. 'duration-150' → 'duration-300')
//   - Swap scale values (e.g. 'active:scale-95' → 'active:scale-90')
//   - Enable/disable pulse by removing the pulse class from a component
//   - Add new interaction types following the same pattern
// ------------------------------------------------------------

export const interactions = {
  // ── Primary action button (Add, Save, Create) ────────────────────────────
  // Scale down slightly on press, spring back. Feels physical and responsive.
  button: {
    base:   'transition-all duration-150 ease-out active:scale-95',
    hover:  'hover:scale-[1.02]',
    press:  'active:scale-95',
  },

  // ── Floating action button (Add Client +, FAB) ───────────────────────────
  // Gentle continuous pulse to draw attention. Scale on hover.
  fab: {
    base:   'transition-all duration-200 ease-out',
    hover:  'hover:scale-110 hover:shadow-lg hover:shadow-command-blue/30',
    press:  'active:scale-95',
    // Pulse ring — concentric expanding ring around the button
    // Controlled via CSS animation in index.css (@keyframes fab-pulse)
    pulse:  'animate-fab-pulse',
  },

  // ── Card (Client card, exercise card) ───────────────────────────────────
  // Lift and slight border brightening on hover.
  card: {
    base:   'transition-all duration-200 ease-out',
    hover:  'hover:-translate-y-0.5 hover:border-surface-raised hover:shadow-md hover:shadow-black/20',
    press:  'active:translate-y-0 active:scale-[0.99]',
  },

  // ── Destructive action (Delete, Deactivate) ──────────────────────────────
  // Brief shake animation on hover to signal danger.
  danger: {
    base:   'transition-all duration-150 ease-out',
    hover:  'hover:animate-shake',
    press:  'active:scale-95',
  },

  // ── Icon button (kebab menu, close, back) ────────────────────────────────
  icon: {
    base:   'transition-all duration-150 ease-out rounded-full',
    hover:  'hover:bg-surface-raised hover:scale-110',
    press:  'active:scale-90',
  },
} as const

// ── Tailwind animation class strings ─────────────────────────────────────────
// These reference keyframes defined in tailwind.config.js or index.css.
// Add new keyframes there and reference them here.

export const animationClasses = {
  fabPulse:   'animate-fab-pulse',
  shake:      'animate-shake',
  bounceIn:   'animate-bounce-in',
  slideUp:    'animate-slide-up',
  fadeIn:     'animate-fade-in',
} as const
