// ------------------------------------------------------------
// components/layout/Layout.tsx — App shell with navigation
// ------------------------------------------------------------

import { useState }              from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient }        from '@tanstack/react-query'
import { cn }              from '@/lib/cn'
import { useOverlayStore } from '@/store/overlayStore'
import { useAuthStore }    from '@/store/authStore'
import { useSyncStatus }   from '@/hooks/useSyncStatus'
import { usePreferences }  from '@/hooks/usePreferences'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { OfflineBanner }   from '@/components/shell/OfflineBanner'
import { ToastContainer }  from '@/components/ui/ToastContainer'
import { apiClient }       from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  path:  string
  label: string
  icon:  string
  end?:  boolean
}

interface LayoutProps {
  children: React.ReactNode
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const TRAINER_NAV: NavItem[] = [
  { path: '/',          label: 'Dashboard', icon: '⌂',  end: true },
  { path: '/sessions',  label: 'Sessions',  icon: '🏋️' },
  { path: '/clients',   label: 'Clients',   icon: '👥' },
  { path: '/exercises', label: 'Exercises', icon: '💪' },
  { path: '/templates', label: 'Templates', icon: '📄' },
]

function athleteNav(): NavItem[] {
  return [
    { path: '/',             label: 'Dashboard',   icon: '⌂', end: true },
    { path: '/sessions',     label: 'Sessions',    icon: '🏋️' },
    { path: '/my-training',  label: 'My Training', icon: '💪' },
    { path: '/exercises',    label: 'Exercises',   icon: '🔬' },
    { path: '/templates',    label: 'Templates',   icon: '📄' },
  ]
}

// ── Bicep logo (collapsed sidebar icon) ───────────────────────────────────────

function BicepLogo({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" className={className}>
      <path d="M28 60 C24 50 22 38 26 28 C30 18 40 12 50 12 C60 12 68 18 70 28 C72 36 70 46 65 55"
        stroke="#1B50D9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 28 C24 22 28 14 36 11 C44 8 54 10 60 16 C66 22 68 32 66 40 C64 48 58 54 50 56 C42 58 34 56 30 50 C26 44 26 36 26 28 Z"
        fill="#1B50D9" opacity="0.15" />
      <path d="M26 28 C24 22 28 14 36 11 C44 8 54 10 60 16 C66 22 68 32 66 40 C64 48 58 54 50 56 C42 58 34 56 30 50 C26 44 26 36 26 28 Z"
        stroke="#1B50D9" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M65 55 C68 50 70 44 72 40 C74 36 76 33 78 32"
        stroke="#1B50D9" strokeWidth="5" strokeLinecap="round" />
      <path d="M78 32 C80 31 82 31 83 32" stroke="#1B50D9" strokeWidth="4" strokeLinecap="round" />
      <rect x="80" y="18" width="14" height="16" rx="4" ry="4"
        fill="#1B50D9" opacity="0.15" stroke="#1B50D9" strokeWidth="4" />
      <rect x="80" y="18" width="14" height="16" rx="4" ry="4" fill="#1B50D9" opacity="0.15" />
      <line x1="85" y1="18" x2="85" y2="34" stroke="#1B50D9" strokeWidth="1.5" opacity="0.5" />
      <line x1="90" y1="18" x2="90" y2="34" stroke="#1B50D9" strokeWidth="1.5" opacity="0.5" />
      <circle cx="65" cy="56" r="3" fill="#1B50D9" />
      <path d="M67 52 C69 48 71 44 73 41" stroke="#1B50D9" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <path d="M38 24 C42 20 50 19 56 22" stroke="#1B50D9" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  )
}

// ── Mobile account menu ───────────────────────────────────────────────────────

function UserMenuButton({
  initials,
  name,
  onLogout,
  onNavClick,
  showInstall,
  onInstall,
}: {
  initials:     string
  name:         string
  onLogout:     () => void
  onNavClick:   () => void
  showInstall?: boolean
  onInstall?:   () => void
}): React.JSX.Element {
  const [open, setOpen]  = useState(false)
  const { pathname }     = useLocation()
  const isPrefsActive    = pathname === '/preferences'

  const close = (): void => setOpen(false)

  return (
    <div className="relative">
      {/* Backdrop — closes menu on outside tap */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
      )}

      {/* Roll-up items — positioned above the button */}
      {open && (
        <div className="absolute bottom-full right-0 mb-3 z-50 flex flex-col gap-2 min-w-[172px]">

          {/* Log out — rolls up highest */}
          <button
            type="button"
            onClick={() => { close(); onNavClick(); onLogout() }}
            className={cn(
              'flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl',
              'bg-brand-accent border border-surface-border',
              'text-sm text-gray-300 hover:text-red-400 transition-colors',
              'animate-wheel-roll-up',
            )}
            style={{ animationDelay: showInstall ? '90ms' : '60ms' }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0" aria-hidden>
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Log out
          </button>

          {/* Install App — passive icon, only when installable (P4) */}
          {showInstall && (
            <button
              type="button"
              onClick={() => { close(); onNavClick(); void onInstall?.() }}
              className={cn(
                'flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl',
                'bg-brand-accent border border-surface-border',
                'text-sm text-gray-300 hover:text-white transition-colors',
                'animate-wheel-roll-up',
              )}
              style={{ animationDelay: '60ms' }}
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0 text-command-blue" aria-hidden>
                <path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Install App
            </button>
          )}

          {/* Preferences — rolls up first (closest to nav bar) */}
          <NavLink
            to="/preferences"
            onClick={() => { close(); onNavClick() }}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl',
              'bg-brand-accent border border-surface-border',
              'text-sm text-gray-300 hover:text-white transition-colors',
              'animate-wheel-roll-up',
            )}
          >
            {/* Gear spins once as it rolls in */}
            <span
              className="text-base leading-none shrink-0"
              style={{ display: 'inline-block', animation: 'spin 350ms ease-out forwards' }}
              aria-hidden
            >
              ⚙
            </span>
            Preferences
          </NavLink>
        </div>
      )}

      {/* Nav button — shows initials + first name.
          aria-label includes the visible name so it satisfies WCAG 2.5.3 (Label in Name).
          min-h-[44px] ensures the touch target meets the 44×44pt minimum. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${name.split(' ')[0]} — account menu`}
        aria-expanded={open}
        className={cn(
          'flex flex-col items-center gap-0.5 py-2.5 px-3 min-h-[44px] min-w-[44px] justify-center',
          'text-xs font-medium transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
          (isPrefsActive || open) ? 'text-command-blue' : 'text-gray-500',
        )}
      >
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          'border transition-colors duration-150',
          'text-[10px] font-bold leading-none',
          (isPrefsActive || open)
            ? 'bg-command-blue/20 border-command-blue/50 text-command-blue'
            : 'bg-surface-raised border-surface-border text-gray-400',
        )}>
          {initials}
        </div>
        <span className="text-[10px] mt-0.5 max-w-[52px] truncate leading-tight">
          {name.split(' ')[0] ?? 'Me'}
        </span>
      </button>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  const { pending: pendingSyncCount } = useSyncStatus()
  const trainer          = useAuthStore((s) => s.trainer)
  const clearAuth        = useAuthStore((s) => s.clearAuth)
  const { trainerMode }  = usePreferences()
  const { showPassiveIcon, promptInstall } = useInstallPrompt()
  const {
    state: overlayState,
    sidebarOpen,
    openSidebar,
    closeSidebar,
    minimise,
  } = useOverlayStore()
  const navigate = useNavigate()
  const qc       = useQueryClient()

  // Sidebar collapses to icon-only strip while a session is in full-screen mode
  const sessionExpanded = overlayState === 'expanded'
  const sidebarCollapsed = sessionExpanded && !sidebarOpen
  const navHidden = sessionExpanded  // mobile bottom bar hides when session is full-screen

  const isAthlete = trainerMode === 'athlete'
  const navItems  = isAthlete ? athleteNav() : TRAINER_NAV

  const mobileNavItems = navItems

  const initials = trainer?.name
    ? trainer.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleLogout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', {})
    } catch {
      // Even if the server call fails, clear local auth
    } finally {
      qc.clear()
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  // When navigating away while a session is expanded, drop it to a pill
  const handleNavClick = (): void => {
    if (sessionExpanded) {
      minimise()
      closeSidebar()
    }
  }

  return (
    <div className="flex flex-col min-h-screen md:flex-row">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0',
          'bg-brand-accent border-r border-surface-border z-20',
          'transition-all duration-300 ease-in-out overflow-hidden',
          sidebarCollapsed ? 'md:w-14' : 'md:w-56',
        )}
      >
        {sidebarCollapsed ? (
          /* ── Collapsed: bicep logo toggle ──────────────────────────── */
          <button
            type="button"
            aria-label="Open navigation"
            onClick={openSidebar}
            className={cn(
              'group flex flex-col items-center justify-center w-full py-5',
              'border-b border-surface-border',
              'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-command-blue',
            )}
          >
            <BicepLogo className="w-8 h-8 transition-transform duration-200 group-hover:scale-110" />
          </button>
        ) : (
          /* ── Expanded: full logo ────────────────────────────────────── */
          <div className="px-5 py-5 border-b border-surface-border flex items-center gap-2">
            {sessionExpanded ? (
              // During a session, clicking logo collapses sidebar back
              <button
                type="button"
                aria-label="Collapse navigation"
                onClick={closeSidebar}
                className="flex items-center gap-2 focus-visible:outline-none"
              >
                <BicepLogo className="w-7 h-7" />
                <span className="font-display text-2xl tracking-wider uppercase">
                  <span className="text-white">Trainer</span>
                  <span className="text-command-blue">App</span>
                </span>
              </button>
            ) : (
              <span className="font-display text-2xl tracking-wider uppercase">
                <span className="text-white">Trainer</span>
                <span className="text-command-blue">App</span>
              </span>
            )}
            {pendingSyncCount > 0 && (
              <span className="text-xs bg-amber-500 text-black rounded-full px-2 py-0.5 font-medium">
                {pendingSyncCount}
              </span>
            )}
          </div>
        )}

        {/* Nav links — hidden when collapsed to icon strip */}
        {!sidebarCollapsed && (
          <nav className="flex-1 flex flex-col" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={handleNavClick}
                className={({ isActive }: { isActive: boolean }) =>
                  cn(
                    'group relative flex items-center gap-3 w-full px-5 py-3.5',
                    'border-b border-surface-border',
                    'text-sm font-medium transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-command-blue',
                    isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200',
                  )
                }
              >
                <span
                  className="absolute inset-x-2 inset-y-1 rounded-lg bg-command-blue/25 opacity-0 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
                  aria-hidden
                />
                <span className="relative text-base w-5 text-center" aria-hidden>{item.icon}</span>
                <span className="relative">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}

        {/* User badge + preferences + logout — hidden when collapsed */}
        {!sidebarCollapsed && trainer != null && (
          <div className="border-t border-surface-border">
            <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border">
              <div
                aria-hidden
                className="w-7 h-7 rounded-full bg-command-blue/20 border border-command-blue/30 flex items-center justify-center shrink-0"
              >
                <span className="text-xs font-bold text-command-blue">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-200 truncate">{trainer.name}</p>
                <p className="text-[10px] text-gray-500 truncate">{trainer.email}</p>
              </div>
            </div>

            <NavLink
              to="/preferences"
              onClick={handleNavClick}
              className={({ isActive }: { isActive: boolean }) =>
                cn(
                  'group relative flex items-center gap-3 w-full px-5 py-3',
                  'border-b border-surface-border',
                  'text-xs font-medium transition-colors duration-100',
                  'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-command-blue',
                  isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200',
                )
              }
            >
              <span
                className="absolute inset-x-2 inset-y-1 rounded-lg bg-command-blue/25 opacity-0 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
                aria-hidden
              />
              <span className="relative text-sm w-5 text-center" aria-hidden>⚙</span>
              <span className="relative">Preferences</span>
            </NavLink>

            {/* Install App — passive icon (P4); only when installable */}
            {showPassiveIcon && (
              <button
                type="button"
                onClick={() => void promptInstall()}
                className={cn(
                  'group relative flex items-center gap-3 w-full px-5 py-3',
                  'border-b border-surface-border',
                  'text-xs font-medium transition-colors duration-100',
                  'text-command-blue hover:text-command-blue/80',
                  'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-command-blue',
                )}
              >
                <span
                  className="absolute inset-x-2 inset-y-1 rounded-lg bg-command-blue/15 opacity-0 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
                  aria-hidden
                />
                <span className="relative w-5 flex items-center justify-center" aria-hidden>
                  <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                    <path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="relative">Install App</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                'group relative flex items-center gap-3 w-full px-5 py-3',
                'text-xs font-medium transition-colors duration-100',
                'text-gray-400 hover:text-red-400',
                'focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-command-blue',
              )}
            >
              <span
                className="absolute inset-x-2 inset-y-1 rounded-lg bg-red-500/20 opacity-0 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
                aria-hidden
              />
              <span className="relative w-5 flex items-center justify-center" aria-hidden>
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="relative">Log out</span>
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main
        className={cn(
          'flex-1 pb-20 md:pb-0 min-h-screen overflow-y-auto',
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'md:ml-14' : 'md:ml-56',
        )}
      >
        <OfflineBanner />
        {children}
      </main>

      <ToastContainer />

      {/* ── Bottom tab bar (mobile) ───────────────────────────────────── */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 bg-brand-accent/95 backdrop-blur-sm border-t border-surface-border flex justify-around items-center safe-area-padding z-50",
          "transition-transform duration-300",
          navHidden && "translate-y-full",
        )}
        aria-label="Main navigation"
      >
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={handleNavClick}
            className={({ isActive }: { isActive: boolean }) =>
              cn(
                'flex flex-col items-center gap-0.5 py-2.5 px-3',
                'text-xs font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-command-blue',
                isActive ? 'text-command-blue' : 'text-gray-500',
              )
            }
          >
            <span className="text-xl leading-none" aria-hidden>{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </NavLink>
        ))}

        {/* Account button — replaces the old Prefs tab, reveals logout + prefs on tap */}
        {trainer != null && (
          <UserMenuButton
            initials={initials}
            name={trainer.name}
            onLogout={handleLogout}
            onNavClick={handleNavClick}
            showInstall={showPassiveIcon}
            onInstall={promptInstall}
          />
        )}
      </nav>

    </div>
  )
}
