// ------------------------------------------------------------
// services/navService.ts (v2.0.0)
//
// Navigation abstraction layer.
//
// WHY THIS EXISTS:
//   All navigation in the app goes through this service, not
//   directly through React Router. This means when we migrate
//   to an observable-based navigation system (v2.3.0), we swap
//   the implementation here without touching any call sites.
//
// CURRENT IMPLEMENTATION: React Router location.state
//   Each panel/overlay open pushes a history entry so the
//   Android back button and browser back close the panel rather
//   than exiting the app. React Router handles PWA standalone
//   mode correctly by default.
//
// FUTURE IMPLEMENTATION: RxJS observable stream (v2.3.0)
//   Every open/close becomes a stream emission. Debounced rapid
//   interactions, auditable navigation log, race condition free.
//
// PANEL MODEL vs ROUTE MODEL:
//   Tabs  (/, /clients, /exercises, etc.) → still URL routes
//   Panels (client profile, session summary) → history.state
//   Overlays (live session) → sessionStore + CSS transform
//
// USAGE:
//   const nav = useNav()
//   nav.openClientProfile(clientId)   // pushes history entry
//   nav.closePanel()                  // pops history entry
//   nav.goToTab('clients')            // React Router navigate
// ------------------------------------------------------------

import { useNavigate, useLocation } from 'react-router-dom'
import { useCallback }               from 'react'

// ── Panel state — stored in location.state ────────────────────────────────────

export type PanelType =
  | 'clientProfile'
  | 'sessionSummary'
  | 'sessionHistory'
  | 'sessionLauncher'
  | 'sessionPlan'

export interface PanelState {
  panel:     PanelType
  entityId?: string       // clientId, sessionId, etc.
  returnTab?: string      // restore tab on close
}

export type TabRoute =
  | '/'
  | '/clients'
  | '/exercises'
  | '/sessions'
  | '/templates'
  | '/preferences'

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentPanel = (location.state as { panel?: PanelState } | null)?.panel ?? null

  // ── Open a panel — pushes a history entry ──────────────────────────────

  const openClientProfile = useCallback((clientId: string, returnTab?: string): void => {
    navigate(location.pathname, {
      state: { panel: { panel: 'clientProfile', entityId: clientId, returnTab } },
    })
  }, [navigate, location.pathname])

  const openSessionSummary = useCallback((sessionId: string): void => {
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionSummary', entityId: sessionId } },
    })
  }, [navigate, location.pathname])

  const openSessionHistory = useCallback((sessionId: string): void => {
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionHistory', entityId: sessionId } },
    })
  }, [navigate, location.pathname])

  const openSessionLauncher = useCallback((clientId?: string): void => {
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionLauncher', entityId: clientId } },
    })
  }, [navigate, location.pathname])

  const openSessionPlan = useCallback((sessionId?: string, clientId?: string): void => {
    navigate(location.pathname, {
      state: { panel: { panel: 'sessionPlan', entityId: sessionId, returnTab: clientId } },
    })
  }, [navigate, location.pathname])

  // ── Close current panel — pops history entry ───────────────────────────

  const closePanel = useCallback((): void => {
    navigate(-1)
  }, [navigate])

  // ── Navigate to a tab — URL change ────────────────────────────────────

  const goToTab = useCallback((tab: TabRoute): void => {
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
