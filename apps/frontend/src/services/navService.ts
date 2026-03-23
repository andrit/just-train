// ------------------------------------------------------------
// services/navService.ts (v2.3.0-lite)
//
// Navigation abstraction layer.
//
// All navigation in the app goes through useNav(). Nothing
// touches React Router directly.
//
// INTERNAL MECHANISM: React Router location.state
//   Panel open/close pushes/pops history entries so the Android
//   back button and browser back work natively. PWA standalone
//   mode is handled correctly by React Router by default.
//
// INTERNAL EVENT BUS: navEventBus (see navEventBus.ts)
//   Every navigation call emits a NavEvent before executing.
//   This gives us:
//     - Debouncing — double-tap on a card can't open the panel twice
//     - Audit log  — full navigation history for debugging
//     - Foundation — when v2.3.0 (RxJS) lands, navEventBus.ts is
//                    swapped for an RxJS Subject. This file and all
//                    call sites are unchanged.
//
// UPGRADING TO RxJS (v2.3.0):
//   1. Replace navEventBus.ts with an RxJS Subject implementation
//   2. Update the two import lines below if needed
//   3. Done — no changes anywhere else in the codebase
//
// PANEL MODEL vs ROUTE MODEL:
//   Tabs    → URL routes  (/, /clients, /exercises, …)
//   Panels  → history.state (clientProfile, sessionHistory, …)
//   Overlays→ overlayStore + CSS transform (live session)
// ------------------------------------------------------------

import { useNavigate, useLocation } from 'react-router-dom'
import { useCallback }               from 'react'
import { navEventBus }               from './navEventBus'

// ── Panel state — stored in location.state ────────────────────────────────────

export type PanelType =
  | 'clientProfile'
  | 'sessionSummary'
  | 'sessionHistory'
  | 'sessionLauncher'
  | 'sessionPlan'

export interface PanelState {
  panel:      PanelType
  entityId?:  string
  returnTab?: string
}

export type TabRoute =
  | '/'
  | '/clients'
  | '/exercises'
  | '/sessions'
  | '/templates'
  | '/preferences'

// ── Re-export for consumers that want to observe or inspect ───────────────────

export { navEventBus }
export type { NavEvent, NavAction } from './navEventBus'

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentPanel = (location.state as { panel?: PanelState } | null)?.panel ?? null

  const openClientProfile = useCallback((clientId: string, returnTab?: string): void => {
    navEventBus.next('openClientProfile', { entityId: clientId, returnTab })
    navigate(location.pathname, {
      state: { panel: { panel: 'clientProfile', entityId: clientId, returnTab } },
    })
  }, [navigate, location.pathname])

  const openSessionSummary = useCallback((sessionId: string): void => {
    navEventBus.next('openSessionSummary', { entityId: sessionId })
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionSummary', entityId: sessionId } },
    })
  }, [navigate, location.pathname])

  const openSessionHistory = useCallback((sessionId: string): void => {
    navEventBus.next('openSessionHistory', { entityId: sessionId })
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionHistory', entityId: sessionId } },
    })
  }, [navigate, location.pathname])

  const openSessionLauncher = useCallback((clientId?: string): void => {
    navEventBus.next('openSessionLauncher', { entityId: clientId })
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionLauncher', entityId: clientId } },
    })
  }, [navigate, location.pathname])

  const openSessionPlan = useCallback((sessionId?: string, clientId?: string): void => {
    navEventBus.next('openSessionPlan', { entityId: sessionId, returnTab: clientId })
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionPlan', entityId: sessionId, returnTab: clientId } },
    })
  }, [navigate, location.pathname])

  const closePanel = useCallback((): void => {
    navEventBus.next('closePanel')
    navigate(-1)
  }, [navigate])

  const goToTab = useCallback((tab: TabRoute): void => {
    navEventBus.next('goToTab', { entityId: tab })
    navigate(tab)
  }, [navigate])

  return {
    currentPanel,
    openClientProfile,
    openSessionSummary,
    openSessionHistory,
    openSessionLauncher,
    openSessionPlan,
    closePanel,
    goToTab,
  }
}
