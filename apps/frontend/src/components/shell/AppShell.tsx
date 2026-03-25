// ------------------------------------------------------------
// components/shell/AppShell.tsx (v2.0.0)
//
// SPA root shell. Wraps the app content with:
//   - Panel system (client profile, session summary, etc.)
//     driven by React Router location.state via navService
//   - Session overlay (Spotify model)
//   - Session launcher sheet
//
// The bottom nav / sidebar (from Layout) stays as-is.
// AppShell sits inside Layout so nav is always present.
//
// PANEL OPEN/CLOSE:
//   navService.openClientProfile(id) → pushes location.state
//   navService.closePanel()          → navigate(-1), pops state
//   Back button                      → same as closePanel()
//
// Z-INDEX STACK (defined in tailwind config or inline):
//   0  — base pages
//   10 — panels (client profile, session summary)
//   20 — session overlay (full screen)
//   25 — session pill (minimised)
//   30 — bottom sheets
//   40 — modals
//   50 — nav bar
//   60 — toasts
// ------------------------------------------------------------

import { useEffect }                         from 'react'
import { useLocation }                       from 'react-router-dom'
import { cn }                                from '@/lib/cn'
import { useNav }                            from '@/services/navService'
import { useOverlayStore }                   from '@/store/overlayStore'
import { useSessionStore }                   from '@/store/sessionStore'
import { ActiveSessionOverlay }              from './ActiveSessionOverlay'
import { ClientProfilePanel }                from './ClientProfilePanel'
import { SessionLauncherSheet }              from './SessionLauncherSheet'
import { SessionPlanPanel }                  from './SessionPlanPanel'
import { SessionHistoryPanel }               from './SessionHistoryPanel'
import type { PanelState }                   from '@/services/navService'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const location                              = useLocation()
  const nav                                   = useNav()
  const { state: overlayState }               = useOverlayStore()
  const { activeSessions }                    = useSessionStore()

  // Read current panel from location state
  const currentPanel = (location.state as { panel?: PanelState } | null)?.panel ?? null

  // Hide nav when overlay is expanded
  const _navHidden = overlayState === 'expanded'

  // When all sessions end, hide the overlay
  const sessionCount = Object.keys(activeSessions).length
  useEffect(() => {
    if (sessionCount === 0) {
      useOverlayStore.getState().hide()
    }
  }, [sessionCount])

  return (
    <div className="relative">
      {/* ── Base content ────────────────────────────────────────────────── */}
      <div className={cn(
        'transition-all duration-300',
        // Dim and slightly scale down when a panel is open
        currentPanel && 'opacity-60 scale-[0.98] pointer-events-none',
      )}>
        {children}
      </div>

      {/* ── Client profile panel ─────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-[10] bg-brand-primary',
          'transition-transform duration-300 ease-out',
          currentPanel?.panel === 'clientProfile'
            ? 'translate-x-0'
            : 'translate-x-full',
        )}
        aria-hidden={currentPanel?.panel !== 'clientProfile'}
      >
        {currentPanel?.panel === 'clientProfile' && currentPanel.entityId && (
          <ClientProfilePanel
            clientId={currentPanel.entityId}
            onClose={() => nav.closePanel()}
          />
        )}
      </div>

      {/* ── Session plan panel ───────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-[10] bg-brand-primary',
          'transition-transform duration-300 ease-out',
          currentPanel?.panel === 'sessionPlan'
            ? 'translate-x-0'
            : 'translate-x-full',
        )}
        aria-hidden={currentPanel?.panel !== 'sessionPlan'}
      >
        {currentPanel?.panel === 'sessionPlan' && (
          <SessionPlanPanel
            sessionId={currentPanel.entityId}
            clientId={currentPanel.returnTab}
            onClose={() => nav.closePanel()}
          />
        )}
      </div>

      {/* ── Session history panel ────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-[10] bg-brand-primary',
          'transition-transform duration-300 ease-out',
          currentPanel?.panel === 'sessionHistory'
            ? 'translate-x-0'
            : 'translate-x-full',
        )}
        aria-hidden={currentPanel?.panel !== 'sessionHistory'}
      >
        {currentPanel?.panel === 'sessionHistory' && currentPanel.entityId && (
          <SessionHistoryPanel
            sessionId={currentPanel.entityId}
            onClose={() => nav.closePanel()}
          />
        )}
      </div>

      {/* ── Session launcher sheet ────────────────────────────────────────── */}
      <SessionLauncherSheet
        open={currentPanel?.panel === 'sessionLauncher'}
        clientId={currentPanel?.panel === 'sessionLauncher' ? currentPanel.entityId : undefined}
        onClose={() => nav.closePanel()}
      />

      {/* ── Active session overlay ────────────────────────────────────────── */}
      <ActiveSessionOverlay />
    </div>
  )
}
