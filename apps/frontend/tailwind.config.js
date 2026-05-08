/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // ── Color palette ──────────────────────────────────────────────────────
      colors: {
        // ── Semantic design system tokens (COLOR_SYSTEM.md) ──────────────────
        // Neutral foundation — no semantic meaning, structural only
        'forge-black':   '#000000',  // absolute ground
        'chalk-white':   '#FFFFFF',  // absolute light
        'iron-grey':     '#8A9099',  // cold steel — page background

        // Chromatic accents — one job each, never decorative
        'ember-red':     '#D91B1B',  // intensity: PRs, destructive, threshold moments
        'command-blue':  '#1B50D9',  // action: primary buttons, active states, navigation
        'signal-yellow': '#FFE200',  // notification: badges, alerts, achievements

        // ── Structural tokens (mapped to design system) ───────────────────────
        brand: {
          primary:   '#8A9099',   // iron grey — page background
          secondary: '#1C1C1C',   // near-black — card backgrounds
          accent:    '#111111',   // deep black — sidebar, panels
          // highlight removed — use ember-red, command-blue, or signal-yellow by intent
        },
        // Functional shades used in the UI
        surface: {
          DEFAULT: '#1E1E1E',     // dark card surface
          raised:  '#282828',     // elevated card (hover, focused)
          border:  '#404040',     // borders between surfaces
        },
      },

      // ── Typography ─────────────────────────────────────────────────────────
      fontFamily: {
        // Display headings — bold, gym-poster energy
        display: ['"Barlow Condensed"', 'ui-sans-serif', 'system-ui'],
        // Body text — clean, readable
        body:    ['"DM Sans"', 'ui-sans-serif', 'system-ui'],
        // Numbers / stats — monospaced readout feel (weights, reps)
        mono:    ['"DM Mono"', 'ui-monospace', 'monospace'],
        // Sans fallback (used by Tailwind default prose etc.)
        sans:    ['"DM Sans"', 'ui-sans-serif', 'system-ui'],
      },

      // ── Special text sizes ─────────────────────────────────────────────────
      fontSize: {
        // Workout stat numbers (e.g. "225 lbs" displayed large mid-session)
        stat:   ['3rem',   { lineHeight: '1',    fontWeight: '700' }],
        stat2x: ['4.5rem', { lineHeight: '1',    fontWeight: '800' }],
        hero:   ['1.75rem',{ lineHeight: '1.2',  fontWeight: '700', letterSpacing: '-0.02em' }],
      },

      // ── Spacing extras ─────────────────────────────────────────────────────
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom)',
        '18': '4.5rem',
      },

      // ── Animations ─────────────────────────────────────────────────────────
      keyframes: {
        'slide-up': {
          '0%':   { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-in-right': {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'spin-slow': {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        // FAB pulse — expanding ring to draw attention to primary action
        'fab-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(27, 80, 217, 0.4)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(27, 80, 217, 0)' },
        },
        // Shake — used on destructive hover to signal danger
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':      { transform: 'translateX(-3px)' },
          '40%':      { transform: 'translateX(3px)' },
          '60%':      { transform: 'translateX(-2px)' },
          '80%':      { transform: 'translateX(2px)' },
        },
        // Bounce-in — for elements appearing (e.g. new client added to list)
        'bounce-in': {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)',  opacity: '1' },
        },
        // Check pop — set logged, goal achieved confirmation
        'check-pop': {
          '0%':   { transform: 'scale(0) rotate(-10deg)', opacity: '0' },
          '60%':  { transform: 'scale(1.2) rotate(5deg)',  opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)',    opacity: '1' },
        },

        // ── UX event system animations (v1.4.4) ──────────────────────────────
        // One-shot animations triggered imperatively by the UX event engine.
        // Applied to DOM elements via playAnimation(), removed on animationend.

        // CREATE — new item arriving
        'bounce-in': {
          '0%':   { transform: 'scale(0.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)',  opacity: '1' },
        },
        // UPDATE — edit confirmed
        'flash-success': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(52, 211, 153, 0)' },
          '30%':      { boxShadow: '0 0 0 4px rgba(52, 211, 153, 0.35)' },
        },
        // DELETE — item collapsing away
        'collapse-out': {
          '0%':   { transform: 'scaleY(1)',   opacity: '1', maxHeight: '200px' },
          '60%':  { transform: 'scaleY(0.9)', opacity: '0.5' },
          '100%': { transform: 'scaleY(0)',   opacity: '0',  maxHeight: '0' },
        },
        // ACHIEVE — goal accomplished, celebratory
        'celebrate': {
          '0%':   { transform: 'scale(1)' },
          '20%':  { transform: 'scale(1.15) rotate(-3deg)' },
          '40%':  { transform: 'scale(1.2) rotate(3deg)' },
          '60%':  { transform: 'scale(1.1) rotate(-2deg)' },
          '80%':  { transform: 'scale(1.05) rotate(1deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        // ERROR — shake with red flash
        'field-confirm': {
          '0%, 100%': { borderColor: 'transparent' },
          '40%':      { borderColor: 'rgba(52, 211, 153, 0.6)' },
        },
        // WARNING — amber pulse
        'flash-warning': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(251, 191, 36, 0)' },
          '30%':      { boxShadow: '0 0 0 4px rgba(251, 191, 36, 0.3)' },
        },
        // REST TIMER — sharp pulse at zero
        'pulse-sharp': {
          '0%':   { transform: 'scale(1)',    opacity: '1' },
          '25%':  { transform: 'scale(1.08)', opacity: '1' },
          '50%':  { transform: 'scale(1)',    opacity: '1' },
          '75%':  { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        // DRAG — element lifted
        'lift': {
          '0%':   { transform: 'scale(1)',    boxShadow: 'none' },
          '100%': { transform: 'scale(1.03)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' },
        },
        // SWIPE directions
        'slide-out-left': {
          '0%':   { transform: 'translateX(0)',     opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
        'slide-out-right': {
          '0%':   { transform: 'translateX(0)',    opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        // REPORT MODAL — pulsing amber border on blurb textarea until focused
        'pulse-border-amber': {
          '0%, 100%': { borderColor: 'rgb(245 158 11 / 0.8)', boxShadow: '0 0 0 2px rgb(245 158 11 / 0.25)' },
          '50%':      { borderColor: 'rgb(245 158 11 / 0.25)', boxShadow: '0 0 0 0px rgb(245 158 11 / 0)' },
        },
      },
      animation: {
        'slide-up':          'slide-up 0.2s ease-out',
        'slide-in-right':    'slide-in-right 0.25s ease-out',
        'fade-in':           'fade-in 0.15s ease-out',
        'spin-slow':         'spin-slow 1s linear infinite',
        'fab-pulse':         'fab-pulse 2s ease-in-out infinite',
        'shake':             'shake 0.4s ease-in-out',
        'bounce-in':         'bounce-in 0.3s ease-out',
        'check-pop':         'check-pop 0.25s ease-out',
        // UX event system
        'flash-success':     'flash-success 0.5s ease-out',
        'flash-warning':     'flash-warning 0.5s ease-out',
        'collapse-out':      'collapse-out 0.25s ease-in forwards',
        'celebrate':         'celebrate 0.5s ease-out',
        'field-confirm':     'field-confirm 0.4s ease-out',
        'pulse-sharp':       'pulse-sharp 0.4s ease-in-out',
        'lift':              'lift 0.15s ease-out forwards',
        'slide-out-left':    'slide-out-left 0.2s ease-in forwards',
        'slide-out-right':   'slide-out-right 0.2s ease-in forwards',
        'pulse-border-amber': 'pulse-border-amber 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
