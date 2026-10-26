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

import { useEffect, useState, lazy, Suspense } from 'react'
import { useLocation }                       from 'react-router-dom'
import { cn }                                from '@/lib/cn'
import { useNav }                            from '@/services/navService'
import { useOverlayStore }                   from '@/store/overlayStore'
import { useSessionStore }                   from '@/store/sessionStore'
import { useInstallPrompt }                  from '@/hooks/useInstallPrompt'
import type { PanelState }                   from '@/services/navService'

// Lazy-loaded — these only render when a panel opens, a session is active, or the
// install banner shows; none at first paint. Static imports dragged the whole
// session + client-profile tree (and dompurify via ReportPreviewModal) into the
// always-loaded entry chunk. Lazy-loading moves them to on-demand chunks that the
// service worker precaches (instant after first use). See the #19 initial-load plan.
const ActiveSessionOverlay = lazy(() => import('./ActiveSessionOverlay').then((m) => ({ default: m.ActiveSessionOverlay })))
const ClientProfilePanel   = lazy(() => import('./ClientProfilePanel').then((m) => ({ default: m.ClientProfilePanel })))
const SessionLauncherSheet = lazy(() => import('./SessionLauncherSheet').then((m) => ({ default: m.SessionLauncherSheet })))
const SessionPlanPanel     = lazy(() => import('./SessionPlanPanel').then((m) => ({ default: m.SessionPlanPanel })))
const SessionHistoryPanel  = lazy(() => import('./SessionHistoryPanel').then((m) => ({ default: m.SessionHistoryPanel })))
const InstallPromptBanner  = lazy(() => import('./InstallPromptBanner').then((m) => ({ default: m.InstallPromptBanner })))

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps): React.JSX.Element {
  const location                              = useLocation()
  const nav                                   = useNav()
  const { state: overlayState }               = useOverlayStore()
  const { activeSessions }                    = useSessionStore()
  const { bannerOpen, isIOS, promptInstall, closeBanner } = useInstallPrompt()

  // Read current panel from location state
  const currentPanel = (location.state as { panel?: PanelState } | null)?.panel ?? null

  // Session launcher: mount on first open, then keep mounted so its open/close
  // animation still plays. Keeps the lazy chunk out of the entry until first use.
  const launcherOpen = currentPanel?.panel === 'sessionLauncher'
  const [launcherMounted, setLauncherMounted] = useState(false)
  useEffect(() => { if (launcherOpen) setLauncherMounted(true) }, [launcherOpen])

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
          'fixed inset-0 md:left-56 z-[10] bg-brand-primary',
          'transition-transform duration-300 ease-out',
          currentPanel?.panel === 'clientProfile'
            ? 'translate-x-0'
            : 'translate-x-full',
        )}
        aria-hidden={currentPanel?.panel !== 'clientProfile'}
      >
        {currentPanel?.panel === 'clientProfile' && currentPanel.entityId && (
          <Suspense fallback={null}>
            <ClientProfilePanel
              clientId={currentPanel.entityId}
              onClose={() => nav.closePanel()}
            />
          </Suspense>
        )}
      </div>

      {/* ── Session plan panel ───────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 md:left-56 z-[10] bg-brand-primary',
          'transition-transform duration-300 ease-out',
          currentPanel?.panel === 'sessionPlan'
            ? 'translate-x-0'
            : 'translate-x-full',
        )}
        aria-hidden={currentPanel?.panel !== 'sessionPlan'}
      >
        {currentPanel?.panel === 'sessionPlan' && (
          <Suspense fallback={null}>
            <SessionPlanPanel
              sessionId={currentPanel.entityId}
              clientId={currentPanel.returnTab}
              onClose={() => nav.closePanel()}
            />
          </Suspense>
        )}
      </div>

      {/* ── Session history panel ────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 md:left-56 z-[10] bg-brand-primary',
          'transition-transform duration-300 ease-out',
          currentPanel?.panel === 'sessionHistory'
            ? 'translate-x-0'
            : 'translate-x-full',
        )}
        aria-hidden={currentPanel?.panel !== 'sessionHistory'}
      >
        {currentPanel?.panel === 'sessionHistory' && currentPanel.entityId && (
          <Suspense fallback={null}>
            <SessionHistoryPanel
              sessionId={currentPanel.entityId}
              onClose={() => nav.closePanel()}
            />
          </Suspense>
        )}
      </div>

      {/* ── Session launcher sheet (lazy; mounted on first open) ──────────── */}
      {launcherMounted && (
        <Suspense fallback={null}>
          <SessionLauncherSheet
            open={launcherOpen}
            clientId={launcherOpen ? currentPanel?.entityId : undefined}
            onClose={() => nav.closePanel()}
          />
        </Suspense>
      )}

      {/* ── Active session overlay (lazy; only mounted when a session exists) ─ */}
      {sessionCount > 0 && (
        <Suspense fallback={null}>
          <ActiveSessionOverlay />
        </Suspense>
      )}

      {/* ── PWA install nudge (UF-S-03) ────────────────────────────────────── */}
      {bannerOpen && (
        <Suspense fallback={null}>
          <InstallPromptBanner
            isIOS={isIOS}
            onInstall={promptInstall}
            onDismiss={closeBanner}
          />
        </Suspense>
      )}
    </div>
  )
}
