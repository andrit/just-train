// ------------------------------------------------------------
// store/overlayStore.ts (v2.0.0)
//
// Manages the active session overlay UI state.
// Separate from sessionStore (which tracks session IDs) because
// this is purely UI state — not persisted.
//
// STATES:
//   hidden     — no active sessions
//   minimised  — pill visible above nav, session running in bg
//   expanded   — full screen overlay, nav hidden
//
// Multiple active sessions: focusedClientId determines which
// session's overlay is shown. The others show as stacked pills.
// ------------------------------------------------------------

import { create } from 'zustand'

type OverlayState = 'hidden' | 'minimised' | 'expanded'

interface OverlayStoreState {
  state:            OverlayState
  focusedClientId:  string | null

  expand:     (clientId: string) => void
  minimise:   () => void
  hide:       () => void
  setFocused: (clientId: string) => void
}

export const useOverlayStore = create<OverlayStoreState>()((set) => ({
  state:           'hidden',
  focusedClientId: null,

  expand: (clientId) => set({ state: 'expanded', focusedClientId: clientId }),
  minimise: ()       => set({ state: 'minimised' }),
  hide: ()           => set({ state: 'hidden', focusedClientId: null }),
  setFocused: (id)   => set({ focusedClientId: id }),
}))
