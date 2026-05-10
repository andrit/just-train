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
  // Sidebar is open (full-width) unless a session overlay is expanded and the user
  // hasn't explicitly toggled it open. Only meaningful when state === 'expanded'.
  sidebarOpen:      boolean

  expand:          (clientId: string) => void
  minimise:        () => void
  hide:            () => void
  setFocused:      (clientId: string) => void
  openSidebar:     () => void
  closeSidebar:    () => void
}

export const useOverlayStore = create<OverlayStoreState>()((set) => ({
  state:           'hidden',
  focusedClientId: null,
  sidebarOpen:     true,

  // Collapse sidebar when session expands to full-screen
  expand:    (clientId) => set({ state: 'expanded', focusedClientId: clientId, sidebarOpen: false }),
  minimise:  ()         => set({ state: 'minimised', sidebarOpen: true }),
  hide:      ()         => set({ state: 'hidden', focusedClientId: null, sidebarOpen: true }),
  setFocused: (id)      => set({ focusedClientId: id }),

  openSidebar:  () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
}))
