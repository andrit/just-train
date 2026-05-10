// ------------------------------------------------------------
// components/layout/Layout.tsx — App shell with navigation
// Updated v2.7.0: fixed sidebar, mode-aware nav, logout button
// ------------------------------------------------------------

import { NavLink, useNavigate }  from 'react-router-dom'
import { useQueryClient }        from '@tanstack/react-query'
import { cn }              from '@/lib/cn'
import { useOverlayStore } from '@/store/overlayStore'
import { useAuthStore }    from '@/store/authStore'
import { useSyncStatus }   from '@/hooks/useSyncStatus'
import { usePreferences }  from '@/hooks/usePreferences'
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function Layout({ children }: LayoutProps): React.JSX.Element {
  const { pending: pendingSyncCount } = useSyncStatus()
  const trainer          = useAuthStore((s) => s.trainer)
  const clearAuth        = useAuthStore((s) => s.clearAuth)
  const { trainerMode }  = usePreferences()
  const { state: overlayState } = useOverlayStore()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const navHidden = overlayState === 'expanded'

  const isAthlete = trainerMode === 'athlete'
  const navItems  = isAthlete ? athleteNav() : TRAINER_NAV

  // Mobile nav always includes Preferences
  const mobileNavItems: NavItem[] = [
    ...navItems,
    { path: '/preferences', label: 'Prefs', icon: '⚙' },
  ]

  const initials = trainer?.name
    ? trainer.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleLogout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', {})
    } catch {
      // Even if the server call fails, clear local auth
    } finally {
      qc.clear()          // wipe all cached data so next login starts fresh
      clearAuth()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="flex flex-col min-h-screen md:flex-row">

      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      {/* fixed: always viewport height, never grows with content */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-56 bg-brand-accent border-r border-surface-border z-20">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-surface-border flex items-center gap-2">
          <span className="font-display text-2xl tracking-wider uppercase">
            <span className="text-white">Trainer</span>
            <span className="text-command-blue">App</span>
          </span>
          {pendingSyncCount > 0 && (
            <span className="text-xs bg-amber-500 text-black rounded-full px-2 py-0.5 font-medium">
              {pendingSyncCount}
            </span>
          )}
        </div>

        {/* Nav links — piano key layout: full-width, edge-to-edge border dividers */}
        <nav className="flex-1 flex flex-col" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
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
              {/* Press flash — invisible at rest, pulses on press, fades out */}
              <span
                className="absolute inset-x-2 inset-y-1 rounded-lg bg-command-blue/25 opacity-0 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
                aria-hidden
              />
              <span className="relative text-base w-5 text-center" aria-hidden>{item.icon}</span>
              <span className="relative">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User badge + preferences + logout */}
        {trainer != null && (
          <div className="border-t border-surface-border">
            {/* User badge */}
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

            {/* Preferences — piano key */}
            <NavLink
              to="/preferences"
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

            {/* Logout — piano key */}
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
      <main className="flex-1 pb-20 md:pb-0 md:ml-56 min-h-screen overflow-y-auto">
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
      </nav>

    </div>
  )
}
